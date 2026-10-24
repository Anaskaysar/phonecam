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
  plugins: [
    react(),
    phoneOriginPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'],
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
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}']
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
