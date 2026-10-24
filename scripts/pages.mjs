/*
  Static pages: the guides, the guides index, About, and the sitemap.

  Content lives in content/guides/*.html and content/pages/*.html. Each file
  starts with a JSON comment (title, description, kicker…) followed by the
  article HTML. This module wraps them in the shared layout: the same nav and
  footer as the app, a reading header, a cover, related guides, and the data
  search engines read (Open Graph, Article and breadcrumb JSON-LD).

  Used by scripts/build-pages.mjs (writes into dist/ after the Vite build) and
  by the Vite dev server (renders on request), so there is one source of truth.
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const SITE = 'https://phonecam.app'
const REPO = 'https://github.com/Anaskaysar/phonecam'
const SUPPORT = 'kaysarulanas2@gmail.com'

const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const strip = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()

function readEntry(file) {
  const raw = fs.readFileSync(file, 'utf8')
  const match = raw.match(/^<!--\s*([\s\S]*?)\s*-->\s*/)
  if (!match) throw new Error(`${file}: missing the JSON header comment`)
  const meta = JSON.parse(match[1])
  const body = raw.slice(match[0].length)
  const words = strip(`${meta.lede || ''} ${body}`).split(' ').length
  return { ...meta, body, minutes: Math.max(1, Math.round(words / 200)) }
}

export function loadContent() {
  const guidesDir = path.join(root, 'content/guides')
  const pagesDir = path.join(root, 'content/pages')
  const guides = fs.readdirSync(guidesDir).filter((name) => name.endsWith('.html'))
    .map((name) => readEntry(path.join(guidesDir, name)))
    .sort((a, b) => a.order - b.order)
  const pages = fs.readdirSync(pagesDir).filter((name) => name.endsWith('.html'))
    .map((name) => readEntry(path.join(pagesDir, name)))
  return { guides, pages, version: JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version }
}

const LOGO = '<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" style="fill:var(--accent)"/><circle cx="16" cy="16" r="6.5" style="fill:var(--accent-ink)"/><circle cx="23.5" cy="9.5" r="1.7" style="fill:var(--accent-ink)"/></svg>'

const USE_LINKS = [
  { href: '/#/receiver', label: 'Receiver', note: 'Pair your phone and pick a way in' },
  { href: '/#/camera', label: 'Phone camera', note: 'Open this on your phone' },
  { href: '/#/receiver?mode=meeting', label: 'Browser extension', note: 'PhoneCam in Meet, Teams and Zoom' },
  { href: '/#/check', label: 'Check the extension', note: 'Preview what the meeting sees' }
]

// The same items as src/components/SiteNav.jsx. Keep the two in step.
function nav(current) {
  const link = (href, label, key) => `<a href="${href}"${current === key ? ' class="on" aria-current="page"' : ''}>${label}</a>`
  const useMenu = USE_LINKS.map((item) => `<a href="${item.href}"><strong>${item.label}</strong><span>${item.note}</span></a>`).join('')
  return `<header class="site-nav">
  <div class="site-nav-bar">
    <a class="brand" href="/" aria-label="PhoneCam home">${LOGO}PhoneCam</a>
    <nav class="site-nav-links" aria-label="Main">
      <details class="nav-drop">
        <summary>Use PhoneCam</summary>
        <div class="nav-drop-menu">${useMenu}</div>
      </details>
      ${link('/#/?section=how', 'How it works', 'how')}
      ${link('/guides', 'Guides', 'guides')}
      ${link('/about', 'About', 'about')}
    </nav>
    <div class="site-nav-actions">
      <a class="lp-btn primary site-nav-cta" href="/#/receiver">Get started</a>
      <details class="nav-mobile">
        <summary aria-label="Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary>
        <nav class="site-nav-menu" aria-label="Main">
          <p class="menu-group">Use PhoneCam</p>
          ${USE_LINKS.map((item) => `<a href="${item.href}">${item.label}</a>`).join('')}
          <p class="menu-group">Learn</p>
          ${link('/#/?section=how', 'How it works', 'how')}
          ${link('/guides', 'Guides', 'guides')}
          ${link('/about', 'About', 'about')}
          <a class="lp-btn primary" href="/#/receiver">Get started</a>
        </nav>
      </details>
    </div>
  </div>
</header>`
}

// The same columns as src/components/SiteFooter.jsx. Keep the two in step.
function footer(content) {
  const guideLinks = content.guides.slice(0, 5).map((guide) => `<a href="/${guide.slug}">${esc(guide.short)}</a>`).join('')
  return `<footer class="site-footer">
  <div class="sf-top">
    <div class="sf-brand">
      <a class="brand" href="/">${LOGO}PhoneCam</a>
      <p>Your phone is the webcam. Nothing to install on the phone, no account, nothing recorded.</p>
    </div>
    <nav class="sf-cols" aria-label="Footer">
      <div><h2>Use PhoneCam</h2>${USE_LINKS.map((item) => `<a href="${item.href}">${item.label === 'Receiver' ? 'Open the receiver' : item.label === 'Phone camera' ? 'Open the camera' : item.label}</a>`).join('')}</div>
      <div><h2>Guides</h2>${guideLinks}<a href="/guides">All guides →</a></div>
      <div><h2>Help</h2><a href="/#/?section=how">How it works</a><a href="/#/?section=faq">Questions</a><a href="/#/rate">Rate PhoneCam</a><a href="mailto:${SUPPORT}?subject=PhoneCam%20issue">Report an issue</a></div>
      <div><h2>About</h2><a href="/about">About PhoneCam</a><a href="/privacy.html">Privacy</a><a href="${REPO}">Source on GitHub</a></div>
    </nav>
  </div>
  <div class="sf-bottom">
    <span>© ${new Date().getFullYear()} PhoneCam</span>
    <span>Version ${esc(content.version)}</span>
    <span class="sf-note"><i aria-hidden="true"></i>Video goes straight from your phone to your computer.</span>
  </div>
</footer>`
}

function head({ title, description, url, image, type = 'article', jsonLd = [] }) {
  const full = `${title} · PhoneCam`
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0b0d11">
  <title>${esc(full)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${SITE}${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${SITE}${url}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="PhoneCam">
  <meta property="og:image" content="${SITE}${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
  <link rel="apple-touch-icon" href="/icons/icon-180.png">
  <link rel="stylesheet" href="/site.css">
  <script>
    // Same accent color the visitor picked in the app (Settings → Color).
    (function () {
      var themes = { sky: ['#7cc4ff', '#04213b'], coral: ['#ff8f6e', '#2b0c03'], violet: ['#b8a3ff', '#170b38'], mint: ['#6fe3b4', '#03261a'] }
      try {
        var picked = themes[localStorage.getItem('pc.theme')]
        if (picked) {
          document.documentElement.style.setProperty('--accent', picked[0])
          document.documentElement.style.setProperty('--accent-ink', picked[1])
        }
      } catch (e) {}
    })()
  </script>
${jsonLd.map((data) => `  <script type="application/ld+json">${JSON.stringify(data)}</script>`).join('\n')}`
}

function page({ headHtml, current, main, content }) {
  return `<!doctype html>
<html lang="en">
<head>
  ${headHtml}
</head>
<body>
${nav(current)}
${main}
${footer(content)}
<script src="/help.js" defer></script>
<script>
  // Close the nav menus after a choice, on Escape, or when clicking elsewhere.
  document.addEventListener('click', function (event) {
    document.querySelectorAll('details.nav-drop[open], details.nav-mobile[open]').forEach(function (menu) {
      if (!menu.contains(event.target) || event.target.closest('a')) menu.removeAttribute('open')
    })
  })
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') document.querySelectorAll('details[open]').forEach(function (menu) { menu.removeAttribute('open') })
  })
</script>
</body>
</html>
`
}

const cover = (slug) => `/guides/img/${slug}.svg`
const ogImage = (slug) => `/guides/img/${slug}.png`
const prettyDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function guideCard(guide, { featured = false } = {}) {
  return `<a class="guide-card${featured ? ' featured' : ''}" href="/${guide.slug}">
  <img src="${cover(guide.slug)}" alt="" width="1200" height="630" loading="lazy">
  <div class="guide-card-text">
    <p class="kicker">${esc(guide.kicker)} · ${guide.minutes} min read</p>
    <h3>${esc(guide.ogTitle || guide.title)}</h3>
    <p>${esc(guide.ogDescription || guide.description)}</p>
    <span class="more">Read the guide →</span>
  </div>
</a>`
}

function breadcrumbs(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: `${SITE}${item.url}` }))
  }
}

export function renderGuide(guide, content) {
  const url = `/${guide.slug}`
  const others = content.guides.filter((item) => item.slug !== guide.slug)
  const start = content.guides.indexOf(guide)
  const related = [1, 2, 3].map((step) => content.guides[(start + step) % content.guides.length]).filter((item) => item.slug !== guide.slug)
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: guide.h1,
      description: guide.description,
      image: `${SITE}${ogImage(guide.slug)}`,
      datePublished: guide.updated,
      dateModified: guide.updated,
      author: { '@type': 'Organization', name: 'PhoneCam', url: SITE },
      publisher: { '@type': 'Organization', name: 'PhoneCam', logo: { '@type': 'ImageObject', url: `${SITE}/icons/icon-512.png` } },
      mainEntityOfPage: `${SITE}${url}`
    },
    breadcrumbs([{ name: 'Guides', url: '/guides' }, { name: guide.short, url }])
  ]
  if (guide.faq) jsonLd.push(guide.faq)
  const main = `<main class="article-page">
  <article class="article">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="/guides">Guides</a><span aria-hidden="true">/</span><span>${esc(guide.short)}</span></nav>
    <p class="kicker">${esc(guide.kicker)} · ${guide.minutes} min read · Updated ${prettyDate(guide.updated)}</p>
    <h1>${guide.h1}</h1>
    <p class="lede">${guide.lede}</p>
    <figure class="cover"><img src="${cover(guide.slug)}" alt="" width="1200" height="630"></figure>
    <div class="prose">
${guide.body}
    </div>
    <aside class="try">
      <div>
        <p class="kicker">Try it now</p>
        <p class="try-title">Your phone is the webcam.</p>
        <p>Free, no account, and nothing to install on the phone.</p>
      </div>
      <div class="try-actions"><a class="lp-btn primary" href="/#/receiver">Open the receiver</a><a class="lp-btn" href="/#/camera">I’m on my phone</a></div>
    </aside>
  </article>
  <section class="related" aria-labelledby="related-title">
    <h2 id="related-title">More guides</h2>
    <div class="guide-grid">${related.map((item) => guideCard(item)).join('\n')}</div>
    <p class="all-guides"><a href="/guides">All ${others.length + 1} guides →</a></p>
  </section>
</main>`
  return page({ headHtml: head({ title: guide.title, description: guide.description, url, image: ogImage(guide.slug), jsonLd }), current: 'guides', main, content })
}

export function renderGuidesIndex(content) {
  const [first, ...rest] = content.guides
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'PhoneCam guides',
      url: `${SITE}/guides`,
      hasPart: content.guides.map((guide) => ({ '@type': 'Article', headline: guide.h1, url: `${SITE}/${guide.slug}` }))
    },
    breadcrumbs([{ name: 'Guides', url: '/guides' }])
  ]
  const main = `<main class="guides-page">
  <header class="guides-hero">
    <p class="kicker">Guides</p>
    <h1>Better video calls with the phone you already own.</h1>
    <p class="lede">Short, practical guides: when you don’t need a new webcam, how to set PhoneCam up on iPhone and Android, and how to use it in Zoom, Meet, Teams and OBS.</p>
  </header>
  ${guideCard(first, { featured: true })}
  <div class="guide-grid">${rest.map((guide) => guideCard(guide)).join('\n')}</div>
</main>`
  return page({
    headHtml: head({ title: 'Guides', description: 'Practical guides for using your phone as a webcam: skip the new webcam, iPhone and Android setup, Zoom, Meet, Teams and OBS.', url: '/guides', image: ogImage('guides'), type: 'website', jsonLd }),
    current: 'guides',
    main,
    content
  })
}

export function renderPage(entry, content) {
  const url = `/${entry.slug}`
  const main = `<main class="article-page">
  <article class="article about">
    <p class="kicker">${esc(entry.kicker)}</p>
    <h1>${entry.h1}</h1>
    <p class="lede">${entry.lede}</p>
    ${entry.cover ? `<figure class="cover"><img src="${entry.cover}" alt="" width="1200" height="630"></figure>` : ''}
    <div class="prose">
${entry.body}
    </div>
  </article>
</main>`
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'AboutPage', name: entry.title, url: `${SITE}${url}`, description: entry.description },
    breadcrumbs([{ name: entry.short || entry.title, url }])
  ]
  if (entry.faq) jsonLd.push(entry.faq)
  return page({ headHtml: head({ title: entry.title, description: entry.description, url, image: ogImage(entry.slug), type: 'website', jsonLd }), current: entry.slug, main, content })
}

export function renderSitemap(content) {
  const urls = ['/', '/guides', ...content.guides.map((guide) => `/${guide.slug}`), ...content.pages.map((entry) => `/${entry.slug}`), '/privacy.html']
  const latest = content.guides.reduce((date, guide) => (guide.updated > date ? guide.updated : date), '2026-01-01')
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${SITE}${url}</loc>${url === '/' || url.startsWith('/privacy') ? '' : `<lastmod>${latest}</lastmod>`}</url>`).join('\n')}
</urlset>
`
}

/* Every generated file, as { path relative to the site root: html }. */
export function renderAll() {
  const content = loadContent()
  const files = {
    'guides/index.html': renderGuidesIndex(content),
    'sitemap.xml': renderSitemap(content)
  }
  for (const guide of content.guides) files[`${guide.slug}/index.html`] = renderGuide(guide, content)
  for (const entry of content.pages) files[`${entry.slug}/index.html`] = renderPage(entry, content)
  return files
}

/* Paths the generated pages answer to: /guides, /about, /webcam … */
export function pagePaths() {
  const content = loadContent()
  return ['guides', ...content.guides.map((guide) => guide.slug), ...content.pages.map((entry) => entry.slug)]
}
