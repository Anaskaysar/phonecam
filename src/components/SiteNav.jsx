import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useInstallPrompt } from '../lib/platform.js'

const LINKS = [
  { to: '/?section=how', label: 'How it works', match: (path, query) => path === '/' && query.get('section') === 'how' },
  { to: '/receiver?mode=meeting', label: 'Browser extension', match: (path, query) => path === '/receiver' && query.get('mode') === 'meeting' },
  { to: '/receiver', label: 'Receiver', match: (path, query) => path === '/receiver' && query.get('mode') !== 'meeting' },
  { to: '/camera', label: 'Phone camera', match: (path) => path === '/camera' }
]

function isPhone() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse) and (max-width: 820px)').matches
}

/*
  Site navigation for the home, receiver, check and rate pages.
  showCta: hide the "Get started" button where the page already has one (the home hero).
*/
export default function SiteNav({ showCta = true, edition = null }) {
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const [open, setOpen] = useState(false)
  const [phone] = useState(isPhone)
  const { canInstall, install } = useInstallPrompt()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const cta = phone
    ? { to: '/camera', label: 'Open camera' }
    : { to: '/receiver', label: 'Get started' }

  return (
    <header className={open ? 'site-nav open' : 'site-nav'}>
      <div className="site-nav-bar">
        <Logo to="/" />
        <nav className="site-nav-links" aria-label="Main">
          {LINKS.map((link) => {
            const current = link.match(location.pathname, query)
            return (
              <Link key={link.label} to={link.to} className={current ? 'on' : ''} aria-current={current ? 'page' : undefined}>
                {link.label}
              </Link>
            )
          })}
        </nav>
        <div className="site-nav-actions">
          {edition ? (
            <div className="site-nav-color">
              <span className="site-nav-edition">{edition.mode === 'frozen' ? 'Black & white' : edition.name}</span>
              <button
                type="button"
                className="lp-btn"
                onClick={edition.mode === 'frozen' ? edition.unfreeze : edition.freeze}
              >
                {edition.mode === 'frozen' ? 'Use color' : 'Black & white'}
              </button>
            </div>
          ) : null}
          {canInstall ? <button type="button" className="lp-btn" onClick={install}>Install app</button> : null}
          {showCta ? <Link to={cta.to} className="lp-btn primary site-nav-cta">{cta.label}</Link> : null}
          <button
            type="button"
            className="site-nav-toggle"
            aria-expanded={open}
            aria-controls="site-nav-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      {open ? (
        <nav id="site-nav-menu" className="site-nav-menu" aria-label="Main">
          {LINKS.map((link) => {
            const current = link.match(location.pathname, query)
            return (
              <Link key={link.label} to={link.to} className={current ? 'on' : ''} aria-current={current ? 'page' : undefined}>
                {link.label}
              </Link>
            )
          })}
          <Link to={cta.to} className="lp-btn primary">{cta.label}</Link>
        </nav>
      ) : null}
    </header>
  )
}
