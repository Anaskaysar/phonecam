import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Status from '../components/Status.jsx'
import ThemePicker from '../components/ThemePicker.jsx'
import { cameraMessage, captureConstraints, tuneBitrate } from '../lib/media.js'
import { readStorage, writeStorage } from '../lib/room.js'
import { forgetPairing, loadPairings, parsePairToken, savePairing } from '../lib/pairing.js'
import { startPhoneLink } from '../lib/phone-link.js'
import { installHint, isStandalone, platform, useInstallPrompt } from '../lib/platform.js'

const QUALITIES = ['480', '720', '1080']
const SOURCES = { ext: 'Browser extension', share: 'Receiver page', obs: 'OBS' }

function initialQuality() {
  const saved = readStorage('pc.quality', '720')
  return QUALITIES.includes(saved) ? saved : '720'
}

function initialFacing() {
  const saved = readStorage('pc.facing', 'user')
  return saved === 'environment' ? 'environment' : 'user'
}

function describe(pairing) {
  const where = SOURCES[pairing.from] || 'Laptop'
  return pairing.mode === 'session' ? `${where} · paired` : `${where} · new code`
}

export default function Camera() {
  const [params, setParams] = useSearchParams()
  const [pairings, setPairings] = useState(loadPairings)
  const [quality, setQuality] = useState(initialQuality)
  const [mic, setMic] = useState(readStorage('pc.mic', '0') === '1' ? '1' : '0')
  const [facing, setFacing] = useState(initialFacing)
  const [streaming, setStreaming] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [awake, setAwake] = useState(true)
  const [status, setStatus] = useState({ text: 'Starting camera…', state: '' })
  const [notice, setNotice] = useState('')

  const awakeTimer = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const linkRef = useRef(null)
  const wakeLockRef = useRef(null)
  const streamingRef = useRef(false)
  const qualityRef = useRef(quality)
  const micRef = useRef(mic)
  const facingRef = useRef(facing)
  const api = useRef({})
  const { canInstall, install } = useInstallPrompt()

  qualityRef.current = quality
  micRef.current = mic
  facingRef.current = facing
  const active = pairings[0] || null

  // A QR code opens /camera?pair=<room>.<key>&from=…  Save it, then take it out of the address bar.
  useEffect(() => {
    const token = params.get('pair')
    if (!token) return
    const parsed = parsePairToken(token)
    if (parsed) {
      const from = ['ext', 'share', 'obs'].includes(params.get('from')) ? params.get('from') : ''
      const known = loadPairings().find((item) => item.roomId === parsed.roomId)
      // Scanning the same code again must not replace a key this phone already earned.
      setPairings(known?.mode === 'session' ? savePairing(known) : savePairing({ roomId: parsed.roomId, key: parsed.key, mode: 'pair', from }))
      setNotice('')
    } else {
      setNotice('That code is not a PhoneCam code. Scan the QR code on your laptop again.')
    }
    setParams({}, { replace: true })
  }, [params, setParams])

  api.current.requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen')
    } catch {
      /* The browser can refuse a wake lock. Streaming still works. */
    }
  }

  api.current.openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      const error = new Error('Camera requires a secure page')
      error.name = 'SecurityError'
      throw error
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    const stream = await navigator.mediaDevices.getUserMedia(
      captureConstraints(qualityRef.current, facingRef.current, micRef.current === '1')
    )
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.onended = () => {
        if (streamingRef.current) {
          api.current.openCamera().catch((error) => setStatus({ text: cameraMessage(error), state: '' }))
        }
      }
    }
    const pc = linkRef.current?.peerConnection()
    if (pc) {
      for (const sender of pc.getSenders()) {
        if (!sender.track) continue
        const next = stream.getTracks().find((track) => track.kind === sender.track.kind)
        if (next) await sender.replaceTrack(next)
      }
    }
    return stream
  }

  useEffect(() => {
    document.title = 'Camera · PhoneCam'
    let alive = true
    api.current.openCamera()
      .then(() => {
        if (alive && !streamingRef.current) setStatus({ text: 'Ready', state: '' })
      })
      .catch(() => {
        if (alive) setStatus({ text: 'Tap Start streaming and allow the camera.', state: '' })
      })

    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !streamingRef.current) return
      api.current.requestWakeLock()
      const track = streamRef.current?.getVideoTracks()[0]
      if (!track || track.readyState === 'ended' || track.muted) {
        api.current.openCamera().catch((error) => setStatus({ text: cameraMessage(error), state: '' }))
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      alive = false
      streamingRef.current = false
      document.removeEventListener('visibilitychange', onVisible)
      linkRef.current?.stop()
      linkRef.current = null
      streamRef.current?.getTracks().forEach((track) => track.stop())
      wakeLockRef.current?.release?.().catch(() => {})
    }
  }, [])

  // While streaming, the controls fade out after a few seconds so the video has the whole screen.
  function wake() {
    setAwake(true)
    clearTimeout(awakeTimer.current)
    if (streamingRef.current) awakeTimer.current = setTimeout(() => setAwake(false), 3500)
  }

  useEffect(() => {
    if (streaming) wake()
    else {
      clearTimeout(awakeTimer.current)
      setAwake(true)
    }
    return () => clearTimeout(awakeTimer.current)
  }, [streaming])

  useEffect(() => {
    if (!sheetOpen) return undefined
    const onKey = (event) => { if (event.key === 'Escape') setSheetOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen])

  function stop(text = 'Stopped') {
    streamingRef.current = false
    linkRef.current?.stop()
    linkRef.current = null
    wakeLockRef.current?.release?.().catch(() => {})
    wakeLockRef.current = null
    setStreaming(false)
    setStatus({ text, state: '' })
  }

  async function start() {
    if (streamingRef.current) return
    const pairing = loadPairings()[0]
    if (!pairing) {
      setNotice('Scan the QR code on your laptop first.')
      return
    }
    setNotice('')
    writeStorage('pc.quality', quality)
    writeStorage('pc.mic', mic)
    streamingRef.current = true
    setStreaming(true)
    try {
      await api.current.openCamera()
    } catch (error) {
      streamingRef.current = false
      setStreaming(false)
      setStatus({ text: cameraMessage(error), state: '' })
      return
    }
    await api.current.requestWakeLock()
    linkRef.current = startPhoneLink({
      roomId: pairing.roomId,
      key: pairing.key,
      getStream: () => streamRef.current,
      onStatus: ({ text, state }) => setStatus({ text, state }),
      onLive: (pc) => { void tuneBitrate(pc, qualityRef.current) },
      onKey: (key) => {
        setPairings(savePairing({ ...pairing, key, mode: 'session' }))
      },
      onDenied: (reason) => {
        // A one-time code that was refused is useless, so drop it. A paired laptop is kept:
        // whoever answered couldn't prove anything, and the real laptop may come back.
        if (pairing.mode !== 'session') setPairings(forgetPairing(pairing.roomId))
        stop(reason === 'used' ? 'Code already used' : 'Code not accepted')
        setNotice(reason === 'used'
          ? 'That code was already used by another phone. On your laptop, choose “Pair a different phone” and scan the new code.'
          : 'Your laptop did not accept this code. Scan the newest QR code on your laptop.')
      }
    })
  }

  async function flip() {
    const next = facing === 'user' ? 'environment' : 'user'
    facingRef.current = next
    setFacing(next)
    writeStorage('pc.facing', next)
    try {
      await api.current.openCamera()
    } catch (error) {
      setStatus({ text: cameraMessage(error), state: '' })
    }
  }

  function use(roomId) {
    const entry = loadPairings().find((item) => item.roomId === roomId)
    if (entry) setPairings(savePairing(entry))
  }

  function forget(roomId) {
    setPairings(forgetPairing(roomId))
  }

  const secure = window.isSecureContext
  const standalone = isStandalone()
  const hint = installHint(platform())
  const calm = streaming && !awake && !sheetOpen
  const qualityLabel = { 480: '480p', 720: '720p', 1080: '1080p' }[quality]
  const facingLabel = facing === 'user' ? 'front' : 'back'

  return (
    <main className={calm ? 'stage calm' : 'stage'} onPointerDown={wake}>
      <video
        ref={videoRef}
        className={facing === 'user' ? 'mirror' : ''}
        autoPlay
        playsInline
        muted
      />

      {/* Stays up when the controls fade: on iPhone, leaving this screen pauses the camera. */}
      {streaming ? <p className="live-note"><i aria-hidden="true" />Live · keep this screen open</p> : null}

      <div className="stage-top fade">
        <Status className="pill" text={status.text} state={status.state} />
        <div className="pill" aria-label={`${qualityLabel}, ${facingLabel} camera`}>{qualityLabel} · {facingLabel}</div>
      </div>

      <div className="stage-bottom fade">
        {streaming ? null : (
          <div className="start-card">
            {active ? (
              <div className="room-line">
                <span>Laptop</span>
                <strong>{describe(active)}</strong>
                {pairings.length > 1 || active ? (
                  <button type="button" className="text-button" onClick={() => setSheetOpen(true)}>Change</button>
                ) : null}
              </div>
            ) : (
              <p className="pair-first">Scan the QR code on your laptop with this phone’s camera to connect.</p>
            )}
            {notice ? <p className="warn" role="alert">{notice}</p> : null}
            <p className="setup-line">
              {qualityLabel} · {mic === '1' ? 'phone mic on' : 'phone mic off'} ·{' '}
              <button type="button" className="text-button" onClick={() => setSheetOpen(true)}>Settings</button>
            </p>
            {secure ? null : <p className="warn">This address is not https. A phone can open the camera only on an https site.</p>}
          </div>
        )}

        <div className="controls">
          <button type="button" className="round" onClick={flip} aria-label="Switch camera">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7h3l2-3h8l2 3h3v12H3z" />
              <path d="M9 13a3 3 0 0 1 5.2-2" />
              <path d="M15 13a3 3 0 0 1-5.2 2" />
              <path d="M14.5 9v2.2h-2.2" />
              <path d="M9.5 17v-2.2h2.2" />
            </svg>
          </button>
          <button
            type="button"
            className={streaming ? 'go stop' : 'go'}
            disabled={!streaming && !active}
            onClick={() => (streaming ? stop() : start())}
          >
            {streaming ? 'Stop' : 'Start streaming'}
          </button>
          <button
            type="button"
            className="round"
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            aria-label="Settings"
            onClick={() => setSheetOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
          </button>
        </div>
        {streaming ? <p className="hint">Tap anywhere to show the controls.</p> : <p className="hint">Keep this screen open while you stream.</p>}
      </div>

      {sheetOpen ? (
        <div className="sheet-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) setSheetOpen(false) }}>
          <section className="sheet" role="dialog" aria-modal="true" aria-label="Camera settings">
            <div className="sheet-head">
              <strong>Settings</strong>
              <button type="button" className="primary btn-small" onClick={() => setSheetOpen(false)}>Done</button>
            </div>

            <div className="field">
              <span>Laptops this phone is paired with</span>
              {pairings.length ? (
                <ul className="pairings">
                  {pairings.map((item, index) => (
                    <li key={item.roomId} className={index === 0 ? 'on' : ''}>
                      <button type="button" className="pairing-pick" disabled={streaming} onClick={() => use(item.roomId)} aria-pressed={index === 0}>
                        <strong>{describe(item)}</strong>
                        <small>{index === 0 ? 'In use' : 'Tap to use'}</small>
                      </button>
                      <button type="button" className="text-button" disabled={streaming} onClick={() => forget(item.roomId)}>Forget</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="fine">None yet. Scan the QR code on your laptop to pair.</p>
              )}
            </div>

            <label className="field">
              <span>Quality</span>
              <select value={quality} disabled={streaming} onChange={(event) => { setQuality(event.target.value); writeStorage('pc.quality', event.target.value) }}>
                <option value="720">720p · 30 fps</option>
                <option value="1080">1080p · 30 fps</option>
                <option value="480">480p · 30 fps, weak Wi-Fi</option>
              </select>
            </label>
            <label className="field">
              <span>Mic</span>
              <select value={mic} disabled={streaming} onChange={(event) => { setMic(event.target.value); writeStorage('pc.mic', event.target.value) }}>
                <option value="0">Off, use the laptop mic</option>
                <option value="1">Send the phone mic</option>
              </select>
            </label>
            {streaming ? <p className="fine">Stop streaming to change quality, mic or laptop.</p> : null}
            <ThemePicker label="Color" />
            {!standalone && canInstall ? (
              <button type="button" className="secondary" onClick={install}>Install PhoneCam on this phone</button>
            ) : null}
            {!standalone && !canInstall && hint ? <p className="fine">{hint}</p> : null}
            <p className="fine">Keep this screen open while you stream. The phone pauses the camera if you switch to another app.</p>
            <a className="fine-link" href="#/rate">Rate PhoneCam</a>
          </section>
        </div>
      ) : null}
    </main>
  )
}
