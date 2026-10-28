import fs from 'node:fs'
import os from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const phoneOriginFile = new URL('./.phone-origin', import.meta.url)

function lanAddress() {
  const wifi = []
  const other = []
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      const ipv4 = entry.family === 'IPv4' || entry.family === 4
      if (!ipv4 || entry.internal || entry.address.startsWith('169.254.')) continue
      const target = /wi-?fi|wlan|wireless/i.test(name) ? wifi : other
      target.push(entry.address)
    }
  }
  return wifi[0] || other.find((address) => address.startsWith('192.168.') || address.startsWith('10.')) || other[0] || ''
}

// Guides, /guides and /about are static pages built from content/ by scripts/pages.mjs.
// In dev they are rendered on each request, so edits show up on refresh.
function guidePagesPlugin() {
  return {
    name: 'phonecam-guide-pages',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = (req.url || '').split('?')[0].replace(/\/$/, '') || '/'
        const { renderAll, pagePaths } = await server.ssrLoadModule('/scripts/pages.mjs')
        if (pathname === '/site.css') {
          // Served straight from disk: Vite's list of public files can miss a file added while it runs.
          res.setHeader('content-type', 'text/css; charset=utf-8')
          return res.end(fs.readFileSync(new URL('./public/site.css', import.meta.url)))
        }
        const name = pathname.slice(1)
        const file = name === 'sitemap.xml' ? 'sitemap.xml' : pagePaths().includes(name) ? `${name}/index.html` : null
        if (!file) {
          // A page address that doesn't exist gets the Halloween 404, as on phonecam.app
          // (Vite would otherwise hand back the app, which looks like the home page).
          const wantsPage = req.method === 'GET' && (req.headers.accept || '').includes('text/html')
          const isApp = pathname === '/' || pathname === '/index.html'
          const isTool = pathname.startsWith('/@') || pathname.startsWith('/node_modules/') || pathname.startsWith('/src/') || pathname.startsWith('/api/')
          const isFile = fs.existsSync(new URL(`./public${pathname}`, import.meta.url))
          if (!wantsPage || isApp || isTool || isFile) return next()
          const { notFoundPage } = await server.ssrLoadModule('/worker/notfound.js')
          res.statusCode = 404
          res.setHeader('content-type', 'text/html; charset=utf-8')
          return res.end(notFoundPage(pathname, 'dev'))
        }
        res.setHeader('content-type', file.endsWith('.xml') ? 'application/xml' : 'text/html; charset=utf-8')
        res.end(renderAll()[file])
      })
    },
    configurePreviewServer(server) {
      // vite preview serves dist/, where the build already wrote /<page>/index.html.
      server.middlewares.use((req, _res, next) => {
        const pathname = (req.url || '').split('?')[0]
        if (/^\/[a-z0-9-]+\/?$/.test(pathname) && fs.existsSync(new URL(`./dist${pathname.replace(/\/$/, '')}/index.html`, import.meta.url))) {
          req.url = `${pathname.replace(/\/$/, '')}/index.html`
        }
        next()
      })
    }
  }
}

const visitCountFile = new URL('./.visit-count', import.meta.url)

function visitCounterPlugin() {
  // Dev copy of worker/visits.js: same answers, kept in .visit-count.
  const HOUR = 60 * 60 * 1000
  const live = new Map()
  const hourKey = (time) => new Date(time).toISOString().slice(0, 13)
  const lastDay = (now) => Array.from({ length: 24 }, (_, index) => hourKey(now - (23 - index) * HOUR))
  const list = (counts) => Object.entries(counts)
    .filter(([code, count]) => /^[A-Z]{2}$/.test(code) && count > 0)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
  const sum = (counts) => Object.values(counts).reduce((total, count) => total + count, 0)
  const read = () => {
    try {
      const raw = fs.readFileSync(visitCountFile, 'utf8').trim()
      const data = raw.startsWith('{') ? JSON.parse(raw) : { total: Number(raw) || 0 }
      return { total: data.total || 0, countries: data.countries || {}, hours: data.hours || {} }
    } catch {
      return { total: 0, countries: {}, hours: {} }
    }
  }
  const write = (data) => fs.writeFileSync(visitCountFile, JSON.stringify(data))
  const countryOf = (req) => {
    const code = String(req.headers['cf-ipcountry'] || '').trim().toUpperCase()
    return /^[A-Z]{2}$/.test(code) && !['XX', 'T1', 'AP', 'EU'].includes(code) ? code : ''
  }
  return {
    name: 'phonecam-visits',
    configureServer(server) {
      server.middlewares.use('/api/visits', (req, res) => {
        const now = Date.now()
        const data = read()
        const send = () => {
          for (const [id, seen] of live) if (now - seen.at > 150000) live.delete(id)
          const keys = lastDay(now)
          const day = {}
          for (const key of keys) for (const [code, count] of Object.entries(data.hours[key] || {})) day[code] = (day[code] || 0) + count
          const here = {}
          for (const seen of live.values()) if (seen.code) here[seen.code] = (here[seen.code] || 0) + 1
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.setHeader('cache-control', 'no-store')
          res.end(JSON.stringify({
            total: data.total,
            countries: list(data.countries),
            day: { total: sum(day), countries: list(day) },
            live: { total: live.size, countries: list(here) },
            hours: keys.map((key) => sum(data.hours[key] || {}))
          }))
        }
        if (req.method === 'POST' && req.url.startsWith('/live')) {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', () => {
            try {
              const id = String(JSON.parse(body).id || '')
              if (/^[A-Za-z0-9_-]{8,64}$/.test(id)) live.set(id, { code: countryOf(req), at: now })
            } catch { /* ignore */ }
            send()
          })
          return
        }
        if (req.method === 'POST') {
          const code = countryOf(req)
          data.total += 1
          if (code) data.countries[code] = (data.countries[code] || 0) + 1
          const keep = new Set(lastDay(now))
          for (const key of Object.keys(data.hours)) if (!keep.has(key)) delete data.hours[key]
          const key = hourKey(now)
          data.hours[key] ||= {}
          data.hours[key][code || '?'] = (data.hours[key][code || '?'] || 0) + 1
          write(data)
        }
        send()
      })
    }
  }
}

function phoneOriginPlugin() {
  return {
    name: 'phonecam-phone-origin',
    configureServer(server) {
      server.middlewares.use('/api/phone-origin', (_req, res) => {
        let origin = process.env.PHONECAM_ORIGIN || ''
        if (!origin) {
          try { origin = fs.readFileSync(phoneOriginFile, 'utf8').trim() } catch { origin = '' }
        }
        if (!origin) {
          const lan = lanAddress()
          const port = server.config.server.port || 5173
          if (lan) origin = `http://${lan}:${port}`
        }
        res.setHeader('content-type', 'application/json')
        res.setHeader('cache-control', 'no-store')
        res.end(JSON.stringify({ origin, https: origin.startsWith('https://') }))
      })
    }
  }
}

export default defineConfig({
  define: {
    __PHONECAM_PEER__: process.env.PHONECAM_PEER_SERVER || 'null',
    __PHONECAM_API__: JSON.stringify(process.env.PHONECAM_API || ''),
    __APP_VERSION__: JSON.stringify(JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version)
  },
  plugins: [
    react(),
    guidePagesPlugin(),
    visitCounterPlugin(),
    phoneOriginPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-32.png', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'],
      manifest: {
        name: 'PhoneCam',
        short_name: 'PhoneCam',
        description: 'Use the phone you already own as a webcam.',
        start_url: 'index.html#/camera',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0b0d11',
        theme_color: '#0b0d11',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        // The app only lives at /. Guides, /guides, /about and privacy.html are real pages
        // and must never be swapped for the app shell.
        navigateFallbackDenylist: [/^\/(?!index\.html$)./],
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        // The guides are ordinary web pages: don't download their pictures into every phone's app cache.
        globIgnores: ['guides/**', 'site.css']
      },
      devOptions: {
        enabled: false
      }
    })
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.trycloudflare.com']
  }
})
