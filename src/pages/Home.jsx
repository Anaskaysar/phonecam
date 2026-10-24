import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Logo from '../components/Logo.jsx'

export default function Home() {
  const [prompt, setPrompt] = useState(null)

  useEffect(() => {
    document.title = 'PhoneCam'
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
    <main className="home">
      <div className="home-inner">
        <div className="home-bar">
          <Logo />
          {prompt ? (
            <button type="button" className="secondary btn-small" onClick={install}>Install</button>
          ) : null}
        </div>
        <div className="hero">
          <h1>Your phone is the webcam.</h1>
          <p className="lede">Use the phone you already own for Zoom, Meet, Teams, and class. The picture goes straight to your laptop, so you can skip buying a webcam.</p>
        </div>
        <div className="choices">
          <Link className="choice" to="/camera">
            <span className="kicker">On your phone</span>
            <strong>Open the camera</strong>
            <p>Install it, join the room, and leave the screen on.</p>
          </Link>
          <Link className="choice" to="/receiver">
            <span className="kicker">On your laptop</span>
            <strong>Open the receiver</strong>
            <p>Get a room code, a QR code, and the OBS link.</p>
          </Link>
        </div>
        <ol className="steps">
          <li><span><b>Laptop.</b> Open the receiver and copy the OBS link into a Browser source.</span></li>
          <li><span><b>Phone.</b> Add PhoneCam to your home screen and enter that room code, or scan the QR code.</span></li>
          <li><span><b>Meeting.</b> Start OBS Virtual Camera, then choose it in Zoom, Meet, Teams, or PowerPoint.</span></li>
        </ol>
        <p className="note install-note">On iPhone, open this page in Safari, tap Share, then Add to Home Screen. The icon opens the camera. The camera only works on an https address.</p>
        <p className="fine">Keep the phone and the laptop on the same Wi-Fi. OBS Studio is free and is what other apps see as the camera.</p>
      </div>
    </main>
  )
}
