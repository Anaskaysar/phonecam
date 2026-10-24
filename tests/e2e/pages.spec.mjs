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

const PAGES = ['/#/', '/#/receiver?mode=meeting', '/#/receiver?mode=share', '/#/receiver?mode=obs', '/#/camera', '/#/check', '/#/rate', '/privacy.html']

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
  await page.locator('.site-nav-links').getByRole('link', { name: 'Browser extension' }).click()
  await sleep(500)
  assert.match(page.url(), /#\/receiver\?mode=meeting/)
  assert.equal(await page.locator('.mode.on strong').textContent(), 'Browser meeting')
  assert.equal(await page.locator('.site-nav-links a[aria-current="page"]').textContent(), 'Browser extension')
  await page.locator('.site-nav-links').getByRole('link', { name: 'Receiver' }).click()
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
  assert.equal(await page.locator('#site-nav-menu a').count(), 5)
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('#site-nav-menu').count(), 0)
  await page.context().close()
})

test('the footer has its columns, version and color picker on every page', async () => {
  for (const path of ['/#/', '/#/receiver', '/#/check', '/#/rate']) {
    const { page } = await open(path, 'laptop')
    assert.equal(await page.locator('.site-footer .sf-cols h2').count(), 3, path)
    assert.match(await page.locator('.sf-bottom').textContent(), /Version \d+\.\d+\.\d+/, path)
    assert.equal(await page.locator('.site-footer .swatch').count(), 5, path)
    await page.context().close()
  }
})

test('a color choice sticks after reload', async () => {
  const { page } = await open('/#/', 'laptop')
  await page.locator('.site-footer').getByRole('radio', { name: 'Violet' }).click()
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
