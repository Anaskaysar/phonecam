/*
  Runs in the extension's own world on the meeting page.

  The page asks for the phone with a "phonecam:start" event. This script opens
  the extension's room on the PhoneCam signalling server, checks that the phone
  holds the right key (see src/lib/pairing.js), and passes the phone's stream
  back through a hidden <video> element, which both worlds can see. Connections
  made from here follow the extension's rules, not the meeting site's, so a
  strict page policy cannot block them.
*/
import { openRoom } from '../../src/lib/receiver-core.js'
import { newRoomState, validRoomState } from '../../src/lib/pairing.js'

const CARRIER_ID = 'phonecam-bridge-video'
const STORE_KEY = 'room.v2'
const STATUS_KEY = 'status.v2'
const BEAT_MS = 10000

let close = null
let room = null
let active = false
let lastCode = 'idle'
let beat = 0

// The popup reads this to show "Waiting for your phone" or "Live". A heartbeat keeps it
// fresh, so a closed meeting tab reads as idle within a few seconds.
function report(code) {
  lastCode = code
  chrome.storage.local.set({ [STATUS_KEY]: { code, at: Date.now() } }).catch(() => {})
}

function say(type, data) {
  document.dispatchEvent(new CustomEvent(type, { detail: data === undefined ? null : JSON.stringify(data) }))
}

async function loadRoom() {
  const saved = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY]
  if (validRoomState(saved)) return saved
  const fresh = newRoomState()
  await chrome.storage.local.set({ [STORE_KEY]: fresh })
  return fresh
}

function carrier() {
  let video = document.getElementById(CARRIER_ID)
  if (!video) {
    video = document.createElement('video')
    video.id = CARRIER_ID
    video.muted = true
    video.hidden = true
    document.documentElement.appendChild(video)
  }
  return video
}

function open() {
  close?.()
  const working = { ...room }
  say('phonecam:status', { code: 'connecting', paired: Boolean(working.sessionKey) })
  close = openRoom(working, {
    onStatus: ({ code, paired }) => {
      say('phonecam:status', { code, paired })
      report(code)
    },
    onStream: (media) => {
      carrier().srcObject = media
      say('phonecam:stream')
    },
    onDrop: () => {
      const video = document.getElementById(CARRIER_ID)
      if (video) video.srcObject = null
      say('phonecam:drop')
    },
    onPaired: async () => {
      room = { ...working }
      await chrome.storage.local.set({ [STORE_KEY]: room })
    }
  })
}

async function start() {
  if (active) return
  active = true
  room = await loadRoom()
  if (!active) return
  open()
  clearInterval(beat)
  beat = setInterval(() => report(lastCode), BEAT_MS)
}

function stop() {
  if (active) report('idle')
  active = false
  clearInterval(beat)
  close?.()
  close = null
  const video = document.getElementById(CARRIER_ID)
  if (video) video.srcObject = null
}

document.addEventListener('phonecam:start', () => { start().catch(() => {}) })
document.addEventListener('phonecam:stop', stop)
window.addEventListener('pagehide', stop)

// "Pair a different phone" in the popup creates a new room; switch to it straight away.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORE_KEY] || !active) return
  const next = changes[STORE_KEY].newValue
  if (validRoomState(next) && next.roomId !== room?.roomId) {
    room = next
    open()
  }
})
