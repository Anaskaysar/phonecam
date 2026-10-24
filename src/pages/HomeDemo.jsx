import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

/* ─── tiny inline Logo so this file is totally self-contained ─── */
function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ display: 'block', borderRadius: 9 }}>
      <rect width="32" height="32" rx="9" fill="#dff25a" />
      <circle cx="16" cy="16" r="6.5" fill="#161a04" />
      <circle cx="23.5" cy="9.5" r="1.7" fill="#161a04" />
    </svg>
  )
}

const STEPS = [
  {
    num: '01',
    device: 'Laptop',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="14" rx="2" />
        <path d="M2 20h20" />
      </svg>
    ),
    headline: 'Open the Receiver',
    body: 'Click "Laptop → Receiver" below. Copy the OBS Browser Source URL and grab your room code.',
  },
  {
    num: '02',
    device: 'Phone',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="7" y="2" width="10" height="20" rx="3" />
        <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
    headline: 'Open the Camera',
    body: 'Add PhoneCam to your home screen and enter the room code — or just scan the QR.',
  },
  {
    num: '03',
    device: 'Meeting',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="m14.8 9-5.6 3.2 5.6 3.2V9z" fill="currentColor" stroke="none" />
      </svg>
    ),
    headline: 'Go Live',
    body: 'Start OBS Virtual Camera. In Zoom, Meet, or Teams, pick "OBS Virtual Camera" — done.',
  },
]

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    title: 'Peer-to-peer',
    body: 'Video travels directly from your phone to your laptop. Nothing touches a server.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    title: 'Works on any Wi-Fi',
    body: "Same network or different — as long as both devices have internet, you're good.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="m8 21 4-4 4 4" />
      </svg>
    ),
    title: 'OBS-ready',
    body: 'Drop the Browser Source URL into OBS Studio. Free, no plugins needed.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    title: 'Free forever',
    body: 'No accounts, no subscriptions, no limits. Open source and self-hostable.',
  },
]

export default function HomeDemo() {
  const [prompt, setPrompt] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    document.title = 'PhoneCam — Your phone is the webcam'
    setMounted(true)
    const onPrompt = (event) => {
      event.preventDefault()
      setPrompt(event)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function install() {
    if (!prompt) return
    prompt.prompt()
    await prompt.userChoice
    setPrompt(null)
  }

  return (
    <>
      <style>{`
        /* ══ DEMO-SCOPED STYLES ══════════════════════════════════════════ */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

        .hd-root {
          min-height: 100%;
          background: #090b0f;
          color: #f0f2f5;
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        /* ── NAV ───────────────────────────────────────────────────────── */
        .hd-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 clamp(20px, 5vw, 60px);
          height: 64px;
          background: rgba(9, 11, 15, 0.7);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .hd-nav-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          font-size: 17px;
          letter-spacing: -0.04em;
          color: #f0f2f5;
          text-decoration: none;
        }
        .hd-nav-actions { display: flex; gap: 10px; align-items: center; }
        .hd-btn-ghost {
          border: 1px solid rgba(255,255,255,0.14);
          background: transparent;
          color: #f0f2f5;
          border-radius: 999px;
          padding: 8px 18px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: border-color .18s, background .18s;
        }
        .hd-btn-ghost:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.28); }
        .hd-btn-primary {
          border: 0;
          background: #dff25a;
          color: #161a04;
          border-radius: 999px;
          padding: 8px 18px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          transition: opacity .18s, transform .12s;
        }
        .hd-btn-primary:hover { opacity: 0.88; transform: translateY(-1px); }

        /* ── HERO ──────────────────────────────────────────────────────── */
        .hd-hero {
          position: relative;
          overflow: hidden;
          padding: clamp(72px, 12vw, 140px) clamp(20px, 5vw, 60px) clamp(60px, 10vw, 120px);
          text-align: center;
        }
        .hd-hero-glow {
          position: absolute;
          top: -180px;
          left: 50%;
          transform: translateX(-50%);
          width: 900px;
          height: 600px;
          background: radial-gradient(ellipse at 50% 30%, rgba(223,242,90,0.18) 0%, rgba(223,242,90,0.04) 45%, transparent 70%);
          pointer-events: none;
        }
        .hd-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 14px 5px 8px;
          border-radius: 999px;
          background: rgba(223,242,90,0.1);
          border: 1px solid rgba(223,242,90,0.28);
          font-size: 13px;
          font-weight: 600;
          color: #dff25a;
          margin-bottom: 28px;
          letter-spacing: 0.01em;
        }
        .hd-badge-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #dff25a;
          animation: hd-badge-pulse 2s ease-out infinite;
        }
        @keyframes hd-badge-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(223,242,90,0.6); }
          50% { box-shadow: 0 0 0 5px rgba(223,242,90,0); }
        }
        .hd-h1 {
          margin: 0 auto 20px;
          max-width: 760px;
          font-size: clamp(44px, 8vw, 80px);
          font-weight: 900;
          line-height: 0.95;
          letter-spacing: -0.055em;
          text-wrap: balance;
        }
        .hd-h1 em {
          font-style: normal;
          background: linear-gradient(135deg, #dff25a 20%, #b8e000 80%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hd-root p, .hd-root li { text-align: justify; hyphens: auto; -webkit-hyphens: auto; }
        .hd-hero p, .hd-cta-section p { text-align-last: center; }
        .hd-lede {
          margin: 0 auto 40px;
          max-width: 520px;
          font-size: clamp(16px, 2.2vw, 19px);
          line-height: 1.55;
          color: #8a9bb0;
          font-weight: 400;
        }
        .hd-hero-cta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          justify-content: center;
          align-items: center;
        }
        .hd-cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #dff25a;
          color: #161a04;
          border: 0;
          border-radius: 999px;
          padding: 14px 28px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          text-decoration: none;
          transition: opacity .18s, transform .14s, box-shadow .18s;
          box-shadow: 0 0 0 0 rgba(223,242,90,0.3);
          font-family: inherit;
        }
        .hd-cta-primary:hover {
          opacity: 0.9;
          transform: translateY(-2px);
          box-shadow: 0 8px 40px rgba(223,242,90,0.25);
        }
        .hd-cta-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          color: #f0f2f5;
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 999px;
          padding: 14px 28px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: background .18s, border-color .18s;
          font-family: inherit;
        }
        .hd-cta-secondary:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.28); }

        /* ── DEVICE MOCKUP ─────────────────────────────────────────────── */
        .hd-mockup-wrap {
          position: relative;
          max-width: 860px;
          margin: 60px auto 0;
        }
        .hd-mockup-glow {
          position: absolute;
          bottom: -80px;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 200px;
          background: radial-gradient(ellipse, rgba(223,242,90,0.12), transparent 70%);
          pointer-events: none;
        }
        .hd-screen {
          background: #131620;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.05);
          aspect-ratio: 16/9;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .hd-screen-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          opacity: 0.7;
        }
        .hd-screen-cam {
          width: 80px; height: 80px;
          border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #2a3040, #0f1318);
          border: 2px solid rgba(223,242,90,0.28);
          display: grid;
          place-items: center;
        }
        .hd-screen-label { font-size: 13px; color: #5a6880; letter-spacing: 0.04em; font-weight: 600; }
        .hd-browser-bar {
          height: 38px;
          background: #0f1218;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          padding: 0 16px;
          gap: 8px;
          position: absolute;
          top: 0; left: 0; right: 0;
        }
        .hd-browser-dot { width: 10px; height: 10px; border-radius: 50%; }

        /* ── STEPS ─────────────────────────────────────────────────────── */
        .hd-section {
          padding: clamp(60px, 9vw, 110px) clamp(20px, 5vw, 60px);
          max-width: 1100px;
          margin: 0 auto;
        }
        .hd-section-label {
          display: inline-block;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #dff25a;
          margin-bottom: 14px;
        }
        .hd-section-title {
          margin: 0 0 52px;
          font-size: clamp(28px, 4vw, 42px);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.08;
          color: #f0f2f5;
          max-width: 520px;
          text-wrap: balance;
        }
        .hd-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2px;
          background: rgba(255,255,255,0.06);
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.07);
        }
        .hd-step {
          background: #0f1218;
          padding: clamp(24px, 3vw, 36px);
          display: grid;
          gap: 16px;
          align-content: start;
          position: relative;
          transition: background .22s;
        }
        .hd-step:hover { background: #131821; }
        .hd-step-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .hd-step-num {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #dff25a;
          font-variant-numeric: tabular-nums;
        }
        .hd-step-icon {
          width: 38px; height: 38px;
          border-radius: 10px;
          background: rgba(223,242,90,0.1);
          border: 1px solid rgba(223,242,90,0.2);
          display: grid;
          place-items: center;
          color: #dff25a;
        }
        .hd-step-device {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #4a5568;
        }
        .hd-step h3 {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: #f0f2f5;
        }
        .hd-step p {
          margin: 0;
          font-size: 14px;
          line-height: 1.55;
          color: #6a7a8e;
        }

        /* ── FEATURE GRID ──────────────────────────────────────────────── */
        .hd-features {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2px;
          background: rgba(255,255,255,0.06);
          border-radius: 24px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.07);
          margin-top: 6px;
        }
        .hd-feature {
          background: #0f1218;
          padding: clamp(22px, 3vw, 32px);
          display: grid;
          gap: 12px;
          align-content: start;
          transition: background .22s;
        }
        .hd-feature:hover { background: #131821; }
        .hd-feature-icon {
          width: 40px; height: 40px;
          border-radius: 11px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          display: grid;
          place-items: center;
          color: #8a9bb0;
        }
        .hd-feature h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #f0f2f5;
        }
        .hd-feature p {
          margin: 0;
          font-size: 14px;
          line-height: 1.55;
          color: #6a7a8e;
        }

        /* ── CTA SECTION ───────────────────────────────────────────────── */
        .hd-cta-section {
          padding: clamp(60px, 9vw, 110px) clamp(20px, 5vw, 60px);
          text-align: center;
        }
        .hd-cta-card {
          max-width: 680px;
          margin: 0 auto;
          background: linear-gradient(135deg, rgba(223,242,90,0.08) 0%, rgba(223,242,90,0.03) 100%);
          border: 1px solid rgba(223,242,90,0.18);
          border-radius: 32px;
          padding: clamp(40px, 6vw, 72px) clamp(28px, 5vw, 60px);
          display: grid;
          gap: 20px;
        }
        .hd-cta-card h2 {
          margin: 0;
          font-size: clamp(28px, 4.5vw, 48px);
          font-weight: 900;
          letter-spacing: -0.05em;
          line-height: 1;
          text-wrap: balance;
        }
        .hd-cta-card p {
          margin: 0;
          font-size: 16px;
          line-height: 1.5;
          color: #8a9bb0;
        }
        .hd-cta-actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }

        /* ── CHOICES ───────────────────────────────────────────────────── */
        .hd-choices {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          max-width: 520px;
          margin: 0 auto;
        }
        .hd-choice {
          display: grid;
          align-content: start;
          gap: 4px;
          padding: 18px 20px;
          border-radius: 18px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          color: inherit;
          text-decoration: none;
          transition: background .2s, border-color .2s, transform .16s;
        }
        .hd-choice:hover {
          background: rgba(223,242,90,0.06);
          border-color: rgba(223,242,90,0.35);
          transform: translateY(-2px);
        }
        .hd-choice-tag {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #dff25a;
        }
        .hd-choice strong {
          font-size: 16px;
          letter-spacing: -0.025em;
          color: #f0f2f5;
        }
        .hd-choice p { margin: 0; font-size: 13px; color: #6a7a8e; line-height: 1.4; }

        /* ── FOOTER ────────────────────────────────────────────────────── */
        .hd-footer {
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 28px clamp(20px, 5vw, 60px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .hd-footer-brand {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.035em;
          color: #f0f2f5;
        }
        .hd-footer-note { font-size: 13px; color: #4a5568; }

        /* ── RESPONSIVE ────────────────────────────────────────────────── */
        @media (max-width: 700px) {
          .hd-steps, .hd-features { grid-template-columns: 1fr; }
          .hd-choices { grid-template-columns: 1fr; max-width: 340px; }
          .hd-nav-brand span { display: none; }
        }

        /* ── ENTRANCE ANIMATION ────────────────────────────────────────── */
        @keyframes hd-fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hd-animate { animation: hd-fade-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .hd-d1 { animation-delay: 0.05s; }
        .hd-d2 { animation-delay: 0.13s; }
        .hd-d3 { animation-delay: 0.21s; }
        .hd-d4 { animation-delay: 0.29s; }
        .hd-d5 { animation-delay: 0.37s; }
      `}</style>

      <div className="hd-root">

        {/* ── NAV ── */}
        <nav className="hd-nav">
          <Link to="/" className="hd-nav-brand">
            <LogoMark size={26} />
            <span>PhoneCam</span>
          </Link>
          <div className="hd-nav-actions">
            {prompt && (
              <button type="button" className="hd-btn-ghost" onClick={install}>
                Install App
              </button>
            )}
            <Link to="/receiver" className="hd-btn-primary">Open Receiver</Link>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className="hd-hero">
          <div className="hd-hero-glow" aria-hidden="true" />

          <div className={`hd-badge hd-animate hd-d1`}>
            <span className="hd-badge-dot" />
            Free & open source · No account needed
          </div>

          <h1 className={`hd-h1 hd-animate hd-d2`}>
            Your phone is<br /><em>the webcam.</em>
          </h1>

          <p className={`hd-lede hd-animate hd-d3`}>
            Skip the $80 webcam. Use the camera already in
            your pocket — for Zoom, Meet, Teams, and OBS.
            Peer-to-peer, no servers, no subscriptions.
          </p>

          <div className={`hd-hero-cta hd-animate hd-d4`}>
            <Link to="/camera" className="hd-cta-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 7 16 12l7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>
              </svg>
              Phone → Open Camera
            </Link>
            <Link to="/receiver" className="hd-cta-secondary">
              Laptop → Open Receiver
            </Link>
          </div>

          {/* Browser Mockup */}
          <div className={`hd-mockup-wrap hd-animate hd-d5`}>
            <div className="hd-screen">
              <div className="hd-browser-bar">
                <div className="hd-browser-dot" style={{ background: '#ff5f56' }} />
                <div className="hd-browser-dot" style={{ background: '#ffbd2e' }} />
                <div className="hd-browser-dot" style={{ background: '#27c93f' }} />
              </div>
              <div className="hd-screen-inner">
                <div className="hd-screen-cam">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(223,242,90,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 7 16 12l7 5V7z"/>
                    <rect x="1" y="5" width="15" height="14" rx="2"/>
                  </svg>
                </div>
                <div className="hd-screen-label">LIVE CAMERA FEED</div>
              </div>
            </div>
            <div className="hd-mockup-glow" aria-hidden="true" />
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="hd-section" aria-labelledby="how-it-works">
          <div>
            <span className="hd-section-label">How it works</span>
            <h2 className="hd-section-title" id="how-it-works">
              Three steps.<br />Under two minutes.
            </h2>
          </div>
          <div className="hd-steps" role="list">
            {STEPS.map((s) => (
              <div className="hd-step" key={s.num} role="listitem">
                <div className="hd-step-top">
                  <span className="hd-step-num">{s.num}</span>
                  <div className="hd-step-icon" aria-hidden="true">{s.icon}</div>
                </div>
                <div className="hd-step-device">{s.device}</div>
                <h3>{s.headline}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section className="hd-section" aria-labelledby="features">
          <div>
            <span className="hd-section-label">Why PhoneCam</span>
            <h2 className="hd-section-title" id="features">
              Built to stay out<br />of your way.
            </h2>
          </div>
          <div className="hd-features">
            {FEATURES.map((f) => (
              <div className="hd-feature" key={f.title}>
                <div className="hd-feature-icon" aria-hidden="true">{f.icon}</div>
                <h4>{f.title}</h4>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── BOTTOM CTA ── */}
        <section className="hd-cta-section" aria-labelledby="get-started">
          <div className="hd-cta-card">
            <h2 id="get-started">Start in seconds —<br />on this device.</h2>
            <p>Open the camera on your phone or the receiver on your laptop. No sign-up, ever.</p>
            <div className="hd-cta-actions">
              <div className="hd-choices">
                <Link className="hd-choice" to="/camera">
                  <span className="hd-choice-tag">On your phone</span>
                  <strong>Open Camera</strong>
                  <p>Install, join room, keep screen on.</p>
                </Link>
                <Link className="hd-choice" to="/receiver">
                  <span className="hd-choice-tag">On your laptop</span>
                  <strong>Open Receiver</strong>
                  <p>Get the room code + OBS link.</p>
                </Link>
              </div>
            </div>
            {prompt && (
              <button type="button" className="hd-btn-ghost" style={{ margin: '0 auto', display: 'inline-flex' }} onClick={install}>
                ↓ Install as App
              </button>
            )}
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="hd-footer">
          <div className="hd-footer-brand">
            <LogoMark size={22} />
            PhoneCam
          </div>
          <p className="hd-footer-note">
            Keep phone and laptop on the same Wi-Fi.
            OBS Studio is free at obsproject.com.
          </p>
        </footer>

      </div>
    </>
  )
}
