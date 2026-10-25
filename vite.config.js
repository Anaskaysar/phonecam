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
  const read = () => {
    try {
      const raw = fs.readFileSync(visitCountFile, 'utf8').trim()
      if (raw.startsWith('{')) return JSON.parse(raw)
      return { total: Number(raw) || 0, countries: {} }
    } catch {
      return { total: 0, countries: {} }
    }
  }
  const write = (data) => fs.writeFileSync(visitCountFile, JSON.stringify(data))
  return {
    name: 'phonecam-visits',
    configureServer(server) {
      server.middlewares.use('/api/visits', (req, res) => {
        const data = read()
        if (req.method === 'POST') {
          data.total += 1
          const code = String(req.headers['cf-ipcountry'] || '').trim().toUpperCase()
          if (/^[A-Z]{2}$/.test(code) && !['XX', 'T1', 'AP', 'EU'].includes(code)) {
            data.countries[code] = (data.countries[code] || 0) + 1
          }
          write(data)
        }
        const countries = Object.entries(data.countries || {})
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        res.end(JSON.stringify({ total: data.total, countries }))
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
