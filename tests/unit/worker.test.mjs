// Unit tests for the Worker (worker/index.js, worker/signal.js). Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'

// Cloudflare runtime classes the Durable Object touches.
globalThis.WebSocketRequestResponsePair ??= class { constructor(request, response) { this.request = request; this.response = response } }

const { default: worker, SignalRoom, VisitCounter } = await import('../../worker/index.js')
const { countryOf } = await import('../../worker/visits.js')
const { roomOf } = await import('../../worker/signal.js')

const SITE = 'https://phonecam.app'
const ROOM = 'abcdefghijklmnop'

const assets = { fetch: async () => new Response('asset') }
const env = (extra = {}) => ({ ASSETS: assets, ...extra })
const get = (path, headers = {}) => worker.fetch(new Request(`${SITE}${path}`, { headers }), env())

// A tiny stand-in for the D1 database: records inserts, can be told to fail.
function fakeDb({ unique = false } = {}) {
  const inserts = []
  return {
    inserts,
    prepare(sql) {
      let args = []
      return {
        bind(...values) { args = values; return this },
        async run() {
          if (unique) throw new Error('D1_ERROR: UNIQUE constraint failed: feedback.visitor_day')
          inserts.push({ sql, args })
          return { success: true }
        },
        async first() { return { count: 2, average: 4.5 } },
        async all() { return { results: [{ rating: 5, comment: 'Great', name: '', created_at: '2026-10-24 10:00:00' }] } }
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
      put: async (key, value) => { stored.set(key, value) }
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
