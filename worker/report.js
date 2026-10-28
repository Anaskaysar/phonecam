/*
  POST /api/report  { message, email?, way?, details?, website? }

  Emails a problem report to you through Cloudflare Email Routing (free).
  Needs the send_email binding REPORT_MAIL and the REPORT_TO variable in
  wrangler.toml. REPORT_TO must be a destination address you verified in
  Email Routing. Until both exist the endpoint answers 503 and the form
  tells the visitor to email hello@phonecam.app instead.
*/

export const MAX_MESSAGE = 2000
const MIN_MESSAGE = 10
const MAX_DETAILS = 600
const MAX_EMAIL = 120
const PER_DAY = 5
const FROM = 'reports@phonecam.app'
const WAYS = { extension: 'Browser extension', share: 'Share a tab', obs: 'OBS', camera: 'Phone camera page', unsure: 'Not sure' }

function clean(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
    .slice(0, max)
}

// A plain address with no spaces, line breaks or angle brackets, so it is safe in a header.
export function validEmail(value) {
  return value.length <= MAX_EMAIL && /^[^\s@<>"(),;:\\[\]]+@[^\s@<>"(),;:\\[\]]+\.[a-z]{2,}$/i.test(value)
}

function base64(text) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function wrap(text) {
  return text.match(/.{1,76}/g)?.join('\r\n') ?? ''
}

// Header text with non-ASCII characters, encoded so mail clients show it correctly.
function headerText(text) {
  const plain = text.replace(/[\r\n]+/g, ' ')
  return /^[\x20-\x7e]*$/.test(plain) ? plain : `=?UTF-8?B?${base64(plain)}?=`
}

export function buildMime({ to, replyTo, subject, body, id }) {
  const lines = [
    `From: ${headerText('PhoneCam reports')} <${FROM}>`,
    `To: <${to}>`,
    replyTo ? `Reply-To: <${replyTo}>` : null,
    `Subject: ${headerText(subject)}`,
    `Message-ID: <${id}@phonecam.app>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(base64(body))
  ]
  return lines.filter((line) => line !== null).join('\r\n')
}

async function emailMessage(from, to, raw) {
  try {
    const { EmailMessage } = await import('cloudflare:email')
    return new EmailMessage(from, to, raw)
  } catch {
    // Outside Cloudflare (unit tests) there is no cloudflare:email module.
    return { from, to, raw }
  }
}

async function hash(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

// At most PER_DAY reports per network address per day. Uses the free edge cache,
// so it is a soft limit, and the address itself is never stored, only a hash.
async function overLimit(request, salt) {
  const cache = globalThis.caches?.default
  if (!cache) return false
  const address = request.headers.get('cf-connecting-ip') || 'unknown'
  const day = new Date().toISOString().slice(0, 10)
  const key = new Request(`https://phonecam.app/__report-limit/${await hash(`${salt}|report|${address}|${day}`)}`)
  const hit = await cache.match(key)
  const count = hit ? Number(await hit.text()) || 0 : 0
  if (count >= PER_DAY) return true
  await cache.put(key, new Response(String(count + 1), { headers: { 'cache-control': 'max-age=86400' } }))
  return false
}

export async function report(request, env, json) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { allow: 'POST' })
  const origin = request.headers.get('origin')
  if (!origin || new URL(origin).host !== new URL(request.url).host) {
    return json({ error: 'Send reports from the PhoneCam site.' }, 403)
  }
  if (!(request.headers.get('content-type') || '').includes('application/json')) {
    return json({ error: 'Expected JSON.' }, 415)
  }
  if (Number(request.headers.get('content-length') || 0) > 8000) return json({ error: 'That is too long.' }, 413)

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Expected JSON.' }, 400)
  }

  // Bots fill in every field, including this hidden one. Pretend it worked.
  if (body?.website) return json({ ok: true }, 201)

  const message = clean(body?.message, MAX_MESSAGE)
  if (message.length < MIN_MESSAGE) return json({ error: 'Tell us a little more about what happened.' }, 400)
  const email = clean(body?.email, MAX_EMAIL).replace(/\s/g, '')
  if (email && !validEmail(email)) return json({ error: 'That email address doesn’t look right.' }, 400)
  const way = WAYS[body?.way] || WAYS.unsure
  const details = clean(body?.details, MAX_DETAILS)

  if (!env.REPORT_MAIL || !env.REPORT_TO) {
    return json({ error: 'Reports can’t be sent from the site right now.', fallback: 'hello@phonecam.app' }, 503)
  }
  if (await overLimit(request, env.FEEDBACK_SALT || 'phonecam')) {
    return json({ error: 'You’ve sent several reports today. Thank you! Email hello@phonecam.app if it’s urgent.' }, 429)
  }

  const id = crypto.randomUUID()
  const text = [
    message,
    '',
    '---',
    `Way in: ${way}`,
    `Reply to: ${email || '(no email given)'}`,
    details ? `Device: ${details}` : null,
    `Country: ${request.cf?.country || 'unknown'}`,
    `Sent: ${new Date().toISOString()}`,
    `Report id: ${id}`
  ].filter((line) => line !== null).join('\n')
  const subject = `PhoneCam report: ${message.split('\n')[0].slice(0, 60)}`

  try {
    const raw = buildMime({ to: env.REPORT_TO, replyTo: email, subject, body: text, id })
    await env.REPORT_MAIL.send(await emailMessage(FROM, env.REPORT_TO, raw))
  } catch {
    return json({ error: 'Your report couldn’t be sent. Try again in a minute.', fallback: 'hello@phonecam.app' }, 502)
  }
  return json({ ok: true, id: id.slice(0, 8) }, 201)
}
