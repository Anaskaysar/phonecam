/*
  Visitor counts for the "Around the world" panel.

  Stored (Durable Object storage):
    total      every browser that has opened PhoneCam
    countries  the same, per country
    hours      new browsers per UTC hour and country, last 24 hours only

  Kept in memory only, never stored:
    live       random tab ids that checked in during the last LIVE_MS, with a country

  Cloudflare tells us the country on the request. We never keep an address,
  a page, or anything that identifies a person. The browser remembers that it
  was already counted, so a refresh does not add the same person again.

    GET  /api/visits          the numbers, counts nothing
    POST /api/visits          counts one new browser, returns the numbers
    POST /api/visits/live     { id } marks this tab as here now, returns the numbers
*/

const SKIP = new Set(['XX', 'T1', 'A1', 'A2', 'O1', 'AP', 'EU'])
const HOUR = 60 * 60 * 1000
export const LIVE_MS = 150 * 1000
const MAX_LIVE = 2000
const MAX_COUNTRIES = 250

export function countryOf(request) {
  const raw = (request.cf && request.cf.country) || request.headers.get('cf-ipcountry') || ''
  const code = String(raw).trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code) || SKIP.has(code)) return ''
  return code
}

export function hourKey(time) {
  return new Date(time).toISOString().slice(0, 13)
}

function list(countries) {
  return Object.entries(countries)
    .filter(([code, count]) => /^[A-Z]{2}$/.test(code) && count > 0)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, MAX_COUNTRIES)
}

function add(into, code, count = 1) {
  const key = code || '?'
  into[key] = (Number(into[key]) || 0) + count
}

const sum = (counts) => Object.values(counts).reduce((total, count) => total + (Number(count) || 0), 0)

export class VisitCounter {
  constructor(state, _env, now = () => Date.now()) {
    this.storage = state.storage
    this.now = now
    this.live = new Map()
  }

  async read() {
    const [total, countries, hours] = await Promise.all([
      this.storage.get('total'),
      this.storage.get('countries'),
      this.storage.get('hours')
    ])
    return {
      total: Number(total) || 0,
      countries: countries && typeof countries === 'object' ? { ...countries } : {},
      hours: hours && typeof hours === 'object' ? { ...hours } : {}
    }
  }

  // Only the last 24 hours are kept.
  keys(now) {
    return Array.from({ length: 24 }, (_, index) => hourKey(now - (23 - index) * HOUR))
  }

  prune(now) {
    for (const [id, seen] of this.live) if (now - seen.at > LIVE_MS) this.live.delete(id)
  }

  body(data, now) {
    this.prune(now)
    const keys = this.keys(now)
    const day = {}
    for (const key of keys) for (const [code, count] of Object.entries(data.hours[key] || {})) add(day, code === '?' ? '' : code, count)
    const live = {}
    for (const seen of this.live.values()) add(live, seen.code)
    return {
      // total and countries stay at the top for older pages that read them.
      total: data.total,
      countries: list(data.countries),
      day: { total: sum(day), countries: list(day) },
      live: { total: this.live.size, countries: list(live) },
      hours: keys.map((key) => sum(data.hours[key] || {}))
    }
  }

  async fetch(request) {
    const now = this.now()
    const path = new URL(request.url).pathname
    const data = await this.read()

    if (request.method === 'POST' && path.endsWith('/live')) {
      let id = ''
      try { id = String((await request.json())?.id || '') } catch { id = '' }
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) return reply({ error: 'Bad id.' }, 400)
      this.prune(now)
      if (this.live.has(id) || this.live.size < MAX_LIVE) this.live.set(id, { code: countryOf(request), at: now })
    } else if (request.method === 'POST') {
      const code = countryOf(request)
      data.total += 1
      if (code) add(data.countries, code)
      const key = hourKey(now)
      const keep = new Set(this.keys(now))
      const hours = {}
      for (const [hour, counts] of Object.entries(data.hours)) if (keep.has(hour)) hours[hour] = counts
      hours[key] = { ...(hours[key] || {}) }
      add(hours[key], code)
      data.hours = hours
      await this.storage.put({ total: data.total, countries: data.countries, hours })
    }

    return reply(this.body(data, now))
  }
}

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  })
}
