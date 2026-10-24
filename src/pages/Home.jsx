import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SiteNav from '../components/SiteNav.jsx'
import SiteFooter from '../components/SiteFooter.jsx'
import Testimonials from '../components/Testimonials.jsx'
import { paletteStyle, useColorEdition } from '../lib/color-edition.js'
import { installHint, platform, useInstallPrompt } from '../lib/platform.js'

const icon = {
  laptop: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M2 20h20" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="3" />
      <circle cx="12" cy="18" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  meeting: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7 16 12l7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  ),
  puzzle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3h7z" />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M12 13V7m0 0-3 3m3-3 3 3M8 21h8" />
    </svg>
  ),
  obs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="7.5" r="2" />
      <circle cx="8" cy="14.5" r="2" />
      <circle cx="16" cy="14.5" r="2" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  ),
  spark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  )
}

const STEPS = [
  { num: '01', device: 'Laptop', icon: icon.laptop, title: 'Open the receiver', body: 'Pick how your meeting gets the picture. The receiver shows a room code and a QR code.' },
  { num: '02', device: 'Phone', icon: icon.phone, title: 'Scan and tap Start', body: 'Scan the QR code with the phone’s camera. PhoneCam opens in Safari or Chrome, with no app to install.' },
  { num: '03', device: 'Meeting', icon: icon.meeting, title: 'Pick PhoneCam', body: 'Choose PhoneCam as your camera, share the PhoneCam tab, or use OBS Virtual Camera.' }
]

const WAYS = [
  {
    mode: 'meeting',
    icon: icon.puzzle,
    tag: 'Recommended',
    title: 'Browser extension',
    body: 'Shows up as a camera called PhoneCam in Google Meet, Microsoft Teams, Zoom, Discord and Webex on the web.',
    meta: 'Chrome, Edge, Brave, Arc',
    cta: 'Get the extension'
  },
  {
    mode: 'share',
    icon: icon.share,
    tag: 'Nothing to install',
    title: 'Share a tab',
    body: 'Turn the receiver into a clean video view and share it in any meeting app, including the Zoom and Teams desktop apps.',
    meta: 'Any browser, any app',
    cta: 'Use Share a tab'
  },
  {
    mode: 'obs',
    icon: icon.obs,
    tag: 'For streamers',
    title: 'OBS',
    body: 'Add the receiver as a Browser source, then start OBS Virtual Camera. Every app sees it as a real camera.',
    meta: 'OBS Studio, free',
    cta: 'Set up OBS'
  }
]

const FEATURES = [
  { icon: icon.phone, title: 'No app on the phone', body: 'PhoneCam runs in Safari or Chrome. Add it to your home screen if you like, and the icon opens straight to the camera.' },
  { icon: icon.lock, title: 'Straight to your laptop', body: 'The video goes from phone to laptop over an encrypted peer-to-peer link. A free service only introduces the two devices.' },
  { icon: icon.spark, title: 'Up to 1080p', body: '480p, 720p or 1080p at 30 fps. Front or back camera, and the phone mic if you want it.' },
  { icon: icon.heart, title: 'Free, no account', body: 'No sign-up, no subscription, no tracking. Nothing is recorded.' }
]

const GUIDES = [
  { href: '/webcam', title: 'About to buy a webcam?', body: 'A phone and a stand of about $3 beat most webcams under $100.' },
  { href: '/blurry-laptop-webcam', title: 'Laptop camera looks soft', body: 'The camera in the lid is the weak one. The phone in your pocket is not.' },
  { href: '/use-phone-as-webcam', title: 'Use your phone as a webcam', body: 'Scan a code, tap Start, and pick PhoneCam. No app on the phone.' },
  { href: '/iphone-as-webcam', title: 'iPhone as a webcam', body: 'Opens in Safari. Keep the screen on. Nothing from the App Store.' },
  { href: '/android-as-webcam', title: 'Android as a webcam', body: 'Opens in Chrome. Nothing to install from the Play Store.' },
  { href: '/meeting-webcam', title: 'Zoom, Meet and Teams', body: 'A camera called PhoneCam in the browser, or share a tab in the desktop apps.' },
  { href: '/obs-phone-camera', title: 'Phone camera in OBS', body: 'A browser source, then Virtual Camera for every other app.' }
]

const FAQ = [
  { q: 'Should I buy a webcam?', a: 'Most people don’t need to. A phone on a cheap stand is sharper than a basic webcam, and PhoneCam sends it to the laptop for free. A real webcam is only simpler if you want one cable and no phone battery to watch.' },
  { q: 'Do the phone and laptop need the same Wi-Fi?', a: 'Same Wi-Fi is the most reliable. Different networks often work too, but some, like mobile data or strict office Wi-Fi, can block a direct connection.' },
  { q: 'Does it work on iPhone?', a: 'Yes. Open PhoneCam in Safari and keep the screen on while you stream. iOS pauses the camera if you switch to another app.' },
  { q: 'Which option should I pick?', a: 'Use the extension for meetings in Chrome or Edge. Use Share a tab for desktop apps when you can’t install anything. Use OBS if you already stream with it.' }
]

function isPhone() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse) and (max-width: 820px)').matches
}

function HeroVisual() {
  return (
    <div className="lp-visual" aria-hidden="true">
      <div className="lp-window">
        <div className="lp-window-bar">
          <span className="lp-dot r" />
          <span className="lp-dot y" />
          <span className="lp-dot g" />
        </div>
        <div className="lp-window-body">
          <div className="lp-tile lp-tile-main">
            <div className="lp-scene" />
            <span className="lp-tile-name"><i className="lp-live" />You · PhoneCam</span>
          </div>
          <div className="lp-tile-side">
            <div className="lp-tile"><span className="lp-avatar">AK</span></div>
            <div className="lp-tile"><span className="lp-avatar">JS</span></div>
          </div>
        </div>
        <div className="lp-menu">
          <p>Camera</p>
          <div className="lp-menu-item">Built-in camera</div>
          <div className="lp-menu-item on">PhoneCam <span>✓</span></div>
        </div>
      </div>
      <div className="lp-phone">
        <div className="lp-phone-screen">
          <div className="lp-scene" />
          <span className="lp-phone-pill"><i className="lp-live" />Live on your laptop</span>
          <span className="lp-phone-stop">Stop</span>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const [phone] = useState(isPhone)
  const { canInstall } = useInstallPrompt()
  const hint = installHint(platform())
  const color = useColorEdition()

  const [params] = useSearchParams()
  const section = params.get('section')

  useEffect(() => {
    document.title = 'PhoneCam · Your phone is the webcam'
  }, [])

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    const previous = meta?.getAttribute('content')
    const previousBody = document.body.style.background
    if (meta) meta.setAttribute('content', color.edition.bg)
    document.body.style.background = color.edition.bg
    return () => {
      if (meta && previous) meta.setAttribute('content', previous)
      document.body.style.background = previousBody
    }
  }, [color.edition.bg])

  // Nav and footer links like /?section=how scroll to that part of the page.
  useEffect(() => {
    if (!section) return
    const target = document.getElementById(section)
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [section])

  // One question per screen: the hero has a single primary button for this device.
  const primary = phone
    ? <Link to="/camera" className="lp-cta primary">Open the camera</Link>
    : <Link to="/receiver" className="lp-cta primary">Open the receiver</Link>

  return (
    <div
      className="lp"
      data-color-mode={color.mode}
      data-edition={color.edition.id}
      style={paletteStyle(color.edition)}
    >
      <SiteNav showCta={false} edition={color} />
      <p className="sr-only" aria-live="polite">
        {color.mode === 'frozen' ? 'Black and white.' : `Color edition. ${color.edition.name}.`}
      </p>

      <header className="lp-hero">
        <div className="lp-glow" aria-hidden="true" />
        <p className="lp-badge lp-in d1"><span />Free · No account · No app on the phone</p>
        <h1 className="lp-in d2">Your phone is <em>the webcam.</em></h1>
        <p className="lp-lede lp-in d3">
          Use the camera already in your pocket in Meet, Teams, Zoom and OBS. Scan a code, tap Start, and the picture goes straight to your laptop.
        </p>
        <div className="lp-ctas lp-in d4">
          {primary}
        </div>
        <p className="lp-cta-note lp-in d4">
          {phone
            ? 'Then open phonecam.app on your laptop to get the code.'
            : 'Your phone joins by scanning the code. No app to install.'}
        </p>
        <div className="lp-in d5">
          <HeroVisual />
        </div>
      </header>

      <section className="lp-section" aria-labelledby="how">
        <p className="lp-label">How it works</p>
        <h2 id="how" className="lp-title anchor">Three steps. Under two minutes.</h2>
        <ol className="lp-grid lp-grid-3">
          {STEPS.map((step) => (
            <li className="lp-cell" key={step.num}>
              <div className="lp-cell-top">
                <span className="lp-num">{step.num}</span>
                <span className="lp-icon accent">{step.icon}</span>
              </div>
              <span className="lp-device">{step.device}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-section" aria-labelledby="ways">
        <p className="lp-label">Three ways in</p>
        <h2 id="ways" className="lp-title">Pick what fits your meeting.</h2>
        <div className="lp-grid lp-grid-3">
          {WAYS.map((way) => (
            <Link className={way.mode === 'meeting' ? 'lp-cell lp-way featured' : 'lp-cell lp-way'} key={way.mode} to={`/receiver?mode=${way.mode}`}>
              <div className="lp-cell-top">
                <span className="lp-icon accent">{way.icon}</span>
                <span className="lp-tag">{way.tag}</span>
              </div>
              <h3>{way.title}</h3>
              <p>{way.body}</p>
              <span className="lp-meta">{way.meta}</span>
              <span className="lp-more">{way.cta} →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="lp-section" aria-labelledby="why">
        <p className="lp-label">Why PhoneCam</p>
        <h2 id="why" className="lp-title">Built to stay out of your way.</h2>
        <div className="lp-grid lp-grid-2">
          {FEATURES.map((feature) => (
            <div className="lp-cell" key={feature.title}>
              <span className="lp-icon">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section" aria-labelledby="guides">
        <p className="lp-label">If you were looking for a camera</p>
        <h2 id="guides" className="lp-title anchor">You may not need a new webcam.</h2>
        <div className="lp-grid lp-grid-2 lp-guides">
          {GUIDES.map((guide) => (
            <a className="lp-cell" key={guide.href} href={guide.href}>
              <h3>{guide.title}</h3>
              <p>{guide.body}</p>
              <span className="lp-more">Read this →</span>
            </a>
          ))}
        </div>
      </section>

      <Testimonials />

      <section className="lp-section" aria-labelledby="faq">
        <p className="lp-label">Questions</p>
        <h2 id="faq" className="lp-title anchor">Good to know.</h2>
        <div className="lp-faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-final">
          <h2>Pair once. Then just tap Start.</h2>
          <p>After the first scan, your phone remembers your laptop. Open PhoneCam on the phone, tap Start streaming, and pick PhoneCam in your meeting. No sign-up, ever.</p>
          <div className="row-actions">
            {phone
              ? <Link to="/camera" className="lp-cta primary">Go to the camera</Link>
              : <Link to="/receiver" className="lp-cta primary">Set up this laptop</Link>}
          </div>
          {hint && !canInstall ? <p className="lp-ios install-note">{hint}</p> : null}
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
