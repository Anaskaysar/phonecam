/* Talks to /api/visits. Shared with public/help.js through the same storage keys and event. */

export const VISITS_EVENT = 'phonecam:visits'
const LIVE_KEY = 'pc.live'

// A random id for this tab, so "Live now" counts tabs, not requests. Never sent anywhere else.
export function liveId() {
  try {
    let id = sessionStorage.getItem(LIVE_KEY)
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, '')
      sessionStorage.setItem(LIVE_KEY, id)
    }
    return id
  } catch {
    return (window.__pcLiveId ||= crypto.randomUUID().replace(/-/g, ''))
  }
}

export function validVisits(data) {
  return Boolean(data && typeof data.total === 'number' && Array.isArray(data.countries))
}

async function call(path, init) {
  try {
    const response = await fetch(path, { ...init, headers: { accept: 'application/json', ...(init?.headers || {}) } })
    if (!response.ok) return null
    const data = await response.json()
    return validVisits(data) ? data : null
  } catch {
    return null
  }
}

export const loadVisits = () => call('/api/visits')

export const checkIn = () => call('/api/visits/live', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ id: liveId() })
})
