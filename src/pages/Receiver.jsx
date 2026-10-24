import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Peer } from 'peerjs'
import { renderSVG } from 'uqr'
import Logo from '../components/Logo.jsx'
import Status from '../components/Status.jsx'
import { copyText } from '../lib/copy.js'
import { ROOM_PREFIX, cleanRoom, randomCode, readStorage, writeStorage } from '../lib/room.js'
import { hashUrl } from '../lib/url.js'

function roomFromLocation() {
  const hash = window.location.hash
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  return cleanRoom(new URLSearchParams(query).get('room'))
}

function qrMarkup(value) {
  const svg = renderSVG(value, {
    ecc: 'M',
    border: 2,
    pixelSize: 6,
    blackColor: '#111111',
    whiteColor: '#ffffff'
  })
  if (!svg.startsWith('<svg') || svg.includes('<script')) return ''
  return svg
}

export default function Receiver() {
  const [params, setParams] = useSearchParams()
  const [room, setRoom] = useState(() => roomFromLocation() || cleanRoom(readStorage('pc.receiverRoom', '')) || randomCode())
  const [status, setStatus] = useState({ text: 'Starting…', state: 'wait' })
  const [live, setLive] = useState(false)
  const [copied, setCopied] = useState('')
  const videoRef = useRef(null)
  const copyTimer = useRef(null)

  const mirror = params.get('mirror') === '1'
  const fit = params.get('fit') === 'cover' ? 'cover' : 'contain'
  const audio = params.get('audio') === '1'
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
  const [phoneOrigin, setPhoneOrigin] = useState(loopback ? '' : window.location.origin)

  const phoneUrl = phoneOrigin ? hashUrl(`/camera?room=${encodeURIComponent(room)}`, phoneOrigin) : ''
  const obsQuery = new URLSearchParams()
  obsQuery.set('room', room)
  if (mirror) obsQuery.set('mirror', '1')
  if (fit === 'cover') obsQuery.set('fit', 'cover')
  if (audio) obsQuery.set('audio', '1')
  const obsUrl = hashUrl(`/receiver?${obsQuery.toString()}`)
  const qr = useMemo(() => (phoneUrl ? qrMarkup(phoneUrl) : ''), [phoneUrl])

  useEffect(() => {
    document.title = 'Receiver · PhoneCam'
    if (!loopback) return undefined
    let cancelled = false
    let tries = 0
    let timer = 0
    const load = () => {
      fetch('/api/phone-origin')
        .then((response) => response.json())
        .then((data) => {
          if (cancelled) return
          if (typeof data.origin === 'string' && data.origin) setPhoneOrigin(data.origin)
          tries += 1
          if (!data.https && tries < 15) timer = setTimeout(load, 2000)
        })
        .catch(() => {
          if (!cancelled && tries < 15) timer = setTimeout(load, 2000)
        })
    }
    load()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [loopback])

  useEffect(() => {
    if (!room) return
    writeStorage('pc.receiverRoom', room)
    if (cleanRoom(params.get('room')) === room) return
    const next = new URLSearchParams(params)
    next.set('room', room)
    setParams(next, { replace: true })
  }, [room, params, setParams])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !audio
    if (audio) video.play().catch(() => {})
  }, [audio, live])

  useEffect(() => {
    if (!room) return undefined
    let cancelled = false
    let peer = null
    let current = null
    let generation = 0

    const dropped = () => {
      if (cancelled) return
      const call = current
      current = null
      if (call) {
        try { call.close() } catch { /* already closed */ }
      }
      if (videoRef.current) videoRef.current.srcObject = null
      setLive(false)
      setStatus({ text: 'Phone disconnected. Waiting…', state: 'wait' })
    }

    const connect = () => {
      const gen = ++generation
      if (peer && !peer.destroyed) {
        const old = peer
        peer = null
        old.destroy()
      }
      const next = new Peer(`${ROOM_PREFIX}${room}`, { debug: 0 })
      peer = next
      next.on('open', () => {
        if (!cancelled && gen === generation) setStatus({ text: 'Waiting for the phone…', state: 'wait' })
      })
      next.on('call', (incoming) => {
        if (cancelled || gen !== generation) return
        if (current) {
          try { current.close() } catch { /* already closed */ }
        }
        current = incoming
        incoming.answer()
        incoming.on('stream', (media) => {
          if (cancelled || gen !== generation) return
          const video = videoRef.current
          if (video) {
            video.srcObject = media
            video.play().catch(() => {})
          }
          setLive(true)
          setStatus({ text: 'Live from the phone', state: 'live' })
        })
        const pc = incoming.peerConnection
        if (pc) {
          pc.addEventListener('connectionstatechange', () => {
            if (cancelled || current !== incoming) return
            if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) dropped()
          })
        }
        incoming.on('close', () => {
          if (current === incoming) dropped()
        })
      })
      next.on('disconnected', () => {
        if (cancelled || gen !== generation) return
        setStatus({ text: 'Reconnecting…', state: 'wait' })
        setTimeout(() => {
          if (!cancelled && gen === generation && next && !next.destroyed) next.reconnect()
        }, 2000)
      })
      next.on('error', (error) => {
        if (cancelled || gen !== generation) return
        const retry = (delay, text) => {
          setStatus({ text, state: 'wait' })
          setTimeout(() => {
            if (!cancelled && gen === generation) connect()
          }, delay)
        }
        if (error.type === 'unavailable-id') {
          retry(5000, 'This room is already open in another tab or in OBS. Close the other one.')
          return
        }
        if (error.type === 'network' || error.type === 'server-error' || error.type === 'socket-error') {
          retry(4000, 'Network problem. Retrying…')
          return
        }
        setStatus({ text: 'Could not open the room.', state: 'wait' })
      })
    }

    connect()
    return () => {
      cancelled = true
      generation += 1
      try { current?.close() } catch { /* already closed */ }
      if (peer && !peer.destroyed) peer.destroy()
    }
  }, [room])

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  function toggle(key, value) {
    const next = new URLSearchParams(params)
    if (next.get(key) === value) next.delete(key)
    else next.set(key, value)
    if (!next.get('room')) next.set('room', room)
    setParams(next, { replace: true })
  }

  async function copy(value, which) {
    await copyText(value)
    setCopied(which)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(''), 1500)
  }

  return (
    <main className="receiver">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={mirror ? 'mirror' : ''}
        style={{ objectFit: fit }}
      />
      {live ? <p className="sr-only" role="status">{status.text}</p> : null}
      <div className={live ? 'scrim hidden' : 'scrim'}>
        <section className="card">
          <div className="card-head">
            <Logo to="/" />
            <Status text={status.text} state={status.state} />
          </div>
          <div className="setup">
            <div className="setup-copy">
              <h1>Open this room on your phone</h1>
              <p className="fine">The room code is the only password. Keep the random one. Open this page in one place only, then paste the OBS link. A second tab will take the room away from OBS.</p>
              <p className="room-code">{room}</p>
              <div className="chips" role="group" aria-label="Picture options">
                <button type="button" className={mirror ? 'chip on' : 'chip'} onClick={() => toggle('mirror', '1')} aria-pressed={mirror}>Mirror</button>
                <button type="button" className={fit === 'cover' ? 'chip on' : 'chip'} onClick={() => toggle('fit', 'cover')} aria-pressed={fit === 'cover'}>Fill frame</button>
                <button type="button" className={audio ? 'chip on' : 'chip'} onClick={() => toggle('audio', '1')} aria-pressed={audio}>Phone mic</button>
              </div>
              <p className="fine">These options are saved in the OBS link. For 720p, set the browser source to 1280 × 720. For 1080p, use 1920 × 1080.</p>
              <label>
                <span>OBS browser source</span>
                <span className="url-row">
                  <input readOnly value={obsUrl} onFocus={(event) => event.target.select()} aria-label="OBS browser source URL" />
                  <button type="button" className="primary" onClick={() => copy(obsUrl, 'obs')}>{copied === 'obs' ? 'Copied' : 'Copy'}</button>
                </span>
              </label>
              <label>
                <span>Phone link</span>
                <span className="url-row">
                  <input readOnly value={phoneUrl} placeholder="Looking for an address your phone can open" onFocus={(event) => event.target.select()} aria-label="Phone link" />
                  <button type="button" className="primary" disabled={!phoneUrl} onClick={() => copy(phoneUrl, 'phone')}>{copied === 'phone' ? 'Copied' : 'Copy'}</button>
                </span>
              </label>
              <ol className="steps">
                <li><span>In OBS, add a <b>Browser</b> source and paste the link.</span></li>
                <li><span>Click <b>Start Virtual Camera</b>.</span></li>
                <li><span>In the meeting app, choose <b>OBS Virtual Camera</b>.</span></li>
              </ol>
              <div className="row-actions">
                <button type="button" className="secondary" onClick={() => setRoom(randomCode())}>New room code</button>
              </div>
            </div>
            <div className="qr-col">
              {qr ? <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} /> : <p>Finding an address your phone can open.</p>}
              {phoneOrigin.startsWith('https://') ? (
                <p>Scan this code. Safari can open it and use the camera. Keep both devices on the same Wi-Fi so the picture connects.</p>
              ) : (
                <p>Scan while the phone is on the same Wi-Fi. This code uses the computer’s Wi-Fi address. A phone cannot open 127.0.0.1.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
