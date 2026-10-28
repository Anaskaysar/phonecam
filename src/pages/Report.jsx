import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SiteNav from '../components/SiteNav.jsx'
import SiteFooter from '../components/SiteFooter.jsx'
import { SUPPORT_EMAIL, deviceSummary, sendReport } from '../lib/report.js'

const MAX = 2000
const WAYS = [
  ['unsure', 'Not sure'],
  ['extension', 'Browser extension'],
  ['share', 'Share a tab'],
  ['obs', 'OBS'],
  ['camera', 'Phone camera page']
]

export default function Report() {
  const device = useMemo(() => deviceSummary(), [])
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [way, setWay] = useState('unsure')
  const [includeDevice, setIncludeDevice] = useState(true)
  const [website, setWebsite] = useState('')
  const [state, setState] = useState({ sending: false, done: false, id: '', error: '', fallback: '' })

  useEffect(() => {
    document.title = 'Report an issue · PhoneCam'
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (message.trim().length < 10) {
      setState({ sending: false, done: false, id: '', error: 'Tell us a little more about what happened.', fallback: '' })
      return
    }
    setState({ sending: true, done: false, id: '', error: '', fallback: '' })
    const result = await sendReport({ message, email: email.trim(), way, details: includeDevice ? device : '', website })
    setState({ sending: false, done: result.ok, id: result.id || '', error: result.ok ? '' : result.message, fallback: result.fallback || '' })
  }

  function reset() {
    setMessage('')
    setState({ sending: false, done: false, id: '', error: '', fallback: '' })
  }

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('PhoneCam issue')}&body=${encodeURIComponent(`${message}\n\n${includeDevice ? device : ''}`)}`

  return (
    <div className="lp page-shell">
      <SiteNav />
      <main className="page-main">
      <div className="home-inner rate">
        {state.done ? (
          <section className="rate-card report-done" role="status" aria-live="polite">
            <span className="report-tick" aria-hidden="true">✓</span>
            <h1>Report sent</h1>
            <p className="lede">Thanks for telling us. It’s in our inbox now{state.id ? <> (reference <strong>{state.id}</strong>)</> : null}.</p>
            {email.trim()
              ? <p className="fine">We’ll reply to <strong>{email.trim()}</strong>, usually within two working days.</p>
              : <p className="fine">You didn’t leave an email, so we can’t reply, but we read every report.</p>}
            <div className="row-actions">
              <Link className="primary button-link" to="/">Back to PhoneCam</Link>
              <button type="button" className="secondary" onClick={reset}>Send another</button>
            </div>
          </section>
        ) : (
          <form className="rate-card" onSubmit={submit} noValidate>
            <h1>Report an issue</h1>
            <p className="lede">Tell us what went wrong. It goes straight to the person who builds PhoneCam.</p>
            <label className="field">
              <span>What happened?</span>
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={MAX} rows={6} required placeholder="What you did, what you expected, and what you saw instead…" />
              <small className="counter">{message.length}/{MAX}</small>
            </label>
            <label className="field">
              <span>How were you using PhoneCam?</span>
              <select value={way} onChange={(event) => setWay(event.target.value)}>
                {WAYS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Your email (optional, so we can reply)</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={120} autoComplete="email" inputMode="email" placeholder="you@example.com" />
            </label>
            <label className="check">
              <input type="checkbox" checked={includeDevice} onChange={(event) => setIncludeDevice(event.target.checked)} />
              <span>Include my browser and device details<small className="report-device">{device.split(' · ').slice(0, 2).join(' · ')}</small></span>
            </label>
            <label className="honeypot" aria-hidden="true">
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
            </label>
            {state.error ? (
              <p className="warn" role="alert">
                {state.error}
                {state.fallback ? <> You can also <a href={mailto}>email {state.fallback}</a>.</> : null}
              </p>
            ) : null}
            <div className="row-actions">
              <button type="submit" className="primary" disabled={state.sending}>{state.sending ? 'Sending…' : 'Send report'}</button>
              <Link className="secondary button-link" to="/">Cancel</Link>
            </div>
            <p className="fine">Please don’t include pairing codes or QR codes; we never need them. We only use your email to reply. <a href="privacy.html">Privacy</a></p>
          </form>
        )}
      </div>
      </main>
      <SiteFooter />
    </div>
  )
}
