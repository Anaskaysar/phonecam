/* global __APP_VERSION__ */
import { Link, useLocation } from 'react-router-dom'
import Logo from './Logo.jsx'

const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''
const REPO = 'https://github.com/Anaskaysar/phonecam'
const SUPPORT = 'kaysarulanas2@gmail.com'

function FooterLink({ to, children }) {
  const location = useLocation()
  const current = `${location.pathname}${location.search}` === to
  return <Link to={to} aria-current={current ? 'page' : undefined}>{children}</Link>
}

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="sf-top">
        <div className="sf-brand">
          <Logo to="/" />
          <p>Your phone is the webcam. Nothing to install on the phone, no account, nothing recorded.</p>
        </div>
        <nav className="sf-cols" aria-label="Footer">
          <div>
            <h2>Use PhoneCam</h2>
            <FooterLink to="/receiver">Open the receiver</FooterLink>
            <FooterLink to="/camera">Open the camera</FooterLink>
            <FooterLink to="/receiver?mode=meeting">Browser extension</FooterLink>
            <FooterLink to="/check">Check the extension</FooterLink>
          </div>
          <div>
            <h2>Guides</h2>
            <a href="/webcam">Skip buying a webcam</a>
            <a href="/use-phone-as-webcam">Phone as a webcam</a>
            <a href="/iphone-as-webcam">iPhone</a>
            <a href="/android-as-webcam">Android</a>
            <a href="/meeting-webcam">Zoom, Meet and Teams</a>
            <a href="/guides">All guides →</a>
          </div>
          <div>
            <h2>Help</h2>
            <FooterLink to="/?section=how">How it works</FooterLink>
            <FooterLink to="/?section=faq">Questions</FooterLink>
            <FooterLink to="/rate">Rate PhoneCam</FooterLink>
            <a href={`mailto:${SUPPORT}?subject=PhoneCam%20issue`}>Report an issue</a>
          </div>
          <div>
            <h2>About</h2>
            <a href="/about">About PhoneCam</a>
            <a href="/privacy.html">Privacy</a>
            <a href={REPO}>Source on GitHub</a>
          </div>
        </nav>
      </div>
      <div className="sf-bottom">
        <span>© {new Date().getFullYear()} PhoneCam</span>
        {VERSION ? <span>Version {VERSION}</span> : null}
        <span className="sf-note"><i aria-hidden="true" />Video goes straight from your phone to your computer.</span>
      </div>
    </footer>
  )
}
