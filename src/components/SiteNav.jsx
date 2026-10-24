import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Logo from './Logo.jsx'
import { useInstallPrompt } from '../lib/platform.js'

// Same items as the static pages in scripts/pages.mjs. Keep the two in step.
const USE_LINKS = [
  { to: '/receiver', label: 'Receiver', note: 'Pair your phone and pick a way in', match: (path, query) => path === '/receiver' && query.get('mode') !== 'meeting' },
  { to: '/camera', label: 'Phone camera', note: 'Open this on your phone', match: (path) => path === '/camera' },
  { to: '/receiver?mode=meeting', label: 'Browser extension', note: 'PhoneCam in Meet, Teams and Zoom', match: (path, query) => path === '/receiver' && query.get('mode') === 'meeting' },
  { to: '/check', label: 'Check the extension', note: 'Preview what the meeting sees', match: (path) => path === '/check' }
]

// Guides and About are real pages outside the app (better for search), so they use <a href>.
const LEARN_LINKS = [
  { to: '/?section=how', label: 'How it works', match: (path, query) => path === '/' && query.get('section') === 'how' },
  { href: '/guides', label: 'Guides' },
  { href: '/about', label: 'About' }
]

function isPhone() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse) and (max-width: 820px)').matches
}

function NavItem({ item, current }) {
  const props = { className: current ? 'on' : '', 'aria-current': current ? 'page' : undefined }
  return item.href
    ? <a href={item.href} {...props}>{item.label}</a>
    : <Link to={item.to} {...props}>{item.label}</Link>
}

/*
  Site navigation for the home, receiver, check and rate pages.
  showCta: hide the "Get started" button where the page already has one (the home hero).
  edition: the home page's color edition controls, if any.
*/
export default function SiteNav({ showCta = true, edition = null }) {
  const location = useLocation()
  const query = new URLSearchParams(location.search)
  const [open, setOpen] = useState(false)
  const [dropOpen, setDropOpen] = useState(false)
  const [phone] = useState(isPhone)
  const dropRef = useRef(null)
  const { canInstall, install } = useInstallPrompt()
  const inUse = USE_LINKS.some((item) => item.match(location.pathname, query))

  useEffect(() => {
    setOpen(false)
    setDropOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!open && !dropOpen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setDropOpen(false)
      }
    }
    const onClick = (event) => {
      if (dropRef.current && !dropRef.current.contains(event.target)) setDropOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onClick)
    }
  }, [open, dropOpen])

  const cta = phone
    ? { to: '/camera', label: 'Open camera' }
    : { to: '/receiver', label: 'Get started' }

  return (
    <header className={open ? 'site-nav open' : 'site-nav'}>
      <div className="site-nav-bar">
        <Logo to="/" />
        <nav className="site-nav-links" aria-label="Main">
          <div className={dropOpen ? 'nav-drop open' : 'nav-drop'} ref={dropRef}>
            <button
              type="button"
              className={inUse ? 'nav-drop-toggle on' : 'nav-drop-toggle'}
              aria-expanded={dropOpen}
              aria-controls="nav-use-menu"
              onClick={() => setDropOpen((value) => !value)}
            >
              Use PhoneCam
            </button>
            {dropOpen ? (
              <div className="nav-drop-menu" id="nav-use-menu">
                {USE_LINKS.map((item) => {
                  const current = item.match(location.pathname, query)
                  return (
                    <Link key={item.label} to={item.to} className={current ? 'on' : ''} aria-current={current ? 'page' : undefined}>
                      <strong>{item.label}</strong>
                      <span>{item.note}</span>
                    </Link>
                  )
                })}
              </div>
            ) : null}
          </div>
          {LEARN_LINKS.map((item) => <NavItem key={item.label} item={item} current={item.match?.(location.pathname, query)} />)}
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
          <p className="menu-group">Use PhoneCam</p>
          {USE_LINKS.map((item) => <NavItem key={item.label} item={item} current={item.match(location.pathname, query)} />)}
          <p className="menu-group">Learn</p>
          {LEARN_LINKS.map((item) => <NavItem key={item.label} item={item} current={item.match?.(location.pathname, query)} />)}
          <Link to={cta.to} className="lp-btn primary">{cta.label}</Link>
        </nav>
      ) : null}
    </header>
  )
}
