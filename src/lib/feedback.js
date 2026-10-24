/* Talks to /api/feedback on the PhoneCam Worker. */

export async function loadFeedback() {
  try {
    const response = await fetch('/api/feedback', { headers: { accept: 'application/json' } })
    if (!response.ok) return null
    const data = await response.json()
    if (typeof data?.count !== 'number' || !Array.isArray(data.testimonials)) return null
    return data
  } catch {
    return null
  }
}

export async function sendFeedback({ rating, comment, name, publicOk, website }) {
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rating, comment, name, publicOk, website })
    })
    const data = await response.json().catch(() => ({}))
    if (response.ok) return { ok: true }
    return { ok: false, message: data.error || 'Could not send your rating. Try again later.' }
  } catch {
    return { ok: false, message: 'Could not reach PhoneCam. Check your connection and try again.' }
  }
}
