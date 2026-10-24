/*
  Renders the guide covers (public/guides/img/*.svg) to PNG for social cards
  (og:image does not accept SVG on most sites). Needs Playwright's Chromium.
  Usage: node scripts/guide-art-png.mjs
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'guides', 'img')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
for (const name of fs.readdirSync(dir).filter((file) => file.endsWith('.svg') && !file.startsWith('diagram-'))) {
  await page.goto('file://' + path.join(dir, name))
  await page.screenshot({ path: path.join(dir, name.replace(/\.svg$/, '.png')) })
}
await browser.close()
console.log('PNG covers written')
