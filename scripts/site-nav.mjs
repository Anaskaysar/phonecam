/*
  The site header shared by the static pages (scripts/pages.mjs) and the 404
  page the Worker serves (worker/notfound.js). No Node-only imports here, so
  the Worker can bundle it. The app's own header is src/components/SiteNav.jsx:
  keep the links in step.
*/

export const LOGO = '<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" style="fill:var(--accent)"/><circle cx="16" cy="16" r="6.5" style="fill:var(--accent-ink)"/><circle cx="23.5" cy="9.5" r="1.7" style="fill:var(--accent-ink)"/></svg>'

export const USE_LINKS = [
  { href: '/#/receiver', label: 'Receiver', note: 'Pair your phone and pick a way in' },
  { href: '/#/camera', label: 'Phone camera', note: 'Open this on your phone' },
  { href: '/#/receiver?mode=meeting', label: 'Browser extension', note: 'PhoneCam in Meet, Teams and Zoom' },
  { href: '/#/check', label: 'Check the extension', note: 'Preview what the meeting sees' }
]

// The same items as src/components/SiteNav.jsx. Keep the two in step.
export function nav(current) {
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


// Same accent color the visitor picked in the app (Settings → Color).
export const THEME_SCRIPT = `
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
  `

// Close the nav menus after a choice, on Escape, or when clicking elsewhere.
export const NAV_SCRIPT = `
  document.addEventListener('click', function (event) {
    document.querySelectorAll('details.nav-drop[open], details.nav-mobile[open]').forEach(function (menu) {
      if (!menu.contains(event.target) || event.target.closest('a')) menu.removeAttribute('open')
    })
  })
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') document.querySelectorAll('details[open]').forEach(function (menu) { menu.removeAttribute('open') })
  })
`
