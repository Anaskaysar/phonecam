import crypto from 'node:crypto'
import { chromium, devices } from 'playwright'

export const BASE = process.env.PHONECAM_BASE || 'http://127.0.0.1:8787'
export const MEETING = process.env.PHONECAM_MEETING || 'http://127.0.0.1:8790/'
export const EXTENSION = process.env.PHONECAM_TEST_EXTENSION
export const PHONE = devices['Pixel 7']
export const IPHONE = devices['iPhone 13']
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Chromium's fake camera and auto-allowed permission prompts.
export const FAKE_MEDIA = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
  '--disable-features=WebRtcHideLocalIpsWithMdns'
]

export async function launch() {
  return chromium.launch({ args: FAKE_MEDIA })
}

/* A Chromium profile with the test build of the extension loaded. */
export async function launchWithExtension(dir) {
  const context = await chromium.launchPersistentContext(dir, {
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`, ...FAKE_MEDIA],
    permissions: ['camera', 'microphone']
  })
  return context
}

/* Unpacked extensions get their id from a hash of their folder path. */
export function extensionId(folder = EXTENSION) {
  return [...crypto.createHash('sha256').update(folder).digest('hex').slice(0, 32)]
    .map((char) => String.fromCharCode(97 + parseInt(char, 16)))
    .join('')
}

export async function phonePage(browser, device = PHONE) {
  const context = await browser.newContext({ ...device, permissions: ['camera'] })
  const page = await context.newPage()
  page.errors = []
  page.on('pageerror', (error) => page.errors.push(error.message))
  return page
}

export async function waitForText(page, selector, pattern, timeout = 20000) {
  await page.waitForFunction(
    ([sel, source]) => new RegExp(source).test(document.querySelector(sel)?.textContent || ''),
    [selector, pattern.source],
    { timeout }
  )
  return page.textContent(selector)
}

/* Tap the video first: while streaming, the phone controls fade out. */
export async function tapStop(page) {
  await page.mouse.click(150, 300)
  await sleep(300)
  await page.getByRole('button', { name: 'Stop' }).click()
}

export async function freshReceiver(page, mode = 'share') {
  await page.goto(`${BASE}/#/receiver?mode=${mode}`)
  await page.evaluate(() => {
    localStorage.removeItem('pc.receiver.share.v2')
    localStorage.removeItem('pc.receiver.obs.v2')
  })
  await page.reload()
  await sleep(1500)
}

export async function phoneLink(page) {
  await page.getByRole('button', { name: /Copy the phone link/ }).waitFor()
  return page.evaluate(() => {
    const share = JSON.parse(localStorage.getItem('pc.receiver.share.v2'))
    return `${location.origin}/#/camera?pair=${share.roomId}.${share.pairKey}&from=share`
  })
}

/* Draws a frame of a <video> to a canvas and returns the top-left pixel. */
export async function samplePixel(page, selector = 'video') {
  return page.evaluate((sel) => {
    const video = document.querySelector(sel)
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 36
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(video, 0, 0, 64, 36)
    return [...ctx.getImageData(2, 2, 1, 1).data.slice(0, 3)]
  }, selector)
}

// The extension's waiting card background (#0b0d11).
export const isWaitingCard = ([r, g, b]) => r === 11 && g === 13 && b === 17
