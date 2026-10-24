import { renderSVG } from 'uqr'
import { PHONECAM_SITE } from '../../src/lib/extension.js'
import { newRoomState, pairToken, validRoomState } from '../../src/lib/pairing.js'

const STORE_KEY = 'room.v2'
const STATUS_KEY = 'status.v2'
const STALE_MS = 25000
const statusEl = document.getElementById('status')
const statusText = document.getElementById('status-text')
const pairedSteps = document.getElementById('paired-steps')
const footnote = document.getElementById('footnote')
const pairView = document.getElementById('pair')
const pairedView = document.getElementById('paired')
const qrEl = document.getElementById('qr')
const copyButton = document.getElementById('copy')

let link = ''
let lastStatus = null
let paired = false

const WORDS = {
  idle: ['Not in a meeting yet', ''],
  connecting: ['Starting…', 'wait'],
  waiting: ['Waiting for your phone', 'wait'],
  rejected: ['Waiting for your phone', 'wait'],
  dropped: ['Phone disconnected. Waiting…', 'wait'],
  reconnecting: ['Reconnecting…', 'wait'],
  network: ['Network problem. Retrying…', 'wait'],
  'in-use': ['PhoneCam is open in another tab', 'wait'],
  failed: ['Could not start. Retrying…', 'wait'],
  live: ['Live in your meeting', 'live']
}

// The meeting tab reports its state with a heartbeat; an old report means no meeting is using PhoneCam.
function renderStatus() {
  const fresh = lastStatus && Date.now() - lastStatus.at < STALE_MS
  const code = fresh ? lastStatus.code : 'idle'
  let [text, state] = WORDS[code] || WORDS.idle
  if (code === 'waiting' && !paired) text = 'Waiting for you to scan the code'
  statusText.textContent = text
  statusEl.dataset.state = state
  const live = code === 'live'
  // Once live, the setup steps have done their job.
  pairedSteps.hidden = live
  footnote.hidden = live
}

function show(room) {
  paired = Boolean(room.sessionKey)
  pairView.hidden = paired
  pairedView.hidden = !paired
  renderStatus()
  if (paired) {
    link = ''
    qrEl.innerHTML = ''
    return
  }
  link = `${PHONECAM_SITE}/#/camera?pair=${pairToken(room.roomId, room.pairKey)}&from=ext`
  const svg = renderSVG(link, { ecc: 'M', border: 2, pixelSize: 6, blackColor: '#111111', whiteColor: '#ffffff' })
  qrEl.innerHTML = svg.startsWith('<svg') && !svg.includes('<script') ? svg : ''
}

async function load() {
  const saved = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY]
  if (validRoomState(saved)) {
    show(saved)
    return
  }
  const fresh = newRoomState()
  await chrome.storage.local.set({ [STORE_KEY]: fresh })
  show(fresh)
}

async function pairNew() {
  const fresh = newRoomState()
  await chrome.storage.local.set({ [STORE_KEY]: fresh })
  show(fresh)
}

copyButton.addEventListener('click', async () => {
  if (!link) return
  try {
    await navigator.clipboard.writeText(link)
    copyButton.textContent = 'Copied'
    setTimeout(() => { copyButton.textContent = 'Copy phone link' }, 1500)
  } catch {
    /* The link is still in the QR code. */
  }
})

document.getElementById('new').addEventListener('click', pairNew)
document.getElementById('repair').addEventListener('click', pairNew)

// The page script saves the new key when the phone pairs; update this popup if it is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes[STORE_KEY] && validRoomState(changes[STORE_KEY].newValue)) show(changes[STORE_KEY].newValue)
  if (changes[STATUS_KEY]) {
    lastStatus = changes[STATUS_KEY].newValue || null
    renderStatus()
  }
})

chrome.storage.local.get(STATUS_KEY).then((saved) => {
  lastStatus = saved[STATUS_KEY] || null
  renderStatus()
})
setInterval(renderStatus, 5000)

load()
