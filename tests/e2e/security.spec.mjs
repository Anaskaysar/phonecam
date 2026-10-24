// Pairing and attack tests against the real signalling server (wrangler dev).
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { BASE, IPHONE, freshReceiver, launch, phoneLink, phonePage, sleep, tapStop, waitForText } from './helpers.mjs'

let browser
let laptop
let phoneA
let link
let roomId

const laptopLive = () => laptop.evaluate(() => document.querySelector('.scrim')?.classList.contains('hidden'))

before(async () => {
  browser = await launch()
  laptop = await (await browser.newContext()).newPage()
  await freshReceiver(laptop, 'share')
  link = await phoneLink(laptop)
  roomId = link.match(/pair=([a-z2-7]{16})\./)[1]
})

after(async () => {
  await browser?.close()
})

test('the receiver offers a one-time pair link and never shows the room id', async () => {
  assert.match(link, /pair=[a-z2-7]{16}\.[A-Za-z0-9_-]{43}&from=share$/)
  assert.ok(!(await laptop.textContent('body')).includes(roomId))
})

test('a phone pairs from the link and goes live', { timeout: 60000 }, async () => {
  phoneA = await phonePage(browser)
  await phoneA.goto(link)
  await sleep(1000)
  assert.ok(!phoneA.url().includes('pair='), 'the key is removed from the address bar')
  await phoneA.getByRole('button', { name: 'Start streaming' }).click()
  await waitForText(phoneA, '.stage-top .status', /Live/)
  await laptop.waitForFunction(() => document.querySelector('.scrim')?.classList.contains('hidden'), null, { timeout: 15000 })
  assert.deepEqual(phoneA.errors, [])
})

test('pairing burns the QR key and gives the phone its own key', async () => {
  const phone = await phoneA.evaluate(() => JSON.parse(localStorage.getItem('pc.pairings.v2'))[0])
  const room = await laptop.evaluate(() => JSON.parse(localStorage.getItem('pc.receiver.share.v2')))
  assert.equal(phone.mode, 'session')
  assert.equal(room.pairKey, null)
  assert.equal(room.sessionKey, phone.key)
  assert.ok(!link.includes(phone.key))
})

test('a second phone with the same code is refused', { timeout: 60000 }, async () => {
  const phoneB = await phonePage(browser, IPHONE)
  await phoneB.goto(link)
  await sleep(800)
  await phoneB.getByRole('button', { name: 'Start streaming' }).click()
  await waitForText(phoneB, '.start-card', /already used/)
  assert.ok(await laptopLive(), 'the laptop stays live with the first phone')
})

test('someone without the key cannot push video into the call', { timeout: 60000 }, async () => {
  const attacker = await (await browser.newContext()).newPage()
  await attacker.goto(`${BASE}/attacker.html`)
  const log = await attacker.evaluate((room) => window.intrude(room), roomId)
  assert.ok(log.includes('data:deny'), log.join(','))
  assert.ok(!log.includes('got-answer-stream'), log.join(','))
  assert.match(await phoneA.textContent('.stage-top .status'), /Live/)
  assert.ok(await laptopLive())
})

test('the paired phone reconnects later without scanning', { timeout: 60000 }, async () => {
  await tapStop(phoneA)
  await sleep(1500)
  await phoneA.reload()
  await sleep(1000)
  assert.match(await phoneA.textContent('.room-line'), /paired/)
  await phoneA.getByRole('button', { name: 'Start streaming' }).click()
  await waitForText(phoneA, '.stage-top .status', /Live/)
  await tapStop(phoneA)
})

test('a phone will not stream to someone who grabbed the room first', { timeout: 90000 }, async () => {
  await freshReceiver(laptop, 'share')
  const link2 = await phoneLink(laptop)
  const room2 = link2.match(/pair=([a-z2-7]{16})\./)[1]
  // The real laptop leaves; the squatter takes its room id.
  await laptop.goto(`${BASE}/#/receiver?mode=meeting`)
  await laptop.reload()
  await sleep(1500)
  const attacker = await (await browser.newContext()).newPage()
  await attacker.goto(`${BASE}/attacker.html`)
  await attacker.evaluate((room) => window.squat(room), room2)
  await sleep(800)
  const phoneC = await phonePage(browser)
  await phoneC.goto(link2)
  await sleep(800)
  await phoneC.getByRole('button', { name: 'Start streaming' }).click()
  await waitForText(phoneC, '.stage-top .status', /could not prove/)
  const log = await attacker.evaluate(() => window.squatLog)
  assert.ok(!log.includes('PHONE-CALLED-SQUATTER'), log.join(','))
})

test('a junk pair link is refused politely', async () => {
  const phone = await phonePage(browser)
  await phone.goto(`${BASE}/#/camera?pair=nope.nope`)
  await waitForText(phone, '.start-card', /not a PhoneCam code/)
  assert.ok(await phone.getByRole('button', { name: 'Start streaming' }).isDisabled())
})
