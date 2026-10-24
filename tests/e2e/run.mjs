/*
  End-to-end tests: npm run test:e2e

  1. Builds a test copy of the site and extension into .test-build/ (pointed at
     the local Worker; your dist/ is never touched).
  2. Starts the Worker locally with `wrangler dev` (signalling Durable Object,
     ratings database, the site) and a fake meeting page with a strict
     security policy.
  3. Runs the browser tests in tests/e2e/*.spec.mjs with Playwright's Chromium,
     using a fake camera.

  First time on a computer: npx playwright install chromium
*/
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const out = path.join(root, '.test-build')
const PORT = Number(process.env.PHONECAM_TEST_PORT || 8787)
const MEETING_PORT = Number(process.env.PHONECAM_TEST_MEETING_PORT || 8790)
const BASE = `http://127.0.0.1:${PORT}`
const bin = (name) => path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name)

function run(command, args, env = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } })
  if (result.status !== 0) throw new Error(`${path.basename(command)} ${args.join(' ')} failed`)
}

const testEnv = {
  PHONECAM_PEER_SERVER: JSON.stringify({ host: '127.0.0.1', port: PORT, path: '/signal/', secure: false }),
  PHONECAM_API: BASE,
  PHONECAM_EXTRA_MATCHES: 'http://localhost/*,http://127.0.0.1/*',
  WRANGLER_SEND_METRICS: 'false'
}

console.log('\n▸ Building the test copy into .test-build/')
fs.rmSync(out, { recursive: true, force: true })
run(bin('vite'), ['build', '--outDir', '.test-build/site', '--emptyOutDir', '--logLevel', 'warn'], testEnv)
run(process.execPath, ['scripts/build-pages.mjs', '.test-build/site'], testEnv)
run(process.execPath, ['scripts/build-extension.mjs'], { ...testEnv, PHONECAM_EXT_OUT: '.test-build/extension' })
// Test-only pages served by the local Worker: an attacker page that speaks PeerJS directly.
fs.copyFileSync(path.join(root, 'node_modules/peerjs/dist/peerjs.min.js'), path.join(out, 'site/peerjs.min.js'))
fs.copyFileSync(path.join(root, 'tests/e2e/fixtures/attacker.html'), path.join(out, 'site/attacker.html'))

console.log('\n▸ Preparing the local ratings database')
const config = ['--config', 'tests/e2e/wrangler.test.toml', '--persist-to', '.test-build/state']
run(bin('wrangler'), ['d1', 'execute', 'phonecam', '--local', '--file', 'worker/schema.sql', ...config], testEnv)

console.log(`\n▸ Starting the Worker on ${BASE}`)
const dev = spawn(bin('wrangler'), ['dev', '--port', String(PORT), '--ip', '127.0.0.1', ...config], {
  cwd: root,
  env: { ...process.env, ...testEnv },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32'
})
let devLog = ''
dev.stdout.on('data', (chunk) => { devLog += chunk })
dev.stderr.on('data', (chunk) => { devLog += chunk })

// A stand-in for Meet or Teams: strict security policy, so the page itself can't connect anywhere.
const meetingPage = fs.readFileSync(path.join(root, 'tests/e2e/fixtures/meeting.html'))
const meeting = http.createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': "default-src 'self'; connect-src 'none'; script-src 'self'" })
  response.end(meetingPage)
}).listen(MEETING_PORT, '127.0.0.1')

function stopAll() {
  meeting.close()
  try {
    if (process.platform === 'win32') dev.kill()
    else process.kill(-dev.pid, 'SIGTERM')
  } catch { /* already stopped */ }
}
process.on('SIGINT', () => { stopAll(); process.exit(130) })

async function waitForWorker() {
  for (let i = 0; i < 90; i += 1) {
    try {
      const response = await fetch(`${BASE}/`)
      if (response.ok) return
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  console.error(devLog)
  throw new Error('wrangler dev did not start')
}

let code = 1
try {
  await waitForWorker()
  console.log('\n▸ Running browser tests\n')
  const specs = fs.readdirSync(path.join(root, 'tests/e2e')).filter((name) => name.endsWith('.spec.mjs')).map((name) => `tests/e2e/${name}`)
  const only = process.argv.slice(2)
  // Not spawnSync: the meeting page server above runs in this process and must keep answering.
  const tests = spawn(process.execPath, ['--test', '--test-concurrency=1', ...(only.length ? only : specs)], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      PHONECAM_BASE: BASE,
      PHONECAM_MEETING: `http://127.0.0.1:${MEETING_PORT}/`,
      PHONECAM_TEST_EXTENSION: path.join(out, 'extension')
    }
  })
  code = await new Promise((resolve) => tests.on('exit', (status) => resolve(status ?? 1)))
} catch (error) {
  console.error(error.message)
} finally {
  stopAll()
}
process.exit(code)
