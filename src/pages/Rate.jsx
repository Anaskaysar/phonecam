import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav.jsx'
import SiteFooter from '../components/SiteFooter.jsx'
import { StarPicker } from '../components/Stars.jsx'
import { sendFeedback } from '../lib/feedback.js'

export default function Rate() {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [name, setName] = useState('')
  const [publicOk, setPublicOk] = useState(false)
  const [website, setWebsite] = useState('')
  const [state, setState] = useState({ sending: false, done: false, error: '' })

  useEffect(() => {
    document.title = 'Rate PhoneCam'
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (!rating) {
      setState({ sending: false, done: false, error: 'Pick a rating from 1 to 5 stars.' })
      return
    }
    setState({ sending: true, done: false, error: '' })
    const result = await sendFeedback({ rating, comment, name, publicOk, website })
    setState({ sending: false, done: result.ok, error: result.ok ? '' : result.message })
  }

  return (
    <div className="lp page-shell">
      <SiteNav />
      <main className="page-main">
      <div className="home-inner rate">
        {state.done ? (
          <section className="rate-card" role="status">
            <h1>Thank you!</h1>
            <p className="lede">Your rating helps other people find PhoneCam and helps us decide what to fix next.</p>
            {publicOk && comment.trim() ? <p className="fine">Your comment will appear on the website after a quick check.</p> : null}
            <div className="row-actions">
              <Link className="primary button-link" to="/">Back to PhoneCam</Link>
            </div>
          </section>
        ) : (
          <form className="rate-card" onSubmit={submit} noValidate>
            <h1>How is PhoneCam working for you?</h1>
            <StarPicker value={rating} onChange={setRating} />
            <label className="field">
              <span>What should we know? (optional)</span>
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} rows={4} placeholder="What worked, what didn't, which phone and meeting app you used…" />
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
            {state.error ? <p className="warn" role="alert">{state.error}</p> : null}
            <div className="row-actions">
              <button type="submit" className="primary" disabled={state.sending}>{state.sending ? 'Sending…' : 'Send rating'}</button>
              <Link className="secondary button-link" to="/">Cancel</Link>
            </div>
            <p className="fine">We store your rating, your comment and name if you add them, and the date. Comments only appear on the site if you tick the box above and after we read them. <a href="privacy.html">Privacy</a></p>
          </form>
        )}
      </div>
      </main>
      <SiteFooter />
    </div>
  )
}
