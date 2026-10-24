/*
  Writes the guides, the guides index, About and sitemap.xml into the built
  site. Usage: node scripts/build-pages.mjs [outDir]   (default: dist)
  npm run build runs it after the Vite build.
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderAll } from './pages.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.resolve(root, process.argv[2] || 'dist')
const files = renderAll()
for (const [name, html] of Object.entries(files)) {
  const target = path.join(out, name)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, html)
}
console.log(`Pages built: ${Object.keys(files).length} files in ${path.relative(root, out) || '.'}/`)
