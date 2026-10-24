/*
  Builds the browser extension into dist-extension/ and zips it to
  dist/phonecam-extension.zip so the site can offer it as a download.

  Env:
    PHONECAM_PEER_SERVER    JSON PeerJS options (default: the PhoneCam signalling server on phonecam.app)
    PHONECAM_API            origin for /api/turn (default: https://phonecam.app)
    PHONECAM_EXTRA_MATCHES  comma-separated extra sites, for example
                            "http://localhost/*" for local testing
    PHONECAM_EXT_OUT        build into this folder instead of dist-extension/ and skip
                            both zips (used by the end-to-end tests)
*/
import { build } from 'esbuild'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'extension')
const testOut = process.env.PHONECAM_EXT_OUT
const out = testOut ? path.resolve(root, testOut) : path.join(root, 'dist-extension')
const zipPath = path.join(root, 'dist', 'phonecam-extension.zip')
const OWN_SERVER = '{"host":"phonecam.app","port":443,"secure":true,"path":"/signal/"}'
const peer = process.env.PHONECAM_PEER_SERVER || OWN_SERVER
const api = process.env.PHONECAM_API || 'https://phonecam.app'
const extra = (process.env.PHONECAM_EXTRA_MATCHES || '').split(',').map((item) => item.trim()).filter(Boolean)

JSON.parse(peer)

await fs.rm(out, { recursive: true, force: true })
await fs.mkdir(path.join(out, 'icons'), { recursive: true })

await build({
  entryPoints: {
    'main-world': path.join(src, 'src/main-world.js'),
    bridge: path.join(src, 'src/bridge.js'),
    popup: path.join(src, 'src/popup.js')
  },
  outdir: out,
  bundle: true,
  format: 'iife',
  target: 'chrome111',
  minify: true,
  legalComments: 'none',
  define: { __PHONECAM_PEER__: peer, __PHONECAM_API__: JSON.stringify(api) },
  logLevel: 'warning'
})

const manifest = JSON.parse(await fs.readFile(path.join(src, 'manifest.json'), 'utf8'))
if (extra.length) {
  for (const script of manifest.content_scripts) script.matches.push(...extra)
}
await fs.writeFile(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
await fs.copyFile(path.join(src, 'popup.html'), path.join(out, 'popup.html'))
await fs.copyFile(path.join(src, 'popup.css'), path.join(out, 'popup.css'))
for (const size of [16, 32, 48, 128]) {
  await fs.copyFile(path.join(src, `icons/icon-${size}.png`), path.join(out, `icons/icon-${size}.png`))
}

async function collect(dir, folder, prefix = '') {
  const files = {}
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const name = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) Object.assign(files, await collect(full, folder, name))
    else files[`${folder}${name}`] = new Uint8Array(await fs.readFile(full))
  }
  return files
}

if (testOut) {
  console.log(`Test extension built: ${path.relative(root, out)}/`)
  process.exit(0)
}

// For people loading it unpacked: unzips into a phonecam-extension folder.
await fs.mkdir(path.dirname(zipPath), { recursive: true })
await fs.writeFile(zipPath, zipSync(await collect(out, 'phonecam-extension/'), { level: 9 }))

// For the Chrome Web Store: manifest.json must sit at the root of the zip.
const storeZip = path.join(root, 'store', `phonecam-extension-${manifest.version}.zip`)
if (!extra.length && !process.env.PHONECAM_PEER_SERVER && !process.env.PHONECAM_API) {
  await fs.mkdir(path.dirname(storeZip), { recursive: true })
  await fs.writeFile(storeZip, zipSync(await collect(out, ''), { level: 9 }))
}
console.log(`Extension built: ${path.relative(root, out)}/ and ${path.relative(root, zipPath)}`)
