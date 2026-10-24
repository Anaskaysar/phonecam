import { Link } from 'react-router-dom'

export default function Logo({ to }) {
  const mark = (
    <>
      <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#dff25a" />
        <circle cx="16" cy="16" r="6.5" fill="#161a04" />
        <circle cx="23.5" cy="9.5" r="1.7" fill="#161a04" />
      </svg>
      PhoneCam
    </>
  )
  if (to) {
    return <Link to={to} className="brand" aria-label="PhoneCam home">{mark}</Link>
  }
  return <span className="brand">{mark}</span>
}
