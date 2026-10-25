/*
  One running total, plus a count per country. Cloudflare tells us the country
  on the request. We do not store an address, a page, or a time. The browser
  remembers that it already counted, so a refresh does not add the same person.
*/

const SKIP = new Set(['XX', 'T1', 'A1', 'A2', 'O1', 'AP', 'EU'])

export function countryOf(request) {
  const raw = (request.cf && request.cf.country) || request.headers.get('cf-ipcountry') || ''
  const code = String(raw).trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code) || SKIP.has(code)) return ''
  return code
}

function list(countries) {
  return Object.entries(countries)
    .filter(([code, count]) => /^[A-Z]{2}$/.test(code) && count > 0)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, 24)
}

export class VisitCounter {
  constructor(state) {
    this.storage = state.storage
  }

  async fetch(request) {
    let total = Number(await this.storage.get('total')) || 0
    const stored = await this.storage.get('countries')
    const countries = stored && typeof stored === 'object' ? { ...stored } : {}
    if (request.method === 'POST') {
      total += 1
      const code = countryOf(request)
      if (code) countries[code] = (Number(countries[code]) || 0) + 1
      await this.storage.put('total', total)
      await this.storage.put('countries', countries)
    }
    return new Response(JSON.stringify({ total, countries: list(countries) }), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      }
    })
  }
}
