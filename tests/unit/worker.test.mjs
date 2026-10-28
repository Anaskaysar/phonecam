// Unit tests for the Worker (worker/index.js, worker/signal.js). Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Cloudflare runtime classes the Durable Object touches.
globalThis.WebSocketRequestResponsePair ??= class { constructor(request, response) { this.request = request; this.response = response } }

const { default: worker, SignalRoom, VisitCounter } = await import('../../worker/index.js')
const { countryOf, LIVE_MS } = await import('../../worker/visits.js')
const { roomOf } = await import('../../worker/signal.js')
const { kindOf, notFoundPage } = await import('../../worker/notfound.js')

const SITE = 'https://phonecam.app'
const ROOM = 'abcdefghijklmnop'

const assets = { fetch: async () => new Response('asset') }
const env = (extra = {}) => ({ ASSETS: assets, ...extra })
const get = (path, headers = {}) => worker.fetch(new Request(`${SITE}${path}`, { headers }), env())

// A tiny stand-in for the D1 database: records inserts, can be told to fail.
function fakeDb({ unique = false, changes = 1 } = {}) {
  const inserts = []
  const batches = []
  return {
    inserts,
    batches,
    async batch(statements) { batches.push(statements.length); return [] },
    prepare(sql) {
      let args = []
      return {
        bind(...values) { args = values; return this },
        async run() {
          if (unique) throw new Error('D1_ERROR: UNIQUE constraint failed: feedback.visitor_day')
          inserts.push({ sql, args })
          return { success: true, meta: { changes } }
        },
        async first() { return { count: 2, average: 4.5, waiting: 1, shown: 0, s4: 1, s5: 1 } },
        async all() { return { results: [{ id: 7, rating: 5, comment: 'Great', name: '', public_ok: 1, approved: 0, created_at: '2026-10-24 10:00:00' }] } }
      }
    }
  }
}

function post(body, { origin = SITE, db = fakeDb(), ip = '1.2.3.4' } = {}) {
  const headers = { 'content-type': 'application/json', 'cf-connecting-ip': ip }
  if (origin) headers.origin = origin
  return worker.fetch(new Request(`${SITE}/api/feedback`, { method: 'POST', headers, body: JSON.stringify(body) }), env({ DB: db }))
}

test('a visit is counted once per new browser, and a read does not add another', async () => {
  assert.equal((await get('/api/visits')).status, 503, 'no counter binding')

  let total = 0
  const visits = {
    idFromName: () => 'site',
    get: () => ({
      fetch: async (request) => {
        if (request.method === 'POST') total += 1
        return Response.json({ total })
      }
    })
  }
  const call = (method, origin) => worker.fetch(
    new Request(`${SITE}/api/visits`, { method, headers: origin ? { origin } : {} }),
    env({ VISITS: visits })
  )
  assert.equal((await call('POST', 'https://evil.example')).status, 403)
  assert.deepEqual(await (await call('POST', SITE)).json(), { total: 1 })
  assert.deepEqual(await (await call('GET')).json(), { total: 1 })
})

test('VisitCounter counts real countries and ignores an unknown one', async () => {
  assert.equal(countryOf(new Request(SITE)), '')
  assert.equal(countryOf(new Request(SITE, { headers: { 'cf-ipcountry': 'xx' } })), '')
  assert.equal(countryOf(new Request(SITE, { headers: { 'cf-ipcountry': 'BD' } })), 'BD')

  const stored = new Map()
  const counter = new VisitCounter({
    storage: {
      get: async (key) => stored.get(key),
      put: async (key, value) => {
        if (typeof key === 'object') for (const [name, item] of Object.entries(key)) stored.set(name, item)
        else stored.set(key, value)
      }
    }
  })
  const post = (country) => counter.fetch(new Request(`${SITE}/api/visits`, {
    method: 'POST',
    headers: country ? { 'cf-ipcountry': country } : {}
  }))
  await post('us')
  await post('BD')
  await post('US')
  await post('XX')
  const body = await (await counter.fetch(new Request(`${SITE}/api/visits`))).json()
  assert.equal(body.total, 4)
  assert.deepEqual(body.countries, [{ code: 'US', count: 2 }, { code: 'BD', count: 1 }])
})

function visitCounter(start = Date.parse('2026-10-27T12:30:00Z')) {
  const stored = new Map()
  let now = start
  const counter = new VisitCounter({
    storage: {
      get: async (key) => stored.get(key),
      put: async (entries) => { for (const [key, value] of Object.entries(entries)) stored.set(key, value) }
    }
  }, {}, () => now)
  const send = (method, path, { country, body } = {}) => counter.fetch(new Request(`${SITE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(country ? { 'cf-ipcountry': country } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })).then((response) => response.json())
  return { counter, stored, send, advance: (ms) => { now += ms } }
}

test('visits: the last 24 hours are counted per hour and per country, older hours are dropped', async () => {
  const { send, stored, advance } = visitCounter()
  await send('POST', '/api/visits', { country: 'CA' })
  advance(2 * 60 * 60 * 1000)
  await send('POST', '/api/visits', { country: 'CA' })
  await send('POST', '/api/visits', { country: 'IN' })
  let body = await send('GET', '/api/visits')
  assert.equal(body.hours.length, 24)
  assert.deepEqual(body.hours.slice(-3), [1, 0, 2], 'oldest to newest, this hour last')
  assert.equal(body.day.total, 3)
  assert.deepEqual(body.day.countries, [{ code: 'CA', count: 2 }, { code: 'IN', count: 1 }])

  advance(24 * 60 * 60 * 1000)
  await send('POST', '/api/visits', { country: 'US' })
  body = await send('GET', '/api/visits')
  assert.equal(body.total, 4, 'all time keeps everyone')
  assert.deepEqual(body.day.countries, [{ code: 'US', count: 1 }])
  assert.equal(Object.keys(stored.get('hours')).length, 1, 'old hours are deleted, not kept')
})

test('visits: live counts tabs that checked in recently, and keeps nothing in storage', async () => {
  const { send, stored, advance } = visitCounter()
  await send('POST', '/api/visits/live', { country: 'BD', body: { id: 'tab-one-aaaa' } })
  await send('POST', '/api/visits/live', { country: 'BD', body: { id: 'tab-one-aaaa' } })
  let body = await send('POST', '/api/visits/live', { country: 'US', body: { id: 'tab-two-bbbb' } })
  assert.equal(body.live.total, 2, 'the same tab counts once')
  assert.deepEqual(body.live.countries, [{ code: 'BD', count: 1 }, { code: 'US', count: 1 }])
  assert.equal(body.total, 0, 'checking in is not a new visit')
  assert.equal(stored.size, 0)

  advance(LIVE_MS + 1000)
  body = await send('GET', '/api/visits')
  assert.equal(body.live.total, 0, 'tabs that went quiet drop off')

  const bad = await (await visitCounter().counter.fetch(new Request(`${SITE}/api/visits/live`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: '<script>' })
  }))).status
  assert.equal(bad, 400)
})

test('visits: live check-ins are POST only and from the PhoneCam site', async () => {
  const visits = { idFromName: () => 'site', get: () => ({ fetch: async () => Response.json({ total: 0 }) }) }
  const call = (method, origin) => worker.fetch(
    new Request(`${SITE}/api/visits/live`, { method, headers: origin ? { origin } : {} }),
    env({ VISITS: visits })
  )
  assert.equal((await call('GET')).status, 405)
  assert.equal((await call('POST', 'https://evil.example')).status, 403)
  assert.equal((await call('POST', SITE)).status, 200)
})

test('pages are served from static assets', async () => {
  assert.equal(await (await get('/')).text(), 'asset')
})

test('unknown /api routes are 404', async () => {
  assert.equal((await get('/api/nope')).status, 404)
})

test('roomOf accepts only v2 laptop and phone ids', () => {
  assert.equal(roomOf(`phonecam-v2-${ROOM}`), ROOM)
  assert.equal(roomOf(`phonecam-v2-${ROOM}-pabcdefgh`), ROOM)
  for (const bad of ['', 'phonecam-v1-amber-pine-123', `phonecam-v2-${ROOM}x`, `phonecam-v2-${ROOM}-p123`, `phonecam-v2-${ROOM.toUpperCase()}`]) {
    assert.equal(roomOf(bad), null, bad)
  }
})

test('signalling refuses other sites, plain requests and bad ids', async () => {
  const ws = { upgrade: 'websocket' }
  const signal = (path, headers) => worker.fetch(new Request(`${SITE}${path}`, { headers }), env({ SIGNAL: { idFromName: () => 'x', get: () => ({ fetch: async () => new Response('room') }) } }))
  assert.equal((await signal(`/signal/peerjs?id=phonecam-v2-${ROOM}`, { origin: SITE })).status, 426, 'not a WebSocket')
  assert.equal((await signal(`/signal/peerjs?id=phonecam-v2-${ROOM}`, { ...ws, origin: 'https://evil.example' })).status, 403, 'other site')
  assert.equal((await signal(`/signal/peerjs?id=phonecam-v2-${ROOM}`, ws)).status, 403, 'no origin')
  assert.equal((await signal('/signal/peerjs?id=phonecam-v1-amber-pine-1', { ...ws, origin: SITE })).status, 400, 'old protocol id')
  assert.equal(await (await signal(`/signal/peerjs?id=phonecam-v2-${ROOM}`, { ...ws, origin: 'https://meet.google.com' })).text(), 'room', 'meeting sites are allowed')
  const missing = await worker.fetch(new Request(`${SITE}/signal/peerjs?id=phonecam-v2-${ROOM}`, { headers: { ...ws, origin: SITE } }), env())
  assert.equal(missing.status, 503, 'no Durable Object binding')
})

test('TURN credentials: allowed origins only, and none without secrets', async () => {
  const ok = await get('/api/turn', { origin: SITE })
  assert.equal(ok.status, 200)
  assert.deepEqual(await ok.json(), { iceServers: null })
  assert.equal(ok.headers.get('access-control-allow-origin'), SITE)
  assert.equal((await get('/api/turn', { origin: 'https://evil.example' })).status, 403)
  const zoom = await get('/api/turn', { origin: 'https://us05web.zoom.us' })
  assert.equal(zoom.headers.get('access-control-allow-origin'), 'https://us05web.zoom.us')
})

test('TURN credentials drop the port 53 urls browsers block', async () => {
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    iceServers: [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] }, { urls: ['turn:turn.cloudflare.com:53?transport=udp', 'turn:turn.cloudflare.com:3478?transport=udp'], username: 'u', credential: 'c' }]
  }), { status: 201 })
  try {
    const response = await worker.fetch(new Request(`${SITE}/api/turn`, { headers: { origin: SITE } }), env({ TURN_KEY_ID: 'id', TURN_KEY_API_TOKEN: 'token' }))
    const data = await response.json()
    const urls = data.iceServers.flatMap((server) => server.urls)
    assert.ok(urls.length === 2 && urls.every((url) => !/:53(\?|$)/.test(url)), urls.join(' '))
    assert.equal(data.iceServers[1].username, 'u')
  } finally {
    globalThis.fetch = realFetch
  }
})

test('ratings: hidden until the database exists', async () => {
  assert.equal((await get('/api/feedback')).status, 503)
})

test('ratings: summary returns average, count and approved comments', async () => {
  const response = await worker.fetch(new Request(`${SITE}/api/feedback`), env({ DB: fakeDb() }))
  const data = await response.json()
  assert.equal(data.count, 2)
  assert.equal(data.average, 4.5)
  assert.deepEqual(data.testimonials[0], { rating: 5, comment: 'Great', name: 'PhoneCam user', date: '2026-10-24' })
})

test('ratings: only from the PhoneCam site, as JSON, with a 1-5 rating', async () => {
  assert.equal((await post({ rating: 5 }, { origin: null })).status, 403)
  assert.equal((await post({ rating: 5 }, { origin: 'https://evil.example' })).status, 403)
  for (const rating of [0, 6, 4.5, '5', null]) {
    assert.equal((await post({ rating })).status, 400, `rating ${rating}`)
  }
})

test('ratings: stores trimmed text, never the visitor address', async () => {
  const db = fakeDb()
  const response = await post({ rating: 4, comment: '  Works  well \u0007 ', name: 'Sam\nO', publicOk: true }, { db, ip: '9.9.9.9' })
  assert.equal(response.status, 201)
  const [rating, comment, name, publicOk, visitor] = db.inserts[0].args
  assert.equal(rating, 4)
  assert.equal(comment, 'Works  well')
  assert.equal(name, 'Sam O')
  assert.equal(publicOk, 1)
  assert.match(visitor, /^[0-9a-f]{64}$/)
  assert.ok(!visitor.includes('9.9.9.9'))
})

test('ratings: "show on site" needs a comment; long text is cut', async () => {
  const db = fakeDb()
  await post({ rating: 3, comment: '', publicOk: true }, { db })
  assert.equal(db.inserts[0].args[3], 0)
  await post({ rating: 3, comment: 'x'.repeat(900), name: 'y'.repeat(90) }, { db, ip: '5.5.5.5' })
  assert.equal(db.inserts[1].args[1].length, 500)
  assert.equal(db.inserts[1].args[2].length, 40)
})

test('ratings: bots that fill the hidden field are ignored', async () => {
  const db = fakeDb()
  const response = await post({ rating: 1, website: 'spam.example' }, { db })
  assert.equal(response.status, 200)
  assert.equal(db.inserts.length, 0)
})

test('ratings: one per visitor per day', async () => {
  const response = await post({ rating: 5 }, { db: fakeDb({ unique: true }) })
  assert.equal(response.status, 429)
})

// ── Signalling Durable Object routing ────────────────────────────────────

function socket(id) {
  return { id, sent: [], send(data) { this.sent.push(JSON.parse(data)) }, deserializeAttachment: () => ({ id, token: 't' }) }
}

function room(...sockets) {
  return new SignalRoom({
    setWebSocketAutoResponse() {},
    getWebSockets: (tag) => (tag ? sockets.filter((s) => s.id === tag) : sockets)
  })
}

const LAPTOP = `phonecam-v2-${ROOM}`
const PHONE = `phonecam-v2-${ROOM}-pabcdefgh`

test('ratings: the table is created on first use', async () => {
  const db = fakeDb()
  await worker.fetch(new Request(`${SITE}/api/feedback`), env({ DB: db }))
  await worker.fetch(new Request(`${SITE}/api/feedback`), env({ DB: db }))
  assert.deepEqual(db.batches, [2], 'once per database, both statements')
})

test('a missing page gets the 404 page, with the joke matched to the path', async () => {
  const missing = { fetch: async () => new Response('nope', { status: 404 }) }
  const response = await worker.fetch(new Request(`${SITE}/admin`), { ASSETS: missing })
  assert.equal(response.status, 404)
  assert.match(response.headers.get('content-type'), /text\/html/)
  assert.match(response.headers.get('content-security-policy'), /script-src 'nonce-/)
  const html = await response.text()
  assert.match(html, /wrong place, bro/)
  assert.match(html, /<meta name="robots" content="noindex">/)
  const head = await worker.fetch(new Request(`${SITE}/admin`, { method: 'HEAD' }), { ASSETS: missing })
  assert.equal(head.status, 404)

  assert.equal(kindOf('/admin'), 'admin')
  assert.equal(kindOf('/login'), 'admin')
  assert.equal(kindOf('/.env'), 'secrets')
  assert.equal(kindOf('/.git/config'), 'secrets')
  assert.equal(kindOf('/db.sql'), 'secrets')
  assert.equal(kindOf('/wp-login.php'), 'wordpress')
  assert.equal(kindOf('/xmlrpc.php'), 'wordpress')
  assert.equal(kindOf('/webcamm'), 'lost')
})

test('the 404 page never echoes the path as HTML', () => {
  const html = notFoundPage('/<script>alert(1)</script>"onmouseover=', 'n0nce')
  assert.ok(!html.includes('<script>alert(1)'))
  assert.match(html, /&lt;script&gt;alert\(1\)/)
})

test('there is no admin API on the public site', async () => {
  for (const method of ['GET', 'POST']) {
    const response = await worker.fetch(new Request(`${SITE}/api/admin/feedback`, { method, headers: { authorization: 'Bearer x' } }), env({ DB: fakeDb(), ADMIN_TOKEN: 'x' }))
    assert.equal(response.status, 404, method)
  }
})

test('signalling relays offers inside a room, tagged with the sender', () => {
  const laptop = socket(LAPTOP)
  const phone = socket(PHONE)
  room(laptop, phone).webSocketMessage(phone, JSON.stringify({ type: 'OFFER', dst: LAPTOP, payload: { sdp: 'x' } }))
  assert.deepEqual(laptop.sent[0], { type: 'OFFER', src: PHONE, dst: LAPTOP, payload: { sdp: 'x' } })
})

test('signalling never relays to another room', () => {
  const phone = socket(PHONE)
  const other = socket('phonecam-v2-zzzzzzzzzzzzzzzz')
  room(phone, other).webSocketMessage(phone, JSON.stringify({ type: 'OFFER', dst: 'phonecam-v2-zzzzzzzzzzzzzzzz', payload: {} }))
  assert.equal(other.sent.length, 0)
})

test('an offer to someone offline comes back as EXPIRE', () => {
  const phone = socket(PHONE)
  room(phone).webSocketMessage(phone, JSON.stringify({ type: 'OFFER', dst: LAPTOP, payload: {} }))
  assert.deepEqual(phone.sent[0], { type: 'EXPIRE', src: LAPTOP, dst: PHONE })
})

test('signalling ignores junk, unknown types and oversized messages', () => {
  const laptop = socket(LAPTOP)
  const phone = socket(PHONE)
  const r = room(laptop, phone)
  r.webSocketMessage(phone, 'not json')
  r.webSocketMessage(phone, JSON.stringify({ type: 'OPEN', dst: LAPTOP }))
  r.webSocketMessage(phone, JSON.stringify({ type: 'OFFER', dst: PHONE }))
  r.webSocketMessage(phone, JSON.stringify({ type: 'OFFER', dst: LAPTOP, payload: 'x'.repeat(40000) }))
  assert.equal(laptop.sent.length + phone.sent.length, 0)
})

// ---- Problem reports (/api/report) ----

const { buildMime, validEmail } = await import('../../worker/report.js')

function fakeMail({ fail = false } = {}) {
  const sent = []
  return { sent, async send(message) { if (fail) throw new Error('not verified'); sent.push(message) } }
}

function report(body, { origin = SITE, mail = fakeMail(), to = 'owner@example.com', type = 'application/json' } = {}) {
  const headers = { 'content-type': type, 'cf-connecting-ip': '1.2.3.4' }
  if (origin) headers.origin = origin
  const extra = mail ? { REPORT_MAIL: mail, REPORT_TO: to } : {}
  return worker.fetch(new Request(`${SITE}/api/report`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }), env(extra))
}

const decode = (raw) => Buffer.from(raw.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8')

test('reports: emailed to the owner with the details, and the sender gets a reference', async () => {
  const mail = fakeMail()
  const response = await report({ message: 'The picture froze after 2 minutes in Meet.', email: 'sam@example.com', way: 'extension', details: 'Chrome 141 on Windows' }, { mail })
  assert.equal(response.status, 201)
  const data = await response.json()
  assert.equal(data.ok, true)
  assert.match(data.id, /^[0-9a-f]{8}$/)
  assert.equal(mail.sent.length, 1)
  const { from, to, raw } = mail.sent[0]
  assert.equal(from, 'reports@phonecam.app')
  assert.equal(to, 'owner@example.com')
  assert.match(raw, /^Reply-To: <sam@example\.com>$/m)
  assert.match(raw, /^Subject: PhoneCam report: The picture froze/m)
  assert.match(raw, /^Message-ID: <[0-9a-f-]+@phonecam\.app>$/m)
  const text = decode(raw)
  assert.match(text, /froze after 2 minutes/)
  assert.match(text, /Way in: Browser extension/)
  assert.match(text, /Device: Chrome 141 on Windows/)
  assert.ok(!text.includes('1.2.3.4'), 'the network address is never sent')
})

test('reports: only from the PhoneCam site, as JSON, with a real message', async () => {
  assert.equal((await report({ message: 'Long enough message' }, { origin: 'https://evil.example' })).status, 403)
  assert.equal((await report({ message: 'Long enough message' }, { origin: null })).status, 403)
  assert.equal((await report('message=hi', { type: 'text/plain' })).status, 415)
  assert.equal((await report('{nope')).status, 400)
  assert.equal((await report({ message: 'short' })).status, 400)
  const get = await worker.fetch(new Request(`${SITE}/api/report`), env())
  assert.equal(get.status, 405)
})

test('reports: a bad email is refused and header injection is impossible', async () => {
  assert.equal((await report({ message: 'Long enough message', email: 'not-an-email' })).status, 400)
  assert.equal((await report({ message: 'Long enough message', email: 'a@b.com\r\nBcc: x@y.com' })).status, 400)
  assert.equal(validEmail('sam@example.com'), true)
  assert.equal(validEmail('sam@example.com>, x@y.com'), false)
  const raw = buildMime({ to: 'o@e.com', replyTo: '', subject: 'Line one\r\nBcc: x@y.com', body: 'hi', id: 'abc' })
  assert.ok(!/^Bcc:/m.test(raw))
  assert.ok(!/^Reply-To:/m.test(raw))
})

test('reports: non-ASCII subjects are encoded', () => {
  const raw = buildMime({ to: 'o@e.com', replyTo: '', subject: 'Caméra figée', body: 'é', id: 'abc' })
  assert.match(raw, /^Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/m)
})

test('reports: bots that fill the hidden field are ignored, nothing is sent', async () => {
  const mail = fakeMail()
  const response = await report({ message: 'Buy cheap things now!!', website: 'spam.example' }, { mail })
  assert.equal(response.status, 201)
  assert.equal(mail.sent.length, 0)
})

test('reports: without email set up, or if sending fails, the visitor is told where to write', async () => {
  const off = await report({ message: 'Long enough message' }, { mail: null })
  assert.equal(off.status, 503)
  assert.equal((await off.json()).fallback, 'hello@phonecam.app')
  const failed = await report({ message: 'Long enough message' }, { mail: fakeMail({ fail: true }) })
  assert.equal(failed.status, 502)
  assert.equal((await failed.json()).fallback, 'hello@phonecam.app')
})
