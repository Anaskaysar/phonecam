import { useEffect, useRef, useState } from 'react'
import { Peer } from 'peerjs'
import Status from '../components/Status.jsx'
import { cameraMessage, captureConstraints, tuneBitrate } from '../lib/media.js'
import { ROOM_PREFIX, cleanRoom, readStorage, writeStorage } from '../lib/room.js'
import { useSearchParams } from 'react-router-dom'

const QUALITIES = ['480', '720', '1080']

function initialQuality() {
  const saved = readStorage('pc.quality', '720')
  return QUALITIES.includes(saved) ? saved : '720'
}

function initialFacing() {
  const saved = readStorage('pc.facing', 'user')
  return saved === 'environment' ? 'environment' : 'user'
}

export default function Camera() {
  const [params] = useSearchParams()
  const [room, setRoom] = useState(() => cleanRoom(params.get('room')) || readStorage('pc.room', ''))
  const [quality, setQuality] = useState(initialQuality)
  const [mic, setMic] = useState(readStorage('pc.mic', '0') === '1' ? '1' : '0')
  const [facing, setFacing] = useState(initialFacing)
  const [streaming, setStreaming] = useState(false)
  const [showSettings, setShowSettings] = useState(true)
  const [res, setRes] = useState('—')
  const [status, setStatus] = useState({ text: 'Starting camera…', state: '' })

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const peerRef = useRef(null)
  const callRef = useRef(null)
  const retryRef = useRef(null)
  const wakeLockRef = useRef(null)
  const streamingRef = useRef(false)
  const roomRef = useRef(room)
  const qualityRef = useRef(quality)
  const micRef = useRef(mic)
  const facingRef = useRef(facing)
  const api = useRef({})

  roomRef.current = room
  qualityRef.current = quality
  micRef.current = mic
  facingRef.current = facing

  function setStatusText(text, state = '') {
    setStatus({ text, state })
  }

  api.current.setStatus = setStatusText

  api.current.requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen')
    } catch {
      /* The browser can refuse a wake lock. Streaming still works. */
    }
  }

  api.current.scheduleRetry = () => {
    clearTimeout(retryRef.current)
    const call = callRef.current
    callRef.current = null
    if (call) {
      try { call.close() } catch { /* already closed */ }
    }
    retryRef.current = setTimeout(() => api.current.placeCall(), 3000)
  }

  api.current.placeCall = () => {
    clearTimeout(retryRef.current)
    const peer = peerRef.current
    const media = streamRef.current
    if (!streamingRef.current || !peer || peer.destroyed || !media) return
    const code = cleanRoom(roomRef.current)
    if (!code) return
    setStatusText('Looking for the laptop…', 'wait')
    const call = peer.call(`${ROOM_PREFIX}${code}`, media)
    if (!call) {
      api.current.scheduleRetry()
      return
    }
    callRef.current = call
    const pc = call.peerConnection
    if (pc) {
      pc.addEventListener('connectionstatechange', () => {
        if (!streamingRef.current || callRef.current !== call) return
        if (pc.connectionState === 'connected') {
          setStatusText('Live on your laptop', 'live')
          void tuneBitrate(pc, qualityRef.current)
          return
        }
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          setStatusText('Connection lost. Retrying…', 'wait')
          api.current.scheduleRetry()
        }
      })
    }
    call.on('close', () => {
      if (streamingRef.current && callRef.current === call) {
        setStatusText('Laptop disconnected. Retrying…', 'wait')
        api.current.scheduleRetry()
      }
    })
    call.on('error', () => {
      if (streamingRef.current) api.current.scheduleRetry()
    })
  }

  api.current.onPeerError = (error) => {
    if (!streamingRef.current) return
    if (error.type === 'peer-unavailable') {
      setStatusText('Laptop page is not open yet. Retrying…', 'wait')
      api.current.scheduleRetry()
      return
    }
    if (error.type === 'network' || error.type === 'server-error' || error.type === 'socket-error') {
      setStatusText('Network problem. Retrying…', 'wait')
      setTimeout(() => {
        const peer = peerRef.current
        if (streamingRef.current && peer && !peer.destroyed && peer.disconnected) peer.reconnect()
      }, 3000)
      return
    }
    setStatusText('Could not connect.')
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
    const settings = stream.getVideoTracks()[0]?.getSettings() || {}
    setRes(`${settings.width || '?'}×${settings.height || '?'} · ${facingRef.current === 'user' ? 'front' : 'back'}`)
    const videoTrack = stream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.onended = () => {
        if (streamingRef.current) {
          api.current.openCamera().catch((error) => api.current.setStatus(cameraMessage(error)))
        }
      }
    }
    const pc = callRef.current?.peerConnection
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
        api.current.openCamera().catch((error) => api.current.setStatus(cameraMessage(error)))
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      alive = false
      streamingRef.current = false
      clearTimeout(retryRef.current)
      document.removeEventListener('visibilitychange', onVisible)
      try { callRef.current?.close() } catch { /* already closed */ }
      if (peerRef.current && !peerRef.current.destroyed) peerRef.current.destroy()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      wakeLockRef.current?.release?.().catch(() => {})
    }
  }, [])

  async function start() {
    if (streamingRef.current) return
    const code = cleanRoom(room)
    if (!code) {
      setStatusText('Enter the room code from your laptop.')
      return
    }
    setRoom(code)
    roomRef.current = code
    writeStorage('pc.room', code)
    writeStorage('pc.quality', quality)
    writeStorage('pc.mic', mic)
    streamingRef.current = true
    setStreaming(true)
    try {
      await api.current.openCamera()
    } catch (error) {
      streamingRef.current = false
      setStreaming(false)
      setStatusText(cameraMessage(error))
      return
    }
    await api.current.requestWakeLock()
    setStatusText('Connecting…', 'wait')
    const peer = new Peer({ debug: 0 })
    peerRef.current = peer
    peer.on('open', () => api.current.placeCall())
    peer.on('error', (error) => api.current.onPeerError(error))
    peer.on('disconnected', () => {
      if (!streamingRef.current) return
      setTimeout(() => {
        const current = peerRef.current
        if (streamingRef.current && current && !current.destroyed && current.disconnected) current.reconnect()
      }, 2000)
    })
  }

  function stop() {
    streamingRef.current = false
    clearTimeout(retryRef.current)
    const call = callRef.current
    callRef.current = null
    if (call) {
      try { call.close() } catch { /* already closed */ }
    }
    const peer = peerRef.current
    peerRef.current = null
    if (peer && !peer.destroyed) peer.destroy()
    wakeLockRef.current?.release?.().catch(() => {})
    wakeLockRef.current = null
    setStreaming(false)
    setStatusText('Stopped')
  }

  async function flip() {
    const next = facing === 'user' ? 'environment' : 'user'
    facingRef.current = next
    setFacing(next)
    writeStorage('pc.facing', next)
    try {
      await api.current.openCamera()
    } catch (error) {
      setStatusText(cameraMessage(error))
    }
  }

  const secure = window.isSecureContext

  return (
    <main className="stage">
      <video
        ref={videoRef}
        className={facing === 'user' ? 'mirror' : ''}
        autoPlay
        playsInline
        muted
      />
      <div className="stage-top">
        <Status className="pill" text={status.text} state={status.state} />
        <div className="pill" aria-label={`Resolution ${res}`}>{res}</div>
      </div>
      <div className="stage-bottom">
        <div className={showSettings ? 'panel' : 'panel hidden'}>
          <label className="field">
            <span>Room</span>
            <input
              value={room}
              onChange={(event) => setRoom(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !streaming) start()
              }}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="Room code from your laptop"
              disabled={streaming}
            />
          </label>
          <label className="field">
            <span>Quality</span>
            <select value={quality} disabled={streaming} onChange={(event) => setQuality(event.target.value)}>
              <option value="720">720p · 30 fps</option>
              <option value="1080">1080p · 30 fps</option>
              <option value="480">480p · 30 fps, weak Wi-Fi</option>
            </select>
          </label>
          <label className="field">
            <span>Mic</span>
            <select value={mic} disabled={streaming} onChange={(event) => setMic(event.target.value)}>
              <option value="0">Off, use the laptop mic</option>
              <option value="1">Send the phone mic</option>
            </select>
          </label>
          {secure ? null : <p className="warn">This address is not https. A phone can open the camera only on an https site.</p>}
        </div>
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
          <button type="button" className={streaming ? 'go stop' : 'go'} onClick={() => (streaming ? stop() : start())}>
            {streaming ? 'Stop' : 'Start streaming'}
          </button>
          <button
            type="button"
            className="round"
            aria-expanded={showSettings}
            aria-label={showSettings ? 'Hide settings' : 'Show settings'}
            onClick={() => setShowSettings((open) => !open)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
        <p className={showSettings ? 'hint' : 'hint hidden'}>
          Leave this screen on while you stream. The phone pauses the camera if you switch away.
        </p>
        <p className={showSettings ? 'hint install-note' : 'hint install-note hidden'}>
          On iPhone: Share, then Add to Home Screen. The icon opens the camera.
        </p>
      </div>
    </main>
  )
}
