/*
  PhoneCam Worker.

  Serves the static site (env.ASSETS) and:
    /signal/peerjs      signalling WebSocket (PeerJS protocol), one Durable Object per room
    GET  /api/turn      short-lived TURN relay credentials from Cloudflare Realtime
    GET  /api/feedback  average rating, count, and approved public comments
    POST /api/feedback  { rating 1-5, comment?, name?, publicOk?, website? }
    GET  /api/visits    the visitor total, without counting this request
    POST /api/visits    count one new browser and return the total

  Ratings are stored in the D1 database bound as env.DB. Until that database
  is set up, the API answers 503 and the site hides the ratings section.
  TURN needs the TURN_KEY_ID and TURN_KEY_API_TOKEN secrets. Without them
  /api/turn returns no servers and connections use direct paths only.
*/

import { SignalRoom, roomOf } from './signal.js'
import { VisitCounter } from './visits.js'

export { SignalRoom, VisitCounter }

// Pages allowed to use the signalling server and TURN credentials: PhoneCam itself
// and the meeting sites the extension runs on. Browsers always send Origin on these requests.
const ORIGINS = [
  /^https:\/\/(www\.)?phonecam\.app$/,
  /^https:\/\/phonecam\.kaysarulanas2\.workers\.dev$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/meet\.google\.com$/,
  /^https:\/\/teams\.(microsoft\.com|live\.com|cloud\.microsoft)$/,
  /^https:\/\/([a-z0-9-]+\.)*zoom\.us$/,
  /^https:\/\/discord\.com$/,
  /^https:\/\/([a-z0-9-]+\.)*whereby\.com$/,
  /^https:\/\/meet\.jit\.si$/,
  /^https:\/\/([a-z0-9-]+\.)*webex\.com$/
]

function allowedOrigin(request) {
  const origin = request.headers.get('origin')
  return origin && ORIGINS.some((pattern) => pattern.test(origin)) ? origin : null
}

const TURN_TTL = 4 * 60 * 60

async function turn(request, env) {
  const origin = allowedOrigin(request)
  const headers = { 'cache-control': 'no-store', vary: 'Origin' }
  if (origin) headers['access-control-allow-origin'] = origin
  if (!origin && request.headers.get('origin')) return json({ error: 'Not allowed.' }, 403, headers)
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return json({ iceServers: null }, 200, headers)

  const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ ttl: TURN_TTL })
  })
  if (!response.ok) return json({ iceServers: null }, 200, headers)
  const data = await response.json()
  // Browsers block port 53, and trying it only slows the connection down.
  const iceServers = (data.iceServers || []).map((server) => ({
    ...server,
    urls: [].concat(server.urls).filter((url) => !/:53(\?|$)/.test(url))
  })).filter((server) => server.urls.length)
  return json({ iceServers, ttl: TURN_TTL }, 200, headers)
}

function signal(request, env) {
  if (request.headers.get('upgrade') !== 'websocket') return new Response('Expected a WebSocket.', { status: 426 })
  if (!allowedOrigin(request)) return new Response('Not allowed.', { status: 403 })
  if (!env.SIGNAL) return new Response('Signalling is not set up.', { status: 503 })
  const room = roomOf(new URL(request.url).searchParams.get('id'))
  if (!room) return new Response('Invalid id.', { status: 400 })
  return env.SIGNAL.get(env.SIGNAL.idFromName(room)).fetch(request)
}

const MAX_COMMENT = 500
const MAX_NAME = 40
const SHOWN = 12

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-content-type-options': 'nosniff',
      ...extra
    }
  })
}

function clean(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
    .slice(0, max)
}

async function visitorDay(request, salt) {
  const address = request.headers.get('cf-connecting-ip') || 'unknown'
  const day = new Date().toISOString().slice(0, 10)
  const bytes = new TextEncoder().encode(`${salt}|${address}|${day}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function summary(env) {
  const stats = await env.DB.prepare('SELECT COUNT(*) AS count, AVG(rating) AS average FROM feedback').first()
  const { results } = await env.DB.prepare(
    'SELECT rating, comment, name, created_at FROM feedback WHERE approved = 1 AND public_ok = 1 AND comment <> \'\' ORDER BY created_at DESC LIMIT ?'
  ).bind(SHOWN).all()
  return json(
    {
      count: stats?.count || 0,
      average: stats?.average ? Math.round(stats.average * 10) / 10 : null,
      testimonials: (results || []).map((row) => ({
        rating: row.rating,
        comment: row.comment,
        name: row.name || 'PhoneCam user',
        date: row.created_at.slice(0, 10)
      }))
    },
    200,
    { 'cache-control': 'public, max-age=300' }
  )
}

async function submit(request, env) {
  const origin = request.headers.get('origin')
  if (!origin || new URL(origin).host !== new URL(request.url).host) {
    return json({ error: 'Send feedback from the PhoneCam site.' }, 403)
  }
  if (!(request.headers.get('content-type') || '').includes('application/json')) {
    return json({ error: 'Expected JSON.' }, 415)
  }
  const length = Number(request.headers.get('content-length') || 0)
  if (length > 4000) return json({ error: 'That is too long.' }, 413)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Expected JSON.' }, 400)
  }

  // Bots fill in every field, including this hidden one.
  if (body.website) return json({ ok: true })

  const rating = body.rating
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ error: 'Pick a rating from 1 to 5 stars.' }, 400)
  }
  const comment = clean(body.comment, MAX_COMMENT)
  const name = clean(body.name, MAX_NAME).replace(/\n/g, ' ')
  const publicOk = body.publicOk === true && comment !== '' ? 1 : 0
  const key = await visitorDay(request, env.FEEDBACK_SALT || 'phonecam')

  try {
    await env.DB.prepare(
      'INSERT INTO feedback (rating, comment, name, public_ok, visitor_day) VALUES (?, ?, ?, ?, ?)'
    ).bind(rating, comment, name, publicOk, key).run()
  } catch (error) {
    if (String(error?.message || error).includes('UNIQUE')) {
      return json({ error: 'You already rated PhoneCam today. Thank you!' }, 429)
    }
    throw error
  }
  return json({ ok: true }, 201)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/api/visits') {
      if (!env.VISITS) return json({ error: 'Visits are not set up yet.' }, 503)
      if (request.method !== 'GET' && request.method !== 'POST') {
        return json({ error: 'Method not allowed.' }, 405, { allow: 'GET, POST' })
      }
      if (request.method === 'POST') {
        const origin = request.headers.get('origin')
        let sameSite = false
        try { sameSite = !!origin && new URL(origin).host === url.host } catch { sameSite = false }
        if (!sameSite) return json({ error: 'Not allowed.' }, 403)
      }
      try {
        return await env.VISITS.get(env.VISITS.idFromName('site')).fetch(request)
      } catch {
        return json({ error: 'Something went wrong. Try again later.' }, 500)
      }
    }

    if (url.pathname === '/api/feedback') {
      if (!env.DB) return json({ error: 'Ratings are not set up yet.' }, 503)
      try {
        if (request.method === 'GET') return await summary(env)
        if (request.method === 'POST') return await submit(request, env)
        return json({ error: 'Method not allowed.' }, 405, { allow: 'GET, POST' })
      } catch {
        return json({ error: 'Something went wrong. Try again later.' }, 500)
      }
    }

    if (url.pathname === '/signal/peerjs') return signal(request, env)

    if (url.pathname === '/api/turn') {
      if (request.method === 'OPTIONS') {
        const origin = allowedOrigin(request)
        return new Response(null, { status: origin ? 204 : 403, headers: origin ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET', vary: 'Origin' } : {} })
      }
      try {
        return await turn(request, env)
      } catch {
        return json({ iceServers: null }, 200, { 'cache-control': 'no-store' })
      }
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found.' }, 404)

    return env.ASSETS.fetch(request)
  }
}
