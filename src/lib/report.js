/* Talks to /api/report on the PhoneCam Worker. */

export const SUPPORT_EMAIL = 'hello@phonecam.app'

export async function sendReport({ message, email, way, details, website }) {
  try {
    const response = await fetch('/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, email, way, details, website })
    })
    const data = await response.json().catch(() => ({}))
    if (response.ok) return { ok: true, id: data.id || '' }
    return { ok: false, message: data.error || 'Your report couldn’t be sent. Try again later.', fallback: data.fallback || '' }
  } catch {
    return { ok: false, message: 'Could not reach PhoneCam. Check your connection and try again.', fallback: SUPPORT_EMAIL }
  }
}

// Browser and system in plain words, for the "include my device details" box.
export function deviceSummary() {
  if (typeof navigator === 'undefined') return ''
  const ua = navigator.userAgent
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? (navigator.maxTouchPoints > 1 ? 'iPadOS' : 'macOS')
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux/.test(ua) ? 'Linux' : 'Unknown system'
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : 'Unknown browser'
  const version = (ua.match(/(?:Edg|OPR|Firefox|CriOS|Chrome|Version)\/(\d+)/) || [])[1]
  return `${browser}${version ? ` ${version}` : ''} on ${os} · ${window.screen.width}×${window.screen.height} · ${ua}`
}
