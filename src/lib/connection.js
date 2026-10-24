/* global __PHONECAM_PEER__, __PHONECAM_API__ */

/*
  Where PhoneCam connects:
  - Signalling (the introduction between phone and laptop) goes to our own
    server at /signal/ on phonecam.app. The extension always uses phonecam.app.
  - Relay servers (TURN) come from /api/turn, so phones on mobile data or
    strict Wi-Fi can still reach the laptop.
  On localhost (development) PhoneCam falls back to the public PeerJS server,
  unless the build sets PHONECAM_PEER_SERVER / PHONECAM_API.
*/

const OWN_HOSTS = ['phonecam.app', 'www.phonecam.app', 'phonecam.kaysarulanas2.workers.dev']

function ownHost() {
  return typeof location !== 'undefined' && OWN_HOSTS.includes(location.hostname)
}

export function apiOrigin() {
  if (typeof __PHONECAM_API__ === 'string' && __PHONECAM_API__) return __PHONECAM_API__
  return ownHost() ? location.origin : ''
}

export function signalOptions() {
  if (typeof __PHONECAM_PEER__ === 'object' && __PHONECAM_PEER__) return { ...__PHONECAM_PEER__ }
  if (ownHost()) return { host: location.hostname, port: 443, secure: true, path: '/signal/' }
  return {}
}

let ice = { servers: null, expires: 0 }
let pending = null

/* TURN credentials expire, so they are fetched fresh and kept until shortly before they lapse. */
export async function iceServers() {
  const origin = apiOrigin()
  if (!origin) return null
  if (ice.servers && Date.now() < ice.expires) return ice.servers
  if (!pending) {
    pending = (async () => {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 4000)
        const response = await fetch(`${origin}/api/turn`, { signal: controller.signal, credentials: 'omit' })
        clearTimeout(timer)
        if (!response.ok) return null
        const data = await response.json()
        if (!Array.isArray(data?.iceServers) || !data.iceServers.length) return null
        const ttl = Number(data.ttl) || 3600
        ice = { servers: data.iceServers, expires: Date.now() + Math.max(60, ttl - 300) * 1000 }
        return ice.servers
      } catch {
        return null
      } finally {
        pending = null
      }
    })()
  }
  return pending
}

/* Options for new Peer(): our signalling server plus TURN when available. */
export async function connectionOptions() {
  const options = { debug: 0, ...signalOptions() }
  const servers = await iceServers()
  if (servers) options.config = { iceServers: servers, sdpSemantics: 'unified-plan' }
  return options
}
