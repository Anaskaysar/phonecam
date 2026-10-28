// Every page loads cleanly on a laptop and a phone; navigation, footer, ratings, theme.
import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { BASE, PHONE, launch, sleep } from './helpers.mjs'

let browser

before(async () => {
  browser = await launch()
})

after(async () => {
  await browser?.close()
})

async function open(path, viewport) {
  const context = await browser.newContext(viewport === 'phone' ? PHONE : { viewport: { width: 1280, height: 860 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    // A 503 from /api/feedback is expected when the ratings database is empty in a fresh profile.
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text())
  })
  await page.goto(`${BASE}${path}`)
  await sleep(900)
  return { page, errors }
}

const GUIDES = ['/webcam', '/use-phone-as-webcam', '/iphone-as-webcam', '/android-as-webcam', '/meeting-webcam', '/obs-phone-camera', '/blurry-laptop-webcam']
const PAGES = ['/#/', '/#/receiver?mode=meeting', '/#/receiver?mode=share', '/#/receiver?mode=obs', '/#/camera', '/#/check', '/#/rate', '/#/report', '/privacy.html', '/guides', '/about', '/support', ...GUIDES]

for (const size of ['laptop', 'phone']) {
  for (const path of PAGES) {
    test(`${path} loads on a ${size} with no errors and no sideways scroll`, async () => {
      const { page, errors } = await open(path, size)
      assert.deepEqual(errors, [])
      assert.ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'no horizontal scroll')
      await page.context().close()
    })
  }
}

test('the home page asks once: one primary button in the hero', async () => {
  const { page } = await open('/#/', 'laptop')
  assert.equal(await page.locator('.lp-hero .lp-cta.primary').count(), 1)
  assert.equal(await page.locator('.site-nav-cta').count(), 0, 'no repeat in the nav on the home page')
  assert.equal(await page.locator('.lp-way.featured').count(), 1, 'one recommended card')
  await page.context().close()
})

test('nav links go to the right place and mark the current page', async () => {
  const { page } = await open('/#/check', 'laptop')
  const menu = page.locator('#nav-use-menu')
  await page.locator('.nav-drop-toggle').click()
  await menu.getByRole('link', { name: /Browser extension/ }).click()
  await sleep(500)
  assert.match(page.url(), /#\/receiver\?mode=meeting/)
  assert.equal(await page.locator('.mode.on strong').textContent(), 'Browser meeting')
  assert.equal(await menu.count(), 0, 'the menu closes after a pick')
  assert.match(await page.locator('.nav-drop-toggle').getAttribute('class'), /\bon\b/, 'Use PhoneCam is marked current')
  await page.locator('.nav-drop-toggle').click()
  assert.equal(await menu.locator('a[aria-current="page"] strong').textContent(), 'Browser extension')
  await page.keyboard.press('Escape')
  assert.equal(await menu.count(), 0, 'Escape closes the menu')
  await page.locator('.nav-drop-toggle').click()
  await menu.getByRole('link', { name: /^Receiver/ }).click()
  await sleep(300)
  await page.locator('.site-nav-links').getByRole('link', { name: 'How it works' }).click()
  await sleep(900)
  const top = await page.evaluate(() => document.getElementById('how').getBoundingClientRect().top)
  assert.ok(top > 0 && top < 200, `scrolled to How it works (top ${top})`)
  await page.context().close()
})

test('the phone menu opens, lists the pages and closes', async () => {
  const { page } = await open('/#/check', 'phone')
  assert.ok(await page.locator('.site-nav-toggle').isVisible())
  await page.locator('.site-nav-toggle').click()
  assert.ok(await page.locator('#site-nav-menu').isVisible())
  assert.equal(await page.locator('#site-nav-menu a').count(), 8, '4 Use PhoneCam links, 3 Learn links and the button')
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('#site-nav-menu').count(), 0)
  await page.context().close()
})

test('the footer has its columns and version on every page', async () => {
  for (const path of ['/#/', '/#/receiver', '/#/check', '/#/rate']) {
    const { page } = await open(path, 'laptop')
    assert.equal(await page.locator('.site-footer .sf-cols h2').count(), 4, path)
    assert.match(await page.locator('.sf-bottom').textContent(), /Version \d+\.\d+\.\d+/, path)
    await page.context().close()
  }
})

test('Guides and About are in the nav, and lead back into the app', async () => {
  const { page } = await open('/#/check', 'laptop')
  await page.locator('.site-nav-links').getByRole('link', { name: 'Guides' }).click()
  await page.waitForURL(/\/guides$/)
  assert.equal(await page.locator('.site-nav-links a[aria-current="page"]').textContent(), 'Guides')
  assert.equal(await page.locator('.guide-card').count(), 7, 'every guide is listed')
  await page.locator('.guide-card').first().click()
  await page.waitForURL(/\/webcam$/)
  assert.equal(await page.locator('.crumbs a').first().textContent(), 'Guides', 'a way back to the guides')
  await page.locator('.site-nav-links').getByRole('link', { name: 'About' }).click()
  await page.waitForURL(/\/about$/)
  await page.locator('.nav-drop summary').click()
  assert.ok(await page.locator('.nav-drop-menu').isVisible(), 'the static pages have the same Use PhoneCam menu')
  await page.keyboard.press('Escape')
  assert.ok(!(await page.locator('.nav-drop-menu').isVisible()))
  await page.locator('.nav-drop summary').click()
  await page.locator('.nav-drop-menu').getByRole('link', { name: /Browser extension/ }).click()
  await page.waitForURL(/#\/receiver\?mode=meeting/)
  await page.context().close()
})

test('every picture in the guides and About loads', async () => {
  for (const path of ['/guides', '/about', '/support', ...GUIDES]) {
    const { page } = await open(path, 'laptop')
    await page.evaluate(async () => {
      for (const img of document.images) { img.loading = 'eager'; if (!img.complete) await new Promise((done) => { img.onload = img.onerror = done }) }
    })
    // Only PhoneCam's own pictures: outside images (like country flags) depend on the network the test runs on.
    const broken = await page.evaluate(() => [...document.images].filter((img) => img.src.startsWith(location.origin) && !img.naturalWidth).map((img) => img.src))
    assert.deepEqual(broken, [], path)
    // The support page is text only; every other page should have a picture.
    if (path !== '/support') assert.ok(await page.locator('main img, article img').count() > 0, `${path} has pictures`)
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
    assert.equal((await page.request.get(BASE + new URL(ogImage).pathname)).status(), 200, `${path} social image`)
    await page.context().close()
  }
})

test('the sitemap lists the guides and About', async () => {
  const { page } = await open('/sitemap.xml', 'laptop')
  const xml = await (await page.request.get(`${BASE}/sitemap.xml`)).text()
  for (const path of ['/guides', '/about', '/support', ...GUIDES]) assert.ok(xml.includes(`https://phonecam.app${path}<`), path)
  await page.context().close()
})

test('the home page wears a new color edition each visit, and keeps it on refresh', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  const editions = []
  for (let visit = 0; visit < 3; visit += 1) {
    // A new tab has a fresh session, which counts as a new visit.
    const page = await context.newPage()
    await page.goto(`${BASE}/#/`)
    await sleep(500)
    editions.push(await page.locator('.lp').getAttribute('data-edition'))
    if (visit === 2) {
      await page.reload()
      await sleep(500)
      assert.equal(await page.locator('.lp').getAttribute('data-edition'), editions[2], 'a refresh keeps the edition')
    }
    await page.close()
  }
  assert.equal(new Set(editions).size, 3, `three visits, three editions: ${editions.join(', ')}`)
  await context.close()
})

test('black and white sticks until you switch color back on', async () => {
  const { page } = await open('/#/', 'laptop')
  await page.getByRole('button', { name: 'Black & white' }).click()
  await page.reload()
  await sleep(500)
  assert.equal(await page.locator('.lp').getAttribute('data-color-mode'), 'frozen')
  await page.getByRole('button', { name: 'Use color' }).click()
  assert.equal(await page.locator('.lp').getAttribute('data-color-mode'), 'edition')
  await page.context().close()
})

test('the accent color picked on the phone sticks after reload', async () => {
  const { page } = await open('/#/camera', 'phone')
  await page.getByRole('button', { name: 'Settings' }).first().click()
  await page.getByRole('radio', { name: 'Violet' }).click()
  await page.reload()
  await sleep(500)
  assert.equal((await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent'))).trim(), '#b8a3ff')
  await page.context().close()
})

test('the camera page asks you to scan before it lets you start', async () => {
  const { page } = await open('/#/camera', 'phone')
  assert.match(await page.textContent('.start-card'), /Scan the QR code on your laptop/)
  assert.ok(await page.getByRole('button', { name: 'Start streaming' }).isDisabled())
  await page.context().close()
})

test('a rating goes through and shows on the home page once approved', { timeout: 30000 }, async () => {
  const { page } = await open('/#/rate', 'phone')
  await page.getByRole('radio', { name: /^5 stars/ }).check()
  await page.fill('textarea', 'End-to-end test rating')
  await page.check('.check input')
  await page.getByRole('button', { name: 'Send rating' }).click()
  await page.waitForSelector('text=Thank you!')
  const again = await page.evaluate(async () => (await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rating: 4 }) })).status)
  assert.equal(again, 429, 'one rating per visitor per day')
  const summary = await page.evaluate(async () => (await fetch('/api/feedback')).json())
  assert.ok(summary.count >= 1)
  assert.ok(!summary.testimonials.some((t) => t.comment === 'End-to-end test rating'), 'not shown until approved')
  await page.context().close()
})

test('the site has no admin page, just a ghost', async () => {
  const { page } = await open('/#/admin', 'laptop')
  await page.waitForURL(`${BASE}/admin`)
  assert.match(await page.textContent('h1'), /wrong place, bro/)
  assert.equal(await page.locator('input[type="password"]').count(), 0)
  const api = await page.request.get(`${BASE}/api/admin/feedback`)
  assert.equal(api.status(), 404)
  await page.context().close()
})

test('the 404 page fits the request, gets sillier, and leads home', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  const page = await context.newPage()
  const cases = [['/.env', /Looking for secrets|Still digging/], ['/wp-login.php', /isn’t WordPress|Still not WordPress/], ['/webcamm', /trick-or-treating|Lost again/]]
  for (const [path, title] of cases) {
    const response = await page.goto(`${BASE}${path}`)
    assert.equal(response.status(), 404, path)
    assert.match(await page.textContent('h1'), title, path)
  }
  assert.equal(await page.locator('.site-nav .nav-drop').count(), 1, 'the same nav as the rest of the site')
  for (const [width, height] of [[1512, 730], [1280, 650], [390, 664]]) {
    await page.setViewportSize({ width, height })
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), `fits ${width}×${height} without scrolling`)
  }
  await page.setViewportSize({ width: 1280, height: 860 })
  await page.goto(`${BASE}/nope-1`)
  await page.goto(`${BASE}/nope-2`)
  assert.match(await page.textContent('h1'), /Professional Wanderer/, 'fifth wrong turn')
  assert.equal(await page.locator('.tally line').count(), 5)
  await page.getByRole('link', { name: /Take me home/ }).click()
  await page.waitForURL(`${BASE}/`)
  await context.close()
})