/*
  Runs inside the meeting page itself (the MAIN world).

  It adds a "PhoneCam" camera to navigator.mediaDevices. When the page picks
  it, the page gets a video track the extension writes frames into: a waiting
  card until the phone connects, then the phone's own frames. The meeting app
  keeps the same track the whole time, so a phone that drops and comes back
  needs no action in the meeting.

  The network side lives in bridge.js, because the page's security policy
  can block connections made from here.
*/
import { PHONECAM_DEVICE_ID, PHONECAM_GROUP_ID, PHONECAM_LABEL } from '../../src/lib/extension.js'

const CARRIER_ID = 'phonecam-bridge-video'
const WIDTH = 1280
const HEIGHT = 720
const STALL_MS = 3000
// States where PhoneCam is still trying, so the card pulses. Anything else is shown still.
const TRYING = new Set(['connecting', 'waiting', 'dropped', 'reconnecting', 'rejected', 'network', 'live'])

function install() {
  if (window.__phonecamInstalled) return
  Object.defineProperty(window, '__phonecamInstalled', { value: true })

  const proto = window.MediaDevices && window.MediaDevices.prototype
  if (!proto || !proto.getUserMedia || !proto.enumerateDevices) return
  if (typeof window.MediaStreamTrackGenerator !== 'function' || typeof window.MediaStreamTrackProcessor !== 'function') return

  const realEnumerate = proto.enumerateDevices
  const realGetUserMedia = proto.getUserMedia
  const feed = createFeed()

  proto.enumerateDevices = async function enumerateDevices() {
    const list = await realEnumerate.call(this)
    return [...list, fakeDevice()]
  }

  proto.getUserMedia = async function getUserMedia(constraints) {
    if (!constraints || !wantsPhone(constraints.video)) return realGetUserMedia.call(this, constraints)
    const tracks = []
    if (constraints.audio) {
      const mic = await realGetUserMedia.call(this, { audio: constraints.audio })
      tracks.push(...mic.getAudioTracks())
    }
    tracks.push(feed.track())
    return new MediaStream(tracks)
  }
}

function matches(value) {
  return value === PHONECAM_DEVICE_ID || (Array.isArray(value) && value.includes(PHONECAM_DEVICE_ID))
}

function wantsPhone(video) {
  if (!video || typeof video !== 'object') return false
  const id = video.deviceId
  if (matches(id)) return true
  if (id && typeof id === 'object' && (matches(id.exact) || matches(id.ideal))) return true
  return Array.isArray(video.advanced) && video.advanced.some((set) => set && wantsPhone(set))
}

function capabilities() {
  return {
    deviceId: PHONECAM_DEVICE_ID,
    groupId: PHONECAM_GROUP_ID,
    width: { min: 320, max: 1920 },
    height: { min: 180, max: 1080 },
    frameRate: { min: 1, max: 30 },
    aspectRatio: { min: 0.5, max: 2 },
    facingMode: [],
    resizeMode: ['none']
  }
}

function fakeDevice() {
  const Info = window.InputDeviceInfo || window.MediaDeviceInfo
  const device = Object.create(Info.prototype)
  const fields = { deviceId: PHONECAM_DEVICE_ID, groupId: PHONECAM_GROUP_ID, kind: 'videoinput', label: PHONECAM_LABEL }
  for (const [key, value] of Object.entries(fields)) {
    Object.defineProperty(device, key, { value, enumerable: true })
  }
  Object.defineProperty(device, 'toJSON', { value: () => ({ ...fields }) })
  Object.defineProperty(device, 'getCapabilities', { value: capabilities })
  return device
}

function createFeed() {
  let generator = null
  let writer = null
  let placeholderTimer = 0
  let stopTimer = 0
  let users = 0
  let reader = null
  let phoneTrackId = ''
  let writing = false
  let lastPhoneFrame = 0
  let size = { width: WIDTH, height: HEIGHT }
  let status = { code: 'connecting', paired: false }

  const canvas = new OffscreenCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  const send = (type) => document.dispatchEvent(new CustomEvent(type))

  document.addEventListener('phonecam:status', (event) => {
    try {
      const next = JSON.parse(event.detail)
      if (next && typeof next === 'object') status = { code: String(next.code || ''), paired: next.paired === true }
    } catch { /* ignore anything that is not ours */ }
  })
  document.addEventListener('phonecam:stream', () => {
    const carrier = document.getElementById(CARRIER_ID)
    const track = carrier && carrier.srcObject && carrier.srcObject.getVideoTracks()[0]
    if (track && track.id !== phoneTrackId && generator) pump(track)
  })
  document.addEventListener('phonecam:drop', stopPump)

  function drawPlaceholder() {
    // Everyone in the meeting sees this card, and Meet mirrors your own preview,
    // so it has no words and no code: a calm, symmetric "camera off" picture.
    // The steps for pairing live in the extension popup, which only you see.
    const cx = WIDTH / 2
    const cy = HEIGHT / 2
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 560)
    glow.addColorStop(0, '#171b23')
    glow.addColorStop(1, '#0b0d11')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, WIDTH, HEIGHT)

    const trying = TRYING.has(status.code)
    if (trying) {
      // Two soft rings that slowly grow and fade, one after the other.
      const period = 2800
      for (const offset of [0, 0.5]) {
        const t = ((performance.now() / period) + offset) % 1
        ctx.strokeStyle = `rgba(223, 242, 90, ${(0.28 * (1 - t)).toFixed(3)})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(cx, cy, 64 + t * 90, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    // The PhoneCam mark, dimmed when PhoneCam has stopped trying.
    ctx.globalAlpha = trying ? 1 : 0.45
    ctx.fillStyle = '#dff25a'
    ctx.beginPath()
    ctx.roundRect(cx - 48, cy - 48, 96, 96, 26)
    ctx.fill()
    ctx.fillStyle = '#161a04'
    ctx.beginPath()
    ctx.arc(cx, cy, 20, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  function tick() {
    if (writing || !writer) return
    // Show the waiting card if the phone goes quiet, for example when iOS pauses the camera.
    if (reader && performance.now() - lastPhoneFrame < STALL_MS) return
    drawPlaceholder()
    const frame = new VideoFrame(canvas, { timestamp: Math.round(performance.now() * 1000) })
    size = { width: WIDTH, height: HEIGHT }
    writing = true
    writer.write(frame)
      .catch(() => { try { frame.close() } catch { /* already closed */ } })
      .finally(() => { writing = false })
  }

  async function pump(track) {
    stopPump()
    const processor = new MediaStreamTrackProcessor({ track })
    const mine = processor.readable.getReader()
    reader = mine
    phoneTrackId = track.id
    lastPhoneFrame = performance.now()
    try {
      while (reader === mine && writer) {
        const { value, done } = await mine.read()
        if (done) break
        if (reader !== mine || !writer) {
          value.close()
          break
        }
        size = { width: value.displayWidth, height: value.displayHeight }
        lastPhoneFrame = performance.now()
        try {
          await writer.write(value)
        } catch {
          try { value.close() } catch { /* already closed */ }
          break
        }
      }
    } catch {
      /* The phone track ended or the reader was cancelled. */
    } finally {
      if (reader === mine) {
        reader = null
        phoneTrackId = ''
      }
    }
  }

  function stopPump() {
    const current = reader
    reader = null
    phoneTrackId = ''
    if (current) current.cancel().catch(() => {})
  }

  function ensure() {
    clearTimeout(stopTimer)
    if (generator) return
    generator = new MediaStreamTrackGenerator({ kind: 'video' })
    writer = generator.writable.getWriter()
    placeholderTimer = setInterval(tick, 100)
    tick()
    send('phonecam:start')
  }

  function shutdown() {
    if (users > 0 || !generator) return
    stopPump()
    clearInterval(placeholderTimer)
    send('phonecam:stop')
    writer.close().catch(() => {})
    generator.stop()
    generator = null
    writer = null
    status = { code: 'connecting', paired: false }
  }

  function release() {
    users = Math.max(0, users - 1)
    if (users === 0) {
      clearTimeout(stopTimer)
      // Meeting apps often stop a track and ask for a new one right away.
      stopTimer = setTimeout(shutdown, 8000)
    }
  }

  function decorate(track) {
    users += 1
    let released = false
    const done = () => {
      if (released) return
      released = true
      release()
    }
    const realStop = track.stop.bind(track)
    const realSettings = track.getSettings.bind(track)
    const realClone = track.clone.bind(track)
    Object.defineProperties(track, {
      label: { get: () => PHONECAM_LABEL, configurable: true },
      stop: { value() { done(); realStop() }, configurable: true, writable: true },
      clone: { value() { return decorate(realClone()) }, configurable: true, writable: true },
      getSettings: {
        value() {
          return {
            ...realSettings(),
            deviceId: PHONECAM_DEVICE_ID,
            groupId: PHONECAM_GROUP_ID,
            width: size.width,
            height: size.height,
            aspectRatio: size.width / size.height,
            frameRate: 30,
            resizeMode: 'none'
          }
        },
        configurable: true,
        writable: true
      },
      getCapabilities: { value: capabilities, configurable: true, writable: true },
      applyConstraints: { value: async () => {}, configurable: true, writable: true }
    })
    track.addEventListener('ended', done)
    return track
  }

  return {
    track() {
      ensure()
      return decorate(generator.clone())
    }
  }
}

install()
