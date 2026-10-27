/*
  PhoneCam admin, on your own computer only.

    node admin-local/server.mjs

  Opens http://127.0.0.1:4545 in your browser. Nothing here is on the internet:
  - The page and its little API listen on 127.0.0.1 only, so other devices on
    your Wi-Fi can't reach it.
  - Every API call needs a random key made fresh each time you start it, and the
    request must be addressed to 127.0.0.1, so a website you happen to have open
    can't use it behind your back.
  - The ratings are read and changed with Wrangler, using your own Cloudflare
    login (the one `npx wrangler login` saved on this Mac). PhoneCam's public
    site has no admin page or admin API at all.

  This folder is in .gitignore, so it never goes to GitHub.
  Test against the local test database instead: PHONECAM_ADMIN_LOCAL=1 node admin-local/server.mjs
*/
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const PORT = Number(process.env.PHONECAM_ADMIN_PORT || 4545)
const KEY = crypto.randomBytes(24).toString('hex')
const LOCAL = process.env.PHONECAM_ADMIN_LOCAL === '1'
const page = () => fs.readFileSync(path.join(here, 'index.html'))
const wranglerBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler')

const LIST_SQL = `SELECT id, rating, comment, name, public_ok, approved, created_at FROM feedback ORDER BY id DESC LIMIT 500;
SELECT COUNT(*) AS count, AVG(rating) AS average,
  SUM(CASE WHEN public_ok = 1 AND approved = 0 AND comment <> '' THEN 1 ELSE 0 END) AS waiting,
  SUM(CASE WHEN public_ok = 1 AND approved = 1 AND comment <> '' THEN 1 ELSE 0 END) AS shown,
  SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS s1, SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS s2,
  SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS s3, SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS s4,
  SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS s5
FROM feedback;`

// Only these three statements can ever run, and the id must be a whole number.
const ACTIONS = {
  approve: (id) => `UPDATE feedback SET approved = 1 WHERE id = ${id}`,
  hide: (id) => `UPDATE feedback SET approved = 0 WHERE id = ${id}`,
  delete: (id) => `DELETE FROM feedback WHERE id = ${id}`
}

function d1(sql) {
  const target = LOCAL
    ? ['--local', '--config', 'tests/e2e/wrangler.test.toml', '--persist-to', '.test-build/state']
    : ['--remote']
  return new Promise((resolve, reject) => {
    const child = spawn(wranglerBin, ['d1', 'execute', 'phonecam', ...target, '--json', '--command', sql], {
      cwd: root,
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', FORCE_COLOR: '0' }
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => { out += chunk })
    child.stderr.on('data', (chunk) => { err += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      const start = out.indexOf('[')
      try {
        const parsed = JSON.parse(out.slice(start))
        if (code !== 0 || !Array.isArray(parsed)) throw new Error('bad output')
        resolve(parsed)
      } catch {
        const text = `${err}\n${out}`
        if (/no such table: feedback/.test(text)) return resolve(null)
        if (/login|authenticat|not logged in/i.test(text)) return reject(new Error('Wrangler is not logged in on this computer. Run: npx wrangler login'))
        if (/Couldn't find a D1 DB|database_id|No D1 databases/i.test(text)) return reject(new Error('The ratings database is not set up yet. See README → Ratings and testimonials.'))
        reject(new Error(text.trim().split('\n').filter(Boolean).slice(-3).join(' ') || `wrangler exited with ${code}`))
      }
    })
  })
}

async function list() {
  const result = await d1(LIST_SQL)
  if (!result) return { count: 0, average: null, waiting: 0, shown: 0, stars: [0, 0, 0, 0, 0], items: [], empty: true }
  const rows = result[0]?.results || []
  const totals = result[1]?.results?.[0] || {}
  return {
    count: totals.count || 0,
    average: totals.average ? Math.round(totals.average * 10) / 10 : null,
    waiting: totals.waiting || 0,
    shown: totals.shown || 0,
    stars: [1, 2, 3, 4, 5].map((star) => totals[`s${star}`] || 0),
    items: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      name: row.name,
      publicOk: row.public_ok === 1,
      approved: row.approved === 1,
      createdAt: row.created_at
    })),
    source: LOCAL ? 'local test database' : 'phonecam.app (live)'
  }
}

function send(response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
  })
  response.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body))
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let data = ''
    request.on('data', (chunk) => {
      data += chunk
      if (data.length > 2000) {
        reject(new Error('Too long.'))
        request.destroy()
      }
    })
    request.on('end', () => resolve(data))
    request.on('error', reject)
  })
}

function sameKey(given) {
  const a = crypto.createHash('sha256').update(String(given || '')).digest()
  const b = crypto.createHash('sha256').update(KEY).digest()
  return crypto.timingSafeEqual(a, b)
}

const server = http.createServer(async (request, response) => {
  // Refuse anything not addressed to this computer by name (blocks DNS-rebinding tricks).
  const host = request.headers.host || ''
  if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) return send(response, 403, { error: 'Not allowed.' })
  const url = new URL(request.url, `http://${host}`)

  if (url.pathname === '/' && request.method === 'GET') return send(response, 200, page(), 'text/html; charset=utf-8')
  if (url.pathname !== '/api/feedback') return send(response, 404, { error: 'Not found.' })
  if (!sameKey(request.headers['x-admin-key'])) return send(response, 401, { error: 'This tab has an old key. Open the link the admin tool printed when it started.' })

  try {
    if (request.method === 'GET') return send(response, 200, await list())
    if (request.method === 'POST') {
      if (!(request.headers['content-type'] || '').includes('application/json')) return send(response, 415, { error: 'Expected JSON.' })
      const body = JSON.parse(await readBody(request))
      const id = body?.id
      const action = ACTIONS[body?.action]
      if (!Number.isInteger(id) || id < 1 || !action) return send(response, 400, { error: 'Unknown rating or action.' })
      await d1(action(id))
      return send(response, 200, { ok: true })
    }
    return send(response, 405, { error: 'Method not allowed.' })
  } catch (error) {
    return send(response, 500, { error: error.message || 'Something went wrong.' })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  const link = `http://127.0.0.1:${PORT}/#key=${KEY}`
  console.log(`\nPhoneCam admin (${LOCAL ? 'local test database' : 'live ratings on phonecam.app'})`)
  console.log(`Open: ${link}`)
  console.log('Only this computer can open it. Press Ctrl+C to stop.\n')
  if (process.env.PHONECAM_ADMIN_NO_OPEN !== '1') {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
    try { spawn(opener, [link], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' }).unref() } catch { /* open it by hand */ }
  }
})
