import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Status from '../components/Status.jsx'
import SiteNav from '../components/SiteNav.jsx'
import SiteFooter from '../components/SiteFooter.jsx'
import { EXTENSION_STORE_URL, PHONECAM_DEVICE_ID } from '../lib/extension.js'

export default function Check() {
  const [found, setFound] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [error, setError] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    document.title = 'Check the extension · PhoneCam'
    let alive = true
    const look = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (alive) setFound(devices.some((device) => device.deviceId === PHONECAM_DEVICE_ID))
      } catch {
        if (alive) setFound(false)
      }
    }
    look()
    return () => {
      alive = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function preview() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: PHONECAM_DEVICE_ID } } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
      setPreviewing(true)
    } catch {
      setError('The extension did not answer. Reload this page and try again.')
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setPreviewing(false)
  }

  let state = { text: 'Looking for the extension…', state: 'wait' }
  if (found === true) state = { text: 'Extension found', state: 'live' }
  if (found === false) state = { text: 'Extension not found', state: '' }

  return (
    <div className="lp check-shell">
      <SiteNav />

      <section className="lp-section check-page" aria-labelledby="check-title">
        <p className="lp-label">Extension</p>
        <h1 id="check-title" className="lp-title">Check the extension</h1>
        <p className="check-lede">
          {found === false
            ? 'This browser does not show a PhoneCam camera yet. Add the extension from the Chrome Web Store, then reload this page.'
            : 'Preview what a meeting will see when you pick PhoneCam as the camera.'}
        </p>
        <Status className="pill check-status" text={state.text} state={state.state} />
        <div className="check-frame">
          <video ref={videoRef} autoPlay playsInline muted />
          {previewing ? null : <p>The preview shows up here.</p>}
        </div>
        {error ? <p className="warn" role="alert">{error}</p> : null}
        <div className="row-actions">
          {found === false ? (
            <a className="lp-btn primary" href={EXTENSION_STORE_URL} target="_blank" rel="noopener">Add to Chrome</a>
          ) : previewing ? (
            <button type="button" className="lp-btn" onClick={stop}>Stop preview</button>
          ) : (
            <button type="button" className="lp-btn primary" disabled={!found} onClick={preview}>Preview PhoneCam</button>
          )}
        </div>
        <p className="fine">If the preview shows a waiting screen, click the PhoneCam icon in the toolbar and scan its code with your phone.</p>
      </section>

      <SiteFooter />
    </div>
  )
}
