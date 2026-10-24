import { Link } from 'react-router-dom'

export default function Logo({ to }) {
  const mark = (
    <>
      <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" style={{ fill: 'var(--accent)' }} />
        <circle cx="16" cy="16" r="6.5" style={{ fill: 'var(--accent-ink)' }} />
        <circle cx="23.5" cy="9.5" r="1.7" style={{ fill: 'var(--accent-ink)' }} />
      </svg>
      PhoneCam
    </>
  )
  if (to) {
    return <Link to={to} className="brand" aria-label="PhoneCam home">{mark}</Link>
  }
  return <span className="brand">{mark}</span>
}
