// The browser extension: fake camera in a meeting page, pairing, popup status, OBS view.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { BASE, IPHONE, MEETING, extensionId, isWaitingCard, launch, launchWithExtension, phonePage, samplePixel, sleep, waitForText } from './helpers.mjs'

let context
let phones
let popup
let meeting
let room
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'phonecam-ext-'))

before(async () => {
  context = await launchWithExtension(profile)
  phones = await launch()
  popup = await context.newPage()
  await popup.setViewportSize({ width: 332, height: 600 })
  await popup.goto(`chrome-extension://${extensionId()}/popup.html`)
  await sleep(800)
  room = await popup.evaluate(async () => (await chrome.storage.local.get('room.v2'))['room.v2'])
})

after(async () => {
  await context?.close()
  await phones?.close()
  fs.rmSync(profile, { recursive: true, force: true })
})

test('the popup shows a QR code, no room id, and "Not in a meeting yet"', async () => {
  assert.ok(await popup.$eval('#qr', (el) => el.innerHTML.startsWith('<svg')))
  assert.ok(!(await popup.textContent('body')).includes(room.roomId))
  assert.equal(await popup.textContent('#status-text'), 'Not in a meeting yet')
})

test('PhoneCam appears in the meeting page camera list', async () => {
  meeting = await context.newPage()
  await meeting.goto(MEETING)
  const cameras = await meeting.evaluate(async () => (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput').map((d) => `${d.label}|${d.deviceId}`))
  assert.ok(cameras.includes('PhoneCam|phonecam-virtual-camera'), cameras.join(', '))
})

test('picking PhoneCam gives a working track that shows the waiting card', { timeout: 30000 }, async () => {
  const info = await meeting.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: 'phonecam-virtual-camera' } }, audio: true })
    window.stream = stream
    const video = document.createElement('video')
    video.muted = true
    video.srcObject = stream
    video.style.cssText = 'width:640px;height:360px'
    document.body.appendChild(video)
    await video.play()
    const track = stream.getVideoTracks()[0]
    return { label: track.label, settings: track.getSettings(), audio: stream.getAudioTracks().length }
  })
  assert.equal(info.label, 'PhoneCam')
  assert.equal(info.settings.deviceId, 'phonecam-virtual-camera')
  assert.equal(info.audio, 1, 'the laptop mic still comes through')
  await sleep(2000)
  assert.ok(isWaitingCard(await samplePixel(meeting)), 'waiting card is drawn')
})

test('the popup says it is waiting for the scan', { timeout: 20000 }, async () => {
  await waitForText(popup, '#status-text', /Waiting for you to scan/)
})

test('the phone pairs with the extension and the meeting shows its picture', { timeout: 60000 }, async () => {
  const phone = await phonePage(phones, IPHONE)
  await phone.goto(`${BASE}/#/camera?pair=${room.roomId}.${room.pairKey}&from=ext`)
  await sleep(800)
  assert.match(await phone.textContent('.room-line'), /Browser extension/)
  await phone.getByRole('button', { name: 'Start streaming' }).click()
  await waitForText(phone, '.stage-top .status', /Live/)
  await sleep(2000)
  assert.ok(!isWaitingCard(await samplePixel(meeting)), 'phone frames replace the waiting card')
  assert.equal(await meeting.evaluate(() => window.stream.getVideoTracks()[0].readyState), 'live')
})

test('the popup turns live and folds the setup steps away', { timeout: 20000 }, async () => {
  await waitForText(popup, '#status-text', /Live in your meeting/)
  assert.ok(await popup.$eval('#paired-steps', (el) => el.hidden))
  const saved = await popup.evaluate(async () => (await chrome.storage.local.get('room.v2'))['room.v2'])
  assert.equal(saved.pairKey, null, 'the QR key is burned')
  assert.match(saved.sessionKey, /^[A-Za-z0-9_-]{43}$/)
})

test('the popup goes back to idle after the meeting closes', { timeout: 60000 }, async () => {
  await meeting.close()
  await waitForText(popup, '#status-text', /Not in a meeting yet/, 40000)
})

test('the OBS view never shows a code', async () => {
  const browser = await launch()
  try {
    const laptop = await (await browser.newContext()).newPage()
    await laptop.goto(`${BASE}/#/receiver?mode=obs`)
    await sleep(1200)
    const obsUrl = await laptop.inputValue('input[aria-label="OBS browser source"]')
    const obsRoom = obsUrl.match(/obs=([a-z2-7]{16})/)[1]
    const obs = await (await browser.newContext()).newPage()
    await obs.goto(obsUrl)
    await sleep(1200)
    assert.ok(!(await obs.textContent('body')).includes(obsRoom))
    assert.equal(await obs.$('.qr'), null)
  } finally {
    await browser.close()
  }
})
