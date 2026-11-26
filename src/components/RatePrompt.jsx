import { useEffect, useState } from 'react'
import { StarPicker } from './Stars.jsx'
import { sendFeedback } from '../lib/feedback.js'
import { readStorage, writeStorage } from '../lib/room.js'

const DAY_KEY = 'pc.rate.day'

function today() {
  return new Date().toISOString().slice(0, 10)
}

/* True after they rated or chose Not now today. One ask per day. */
export function rateAskedToday() {
  return readStorage(DAY_KEY) === today()
}

function rememberAsk() {
  writeStorage(DAY_KEY, today())
}

/* Shown on the phone after Stop, once a session has actually gone live. */
export default function RatePrompt({ onClose }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [publicOk, setPublicOk] = useState(false)
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  function dismiss() {
    rememberAsk()
    onClose()
  }

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') done ? onClose() : dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, onClose])

  async function submit(event) {
    event.preventDefault()
    if (!rating) {
      setError('Pick a rating from 1 to 5 stars.')
      return
    }
    setSending(true)
    setError('')
    const result = await sendFeedback({ rating, comment, name, publicOk, website })
    setSending(false)
    if (result.ok || result.status === 429) {
      rememberAsk()
      setDone(true)
      return
    }
    setError(result.message)
  }

  return (
    <div
      className="sheet-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) done ? onClose() : dismiss()
      }}
    >
      <section className="sheet rate-sheet" role="dialog" aria-modal="true" aria-labelledby="rate-title">
        {done ? (
          <>
            <h2 id="rate-title">Thank you</h2>
            <p className="fine">Your rating helps us improve PhoneCam.</p>
            {publicOk && comment.trim() ? <p className="fine">We'll read your comment before it appears on the site.</p> : null}
            <div className="row-actions">
              <button type="button" className="primary" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <h2 id="rate-title">How was PhoneCam?</h2>
            <p className="fine">You just finished. A star rating takes a second, and a note tells us what to improve.</p>
            <StarPicker value={rating} onChange={setRating} />
            <label className="field">
              <span>What should we improve? (optional)</span>
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={3} placeholder="The picture, the sound, the setup, the app you used…" />
              <small className="counter">{comment.length}/500</small>
            </label>
            <label className="field">
              <span>Your name (optional)</span>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} autoComplete="given-name" placeholder="First name or initials" />
            </label>
            <label className="check">
              <input type="checkbox" checked={publicOk} onChange={(event) => setPublicOk(event.target.checked)} disabled={!comment.trim()} />
              <span>Show my comment and name on the PhoneCam website</span>
            </label>
            <label className="honeypot" aria-hidden="true">
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
            </label>
            {error ? <p className="warn" role="alert">{error}</p> : null}
            <div className="row-actions">
              <button type="submit" className="primary" disabled={sending}>{sending ? 'Sending…' : 'Send rating'}</button>
              <button type="button" className="secondary" onClick={dismiss}>Not now</button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
