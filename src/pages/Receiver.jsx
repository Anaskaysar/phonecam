import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { renderSVG } from 'uqr'
import Logo from '../components/Logo.jsx'
import Status from '../components/Status.jsx'
import SiteNav from '../components/SiteNav.jsx'
import SiteFooter from '../components/SiteFooter.jsx'
import { copyText } from '../lib/copy.js'
import { EXTENSION_STORE_URL } from '../lib/extension.js'
import { openRoom } from '../lib/receiver-core.js'
import { loadRoomState, newRoomState, pairToken, parsePairToken, saveRoomState } from '../lib/pairing.js'
import { readStorage, writeStorage } from '../lib/room.js'
import { hashUrl } from '../lib/url.js'

const MODES = [
  { id: 'meeting', label: 'Browser meeting', note: 'Meet, Teams, Zoom on the web' },
  { id: 'share', label: 'Share a tab', note: 'Any app, nothing to install' },
  { id: 'obs', label: 'OBS', note: 'Streaming and desktop apps' }
]
const SHARE_KEY = 'pc.receiver.share.v2'
const OBS_KEY = 'pc.receiver.obs.v2'

function hashQuery() {
  const hash = window.location.hash
  return new URLSearchParams(hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '')
}

function initialMode() {
  const asked = hashQuery().get('mode')
  if (MODES.some((mode) => mode.id === asked)) return asked
  const saved = readStorage('pc.receiverMode', 'meeting')
  return MODES.some((mode) => mode.id === saved) ? saved : 'meeting'
}

function storedRoom(key) {
  const existing = loadRoomState(key)
  if (existing) return existing
  const fresh = newRoomState()
  saveRoomState(key, fresh)
  return fresh
}

function qrMarkup(value) {
  const svg = renderSVG(value, { ecc: 'M', border: 2, pixelSize: 6, blackColor: '#111111', whiteColor: '#ffffff' })
  if (!svg.startsWith('<svg') || svg.includes('<script')) return ''
  return svg
}

function CopyRow({ label, value, placeholder, copied, which, onCopy }) {
  return (
    <label>
      <span>{label}</span>
      <span className="url-row">
        <input readOnly value={value} placeholder={placeholder} onFocus={(event) => event.target.select()} aria-label={label} />
        <button type="button" className="primary" disabled={!value} onClick={() => onCopy(value, which)}>{copied === which ? 'Copied' : 'Copy'}</button>
      </span>
    </label>
  )
}

/* Plays the phone's stream for a room. Used by Share a tab, present mode and OBS. */
function useRoomVideo(room, active, storageKey, onState) {
  const videoRef = useRef(null)
  const [status, setStatus] = useState({ text: 'Starting…', state: 'wait' })
  const [live, setLive] = useState(false)
  const roomId = room?.roomId

  useEffect(() => {
    if (!active || !room) return undefined
    // openRoom keeps this object current (it clears pairKey and adds sessionKey on pairing).
    const working = { ...room }
    const close = openRoom(working, {
      onStatus: ({ text, state }) => setStatus({ text, state }),
      onStream: (media) => {
        const video = videoRef.current
        if (video) {
          video.srcObject = media
          video.play().catch(() => {})
        }
        setLive(true)
      },
      onDrop: () => {
        if (videoRef.current) videoRef.current.srcObject = null
        setLive(false)
      },
      onPaired: () => {
        const saved = { ...working }
        saveRoomState(storageKey, saved)
        onState?.(saved)
      }
    })
    return () => {
      close()
      setLive(false)
    }
    // Reconnect only when the room itself changes, not when its keys update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, roomId, storageKey])

  return { videoRef, status, live }
}

function PictureVideo({ videoRef, mirror, fit, audio, live }) {
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !audio
    if (audio) video.play().catch(() => {})
  }, [audio, live, videoRef])
  return <video ref={videoRef} autoPlay playsInline muted className={mirror ? 'mirror' : ''} style={{ objectFit: fit }} />
}

/* The page OBS loads: video only, never a code. Its keys live in OBS's own browser storage. */
function ObsView({ token, mirror, fit, audio }) {
  const parsed = parsePairToken(token)
  const storageKey = parsed ? `pc.obs.${parsed.roomId}` : ''
  const [room] = useState(() => {
    if (!parsed) return null
    return loadRoomState(storageKey) || { v: 2, roomId: parsed.roomId, pairKey: parsed.key, sessionKey: null, pairedAt: null }
  })
  const { videoRef, status, live } = useRoomVideo(room, Boolean(room), storageKey)
  useEffect(() => {
    document.title = 'PhoneCam · OBS'
  }, [])

  return (
    <main className="receiver obs">
      <PictureVideo videoRef={videoRef} mirror={mirror} fit={fit} audio={audio} live={live} />
      {live ? null : (
        <div className="obs-wait">
          <Status
            text={!room
              ? 'This OBS link is not valid. Copy a new one from the receiver page.'
              : /^Scan/.test(status.text) ? 'Waiting for your phone. Scan the OBS code on the PhoneCam receiver page.' : status.text}
            state={room ? status.state : ''}
          />
        </div>
      )}
    </main>
  )
}

export default function Receiver() {
  const [params, setParams] = useSearchParams()
  const obsToken = params.get('obs')
  const mirror = params.get('mirror') === '1'
  const fit = params.get('fit') === 'cover' ? 'cover' : 'contain'
  const audio = params.get('audio') === '1'

  if (obsToken) return <ObsView token={obsToken} mirror={mirror} fit={fit} audio={audio} />
  return <ReceiverSetup params={params} setParams={setParams} mirror={mirror} fit={fit} audio={audio} />
}

function ReceiverSetup({ params, setParams, mirror, fit, audio }) {
  const [mode, setMode] = useState(initialMode)
  const [shareRoom, setShareRoom] = useState(() => storedRoom(SHARE_KEY))
  const [obsRoom, setObsRoom] = useState(() => storedRoom(OBS_KEY))
  const [copied, setCopied] = useState('')
  const copyTimer = useRef(null)

  const present = params.get('present') === '1'
  const askedMode = params.get('mode')

  useEffect(() => {
    if (MODES.some((item) => item.id === askedMode)) {
      setMode(askedMode)
      writeStorage('pc.receiverMode', askedMode)
    }
  }, [askedMode])
  const sharing = present || mode === 'share'
  const { videoRef, status, live } = useRoomVideo(shareRoom, sharing, SHARE_KEY, setShareRoom)
  const [awake, setAwake] = useState(true)
  const awakeTimer = useRef(null)
  const [shareNote, setShareNote] = useState(false)
  const shareNoteArmed = useRef(true)
  const shareNoteVisible = useRef(false)

  const loopback = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
  const [phoneOrigin, setPhoneOrigin] = useState(loopback ? '' : window.location.origin)

  const pairUrl = (room, from) => (phoneOrigin && room.pairKey ? hashUrl(`/camera?pair=${pairToken(room.roomId, room.pairKey)}&from=${from}`, phoneOrigin) : '')
  const shareUrl = pairUrl(shareRoom, 'share')
  const obsPhoneUrl = pairUrl(obsRoom, 'obs')
  const obsQuery = new URLSearchParams()
  if (obsRoom.pairKey) obsQuery.set('obs', pairToken(obsRoom.roomId, obsRoom.pairKey))
  if (mirror) obsQuery.set('mirror', '1')
  if (fit === 'cover') obsQuery.set('fit', 'cover')
  if (audio) obsQuery.set('audio', '1')
  const obsUrl = obsRoom.pairKey ? hashUrl(`/receiver?${obsQuery.toString()}`) : ''
  const shareQr = useMemo(() => (shareUrl ? qrMarkup(shareUrl) : ''), [shareUrl])
  const obsQr = useMemo(() => (obsPhoneUrl ? qrMarkup(obsPhoneUrl) : ''), [obsPhoneUrl])

  useEffect(() => {
    document.title = present ? 'PhoneCam · share this tab' : 'Receiver · PhoneCam'
  }, [present])

  useEffect(() => {
    if (!loopback) return undefined
    let cancelled = false
    let tries = 0
    let timer = 0
    const load = () => {
      fetch('/api/phone-origin')
        .then((response) => {
          // Only the Vite dev server has this endpoint. Anywhere else, use this page's own address.
          if (!response.ok) {
            cancelled = true
            setPhoneOrigin(window.location.origin)
            return null
          }
          return response.json()
        })
        .then((data) => {
          if (cancelled || !data) return
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

  // In present mode the controls hide themselves so they stay out of the shared picture.
  useEffect(() => {
    if (!present) return undefined
    const wake = () => {
      setAwake(true)
      clearTimeout(awakeTimer.current)
      const delay = shareNoteVisible.current ? 8000 : 2500
      awakeTimer.current = setTimeout(() => setAwake(false), delay)
    }
    wake()
    window.addEventListener('pointermove', wake)
    window.addEventListener('keydown', wake)
    return () => {
      clearTimeout(awakeTimer.current)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [present])

  // Once the phone is live, remind them to share this tab. The note leaves with the
  // controls and does not come back until they enter present mode again.
  useEffect(() => {
    if (!present) {
      shareNoteArmed.current = true
      shareNoteVisible.current = false
      setShareNote(false)
      return
    }
    if (!live) {
      shareNoteVisible.current = false
      setShareNote(false)
      return
    }
    if (!shareNoteArmed.current) return
    shareNoteArmed.current = false
    shareNoteVisible.current = true
    setShareNote(true)
    setAwake(true)
    clearTimeout(awakeTimer.current)
    awakeTimer.current = setTimeout(() => setAwake(false), 8000)
  }, [present, live])

  useEffect(() => {
    if (!shareNote || awake || !shareNoteVisible.current) return undefined
    shareNoteVisible.current = false
    const timer = setTimeout(() => setShareNote(false), 260)
    return () => {
      clearTimeout(timer)
      setShareNote(false)
    }
  }, [shareNote, awake])

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  function dismissShareNote() {
    shareNoteVisible.current = false
    setShareNote(false)
  }

  function toggle(key, value) {
    const next = new URLSearchParams(params)
    if (next.get(key) === value) next.delete(key)
    else next.set(key, value)
    next.delete('room')
    setParams(next, { replace: true })
  }

  function pickMode(id) {
    setMode(id)
    writeStorage('pc.receiverMode', id)
    if (params.has('mode')) {
      const next = new URLSearchParams(params)
      next.delete('mode')
      setParams(next, { replace: true })
    }
  }

  function resetShare() {
    const fresh = newRoomState()
    saveRoomState(SHARE_KEY, fresh)
    setShareRoom(fresh)
  }

  function resetObs() {
    const fresh = newRoomState()
    saveRoomState(OBS_KEY, fresh)
    setObsRoom(fresh)
  }

  async function copy(value, which) {
    await copyText(value)
    setCopied(which)
    clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(''), 1500)
  }

  const video = <PictureVideo videoRef={videoRef} mirror={mirror} fit={fit} audio={audio} live={live} />

  const qrBlock = (qr, url, which) => (
    <div className="qr-col">
      {qr ? <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} /> : <p>Finding an address your phone can open.</p>}
      {phoneOrigin.startsWith('https://') ? (
        <p>Point your phone’s camera here. The code works once, for one phone.</p>
      ) : (
        <p>Scan while the phone is on the same Wi-Fi. This code uses the computer’s Wi-Fi address. A phone cannot open 127.0.0.1.</p>
      )}
      {url ? (
        <button type="button" className="text-button copy-link" onClick={() => copy(url, which)}>
          {copied === which ? 'Link copied' : 'Can’t scan? Copy the phone link'}
        </button>
      ) : null}
    </div>
  )

  const pairedBlock = (onReset) => (
    <div className="paired-col">
      <span className="paired-mark" aria-hidden="true">✓</span>
      <strong>Paired with your phone</strong>
      <p>Open PhoneCam on that phone and tap Start streaming. No other phone can connect here.</p>
      <button type="button" className="secondary btn-small" onClick={onReset}>Pair a different phone</button>
    </div>
  )

  const chips = (
    <div className="chips" role="group" aria-label="Picture options">
      <button type="button" className={mirror ? 'chip on' : 'chip'} onClick={() => toggle('mirror', '1')} aria-pressed={mirror}>Mirror</button>
      <button type="button" className={fit === 'cover' ? 'chip on' : 'chip'} onClick={() => toggle('fit', 'cover')} aria-pressed={fit === 'cover'}>Fill frame</button>
      <button type="button" className={audio ? 'chip on' : 'chip'} onClick={() => toggle('audio', '1')} aria-pressed={audio}>Phone mic</button>
    </div>
  )

  if (present) {
    // This tab may be shared in a meeting, so it never shows a QR code.
    const paired = Boolean(shareRoom.sessionKey)
    return (
      <main className={awake ? 'receiver present' : 'receiver present idle'}>
        {video}
        {live ? (
          <div className="present-bar">
            <div className="present-bar-actions">
              <Status className="pill" text={status.text} state={status.state} />
              <button type="button" className="pill pill-button" onClick={() => toggle('present', '1')}>Exit present mode</button>
            </div>
            {shareNote ? (
              <div className="share-note" role="status">
                <p><b>Now share this tab.</b> In your meeting, click Share screen and pick this tab. In the Zoom or Teams desktop apps, share this browser window.</p>
                <button type="button" className="primary btn-small" onClick={dismissShareNote}>Got it</button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="scrim">
            <section className="card present-card">
              <div className="card-head">
                <Logo />
                <Status text={paired ? status.text : 'No phone paired yet'} state={paired ? status.state : ''} />
              </div>
              <div className="setup-copy">
                {paired ? (
                  <ol className="steps">
                    <li><span>On your phone, open PhoneCam and tap <b>Start streaming</b>.</span></li>
                    <li><span>In your meeting, click <b>Share screen</b>, pick <b>Chrome Tab</b> (or this browser window) and choose this PhoneCam tab.</span></li>
                    <li><span>Turn off your meeting camera so people only see the phone.</span></li>
                  </ol>
                ) : (
                  <p className="lede-sm">Pair your phone before you share this tab. Exit present mode, scan the code with your phone, then come back.</p>
                )}
                <div className="row-actions">
                  <button type="button" className="secondary" onClick={() => toggle('present', '1')}>Exit present mode</button>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    )
  }

  return (
    <main className="receiver">
      {video}
      {live ? <p className="sr-only" role="status">{status.text}</p> : null}
      <div className={live ? 'scrim receiver-shell hidden' : 'scrim receiver-shell'}>
        <SiteNav />

        <section className="receiver-page">
          {mode === 'share' ? (
            <div className="card-head">
              <Status text={status.text} state={status.state} />
            </div>
          ) : null}

          <div className="modes" role="tablist" aria-label="How to use the phone camera">
            {MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={mode === item.id}
                className={mode === item.id ? 'mode on' : 'mode'}
                onClick={() => pickMode(item.id)}
              >
                <strong>{item.label}</strong>
                <span>{item.note}</span>
              </button>
            ))}
          </div>

          {mode === 'meeting' ? (
            <div className="setup ext-setup" role="tabpanel">
              <div className="setup-copy">
                <h1>Pick PhoneCam as your camera</h1>
                <p className="lede-sm">The PhoneCam extension adds your phone to the camera list in Google Meet, Microsoft Teams, Zoom, Discord, Whereby, Jitsi and Webex in Chrome or Edge.</p>
                <p className="store-note"><span className="store-dot" aria-hidden="true" />Free on the Chrome Web Store</p>
                <div className="row-actions">
                  <a className="primary button-link" href={EXTENSION_STORE_URL} target="_blank" rel="noopener">Add to Chrome</a>
                  <Link className="text-link" to="/check">Check that it works →</Link>
                </div>
                <ol className="steps">
                  <li><span>Click <b>Add to Chrome</b> on the store page. In Edge, choose <b>Allow extensions from other stores</b> when asked.</span></li>
                  <li><span>Reload any meeting tab that was already open.</span></li>
                  <li><span>Click the <b>PhoneCam</b> icon in the toolbar and scan its code with your phone. Tap <b>Start streaming</b>.</span></li>
                  <li><span>In the meeting’s camera settings, choose <b>PhoneCam</b>.</span></li>
                </ol>
                <p className="fine">The extension pairs with your phone by itself, so you don’t need this page open during the meeting. Works in Chrome, Edge, Brave and Arc on Mac, Windows, Linux and ChromeOS. For the Zoom or Teams desktop apps, use <button type="button" className="text-button" onClick={() => pickMode('share')}>Share a tab</button> or <button type="button" className="text-button" onClick={() => pickMode('obs')}>OBS</button>.</p>
              </div>
              <div className="success-picture" aria-hidden="true">
                <div className="sp-tile">
                  <div className="lp-scene" />
                  <span className="sp-name"><i className="lp-live" />You · PhoneCam</span>
                </div>
                <div className="sp-menu">
                  <p>Camera</p>
                  <div className="lp-menu-item">Built-in camera</div>
                  <div className="lp-menu-item on">PhoneCam <span>✓</span></div>
                </div>
                <p className="sp-caption">What you’ll see in your meeting</p>
              </div>
            </div>
          ) : null}

          {mode === 'share' ? (
            <div className="setup qr-first" role="tabpanel">
              {shareRoom.sessionKey ? pairedBlock(resetShare) : qrBlock(shareQr, shareUrl, 'phone')}
              <div className="setup-copy">
                <h1>Share the phone picture as a tab</h1>
                <p className="lede-sm">Works in every meeting app with nothing to install. People see it as a shared screen, not in your camera tile.</p>
                <ol className="steps">
                  <li><span>{shareRoom.sessionKey ? 'On your phone, open PhoneCam' : 'Scan the code with your phone'} and tap <b>Start streaming</b>.</span></li>
                  <li><span>Click <b>Present mode</b>. This tab turns into a clean video view.</span></li>
                  <li><span>In the meeting, click <b>Share screen</b> and pick this tab. In the Zoom or Teams desktop apps, share the browser window.</span></li>
                </ol>
                {chips}
                <div className="row-actions">
                  <button type="button" className="primary" onClick={() => toggle('present', '1')}>Present mode</button>
                </div>
              </div>
            </div>
          ) : null}

          {mode === 'obs' ? (
            <div className="setup qr-first" role="tabpanel">
              {qrBlock(obsQr, obsPhoneUrl, 'obsphone')}
              <div className="setup-copy">
                <h1>Use the phone in OBS</h1>
                <ol className="steps">
                  <li><span>In OBS, add a <b>Browser</b> source and paste the OBS link. Use 1280 × 720 for 720p, or 1920 × 1080 for 1080p.</span></li>
                  <li><span>Scan the code with your phone and tap <b>Start streaming</b>. The picture shows up in OBS.</span></li>
                  <li><span>Click <b>Start Virtual Camera</b>, then choose <b>OBS Virtual Camera</b> in your meeting app.</span></li>
                </ol>
                <CopyRow label="OBS browser source" value={obsUrl} copied={copied} which="obs" onCopy={copy} />
                {chips}
                <p className="fine">Keep the OBS link private: it pairs a phone with OBS. After your phone pairs, the link and the code stop working for anyone else. This page doesn’t receive video in OBS mode.</p>
                <div className="row-actions">
                  <button type="button" className="secondary" onClick={resetObs}>New OBS link and code</button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <SiteFooter />
      </div>
    </main>
  )
}
