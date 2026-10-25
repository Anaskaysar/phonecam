/*
  The 404 page. Any path the site doesn't have lands here, with a Halloween
  ghost who lights the way home. The joke depends on what was asked for:

    admin    /admin, /wp-admin, /login, /dashboard, /phpmyadmin, /cpanel…
    secrets  /.env, /.git, /config, /backup, *.sql, /.aws, keys…
    wordpress  /wp-*, *.php, /xmlrpc
    lost     everything else (typos, old links)

  Repeat visits make it sillier. That count lives in the visitor's own
  browser (localStorage); the server stores nothing.
*/

import { nav, NAV_SCRIPT, THEME_SCRIPT } from '../scripts/site-nav.mjs'

const KINDS = [
  {
    kind: 'secrets',
    test: /(^|\/)\.(env|git|aws|ssh|svn|hg|htpasswd|htaccess|npmrc|docker)|(^|\/)(config|configs|backup|backups|dump|database|db|secrets?|credentials?|private|id_rsa|keys?)(\/|\.|$)|\.(sql|bak|old|swp|zip|tar|gz|pem|key|log|ya?ml|ini|conf)$/i
  },
  { kind: 'wordpress', test: /(^|\/)(wp-|wordpress|xmlrpc)|\.php\d?$|(^|\/)(cgi-bin|vendor\/phpunit)/i },
  { kind: 'admin', test: /(^|\/)(admin|administrator|login|signin|sign-in|dashboard|panel|cpanel|controlpanel|manager|console|backend|root|superuser|moderator|staff|portal|auth|user\/login|phpmyadmin|pma|adminer)(\/|\.|$)/i }
]

export function kindOf(pathname) {
  const path = String(pathname || '')
  for (const { kind, test } of KINDS) if (test.test(path)) return kind
  return 'lost'
}

const COPY = {
  admin: {
    kicker: 'Error 404 · admin not found',
    title: 'You’re wandering in the wrong place, bro.',
    lede: 'There’s no admin panel here. Not hidden, not behind a secret door, not under the doormat. It doesn’t exist on this website at all. Come on, I’ll light the way home.',
    title2: 'Back for the admin panel? Still not here.',
    sign: ['admin', 'home']
  },
  secrets: {
    kicker: 'Error 404 · secrets not found',
    title: 'Looking for secrets? Cute.',
    lede: 'No .env, no .git, no backups lying around. The only secret here is that there’s no secret. Let me show you the way out before the ghost gets bored.',
    title2: 'Still digging? The ghost hid the shovel.',
    sign: ['.env', 'home']
  },
  wordpress: {
    kicker: 'Error 404 · not WordPress',
    title: 'This isn’t WordPress, friend.',
    lede: 'No wp-admin, no xmlrpc.php, no PHP at all. Just a tiny webcam app and one very bored ghost. Here, follow the light.',
    title2: 'Still not WordPress. We checked twice.',
    sign: ['wp-admin', 'home']
  },
  lost: {
    kicker: 'Error 404 · page not found',
    title: 'This page went trick-or-treating.',
    lede: 'It’s not here. Maybe a typo, maybe an old link, maybe a ghost ate it. Either way, the way home is this way.',
    title2: 'Lost again? Happens to the best of us.',
    sign: ['???', 'home']
  }
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

// One small prop per kind, drawn beside the ghost.
const PROPS = {
  admin: `<g class="prop">
      <rect x="566" y="168" width="96" height="150" rx="10" fill="#1b1f2a" stroke="#38414f" stroke-width="3"/>
      <circle cx="648" cy="248" r="5" fill="#5b6576"/>
      <rect x="560" y="140" width="108" height="30" rx="6" fill="#2a1f14" stroke="#ff8a3d" stroke-width="2"/>
      <text x="614" y="161" text-anchor="middle" font-size="15" font-weight="800" fill="#ffb46b" letter-spacing="1">ADMIN</text>
      <path d="M572 150 L656 312 M656 150 L572 312" stroke="#ff4b63" stroke-width="7" stroke-linecap="round" opacity=".85"/>
    </g>`,
  secrets: `<g class="prop">
      <rect x="540" y="160" width="150" height="104" rx="12" fill="#0b0f0a" stroke="#38414f" stroke-width="3"/>
      <circle cx="556" cy="174" r="4" fill="#ff5f57"/><circle cx="570" cy="174" r="4" fill="#febc2e"/><circle cx="584" cy="174" r="4" fill="#28c840"/>
      <text class="term t1" x="552" y="202" font-size="11" fill="#7cf29c" font-family="ui-monospace, Menlo, monospace">$ cat .env</text>
      <text class="term t2" x="552" y="220" font-size="11" fill="#7cf29c" font-family="ui-monospace, Menlo, monospace">hacking… ▓▓░░░ 12%</text>
      <text class="term t3" x="552" y="238" font-size="11" fill="#ff8a3d" font-family="ui-monospace, Menlo, monospace">denied by: 1 ghost 👻</text>
      <text class="term t4" x="552" y="254" font-size="11" fill="#7cf29c" font-family="ui-monospace, Menlo, monospace">$ go home_<tspan class="caret">▍</tspan></text>
    </g>`,
  wordpress: `<g class="prop">
      <path d="M560 316 L560 210 Q560 160 615 160 Q670 160 670 210 L670 316 Z" fill="#2a2f3a" stroke="#454e5e" stroke-width="3"/>
      <text x="615" y="214" text-anchor="middle" font-size="22" font-weight="900" fill="#9aa4b4">RIP</text>
      <text x="615" y="242" text-anchor="middle" font-size="12" font-weight="700" fill="#8792a3">WordPress</text>
      <text x="615" y="262" text-anchor="middle" font-size="10" fill="#6f7a8b">never installed</text>
      <text x="615" y="280" text-anchor="middle" font-size="10" fill="#6f7a8b">2026 – 2026</text>
      <path d="M548 318 q20 -10 40 0 q20 -10 40 0 q20 -10 40 0 q12 -6 20 0" stroke="#3c5a2e" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>`,
  lost: `<g class="prop">
      <path d="M572 236 q-6 82 52 82 q58 0 52 -82 z" fill="#ff8a3d"/>
      <path d="M572 236 h104" stroke="#d96a22" stroke-width="6" stroke-linecap="round"/>
      <path d="M586 236 q38 -70 76 0" stroke="#6b7385" stroke-width="5" fill="none"/>
      <path d="M598 262 l10 10 l10 -10 M630 262 l10 10 l10 -10" stroke="#3a1a06" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M602 290 q22 16 44 0" stroke="#3a1a06" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle class="candy c1" cx="600" cy="226" r="8" fill="#dff25a"/><circle class="candy c2" cx="624" cy="222" r="8" fill="#b8a3ff"/><circle class="candy c3" cx="648" cy="226" r="8" fill="#7cc4ff"/>
    </g>`
}

export function notFoundPage(pathname, nonce) {
  const kind = kindOf(pathname)
  const copy = COPY[kind]
  const shown = String(pathname || '/').slice(0, 80)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>404 · PhoneCam</title>
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="stylesheet" href="/site.css">
<script nonce="${nonce}">${THEME_SCRIPT}</script>
<style nonce="${nonce}">
  :root { --bg: #07080d; --ink: #f4f6f8; --muted: #a7b0bd; --lime: #dff25a; --pumpkin: #ff8a3d; --line: rgba(255,255,255,.12); color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { min-height: 100vh; min-height: 100svh; }
  body { background: radial-gradient(1200px 700px at 80% -10%, #1d1630 0%, transparent 60%), radial-gradient(900px 500px at 0% 110%, #2a1405 0%, transparent 60%), var(--bg); color: var(--ink); font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; overflow-x: hidden; }
  .sky { position: fixed; inset: 0; pointer-events: none; overflow: hidden; }
  .star { position: absolute; width: 2px; height: 2px; border-radius: 50%; background: #fff; opacity: .2; animation: twinkle 3s ease-in-out infinite; }
  .moon { position: absolute; right: 8vw; top: calc(64px + 4vh); width: 92px; height: 92px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #fffbe6, #f2e7b8 60%, #d8cb92); box-shadow: 0 0 60px 18px rgba(255,244,200,.18); }
  .moon::after { content: ''; position: absolute; left: 22px; top: 30px; width: 14px; height: 14px; border-radius: 50%; background: rgba(0,0,0,.08); box-shadow: 30px 18px 0 -3px rgba(0,0,0,.07), 14px 36px 0 -5px rgba(0,0,0,.06); }
  .bat { position: absolute; top: 18vh; left: -80px; width: 46px; animation: fly 14s linear infinite; }
  .bat.b2 { top: 30vh; width: 30px; animation-duration: 19s; animation-delay: -7s; }
  .bat.b3 { top: 12vh; width: 22px; animation-duration: 23s; animation-delay: -12s; }
  .bat svg { width: 100%; animation: flap .28s ease-in-out infinite alternate; transform-origin: 50% 60%; }
  .fog { position: fixed; left: -20%; right: -20%; bottom: -40px; height: 180px; background: radial-gradient(closest-side, rgba(170,180,210,.10), transparent) 0 0 / 50% 100% repeat-x; animation: drift 30s linear infinite; pointer-events: none; }
  .fog.f2 { bottom: -70px; opacity: .7; animation-duration: 45s; animation-direction: reverse; }
  .torch { position: fixed; inset: 0; pointer-events: none; background: radial-gradient(260px 260px at var(--x, 50%) var(--y, 40%), rgba(255,220,120,.10), transparent 70%); transition: background .15s; }
  .site-nav { z-index: 5; }
  /* Fits one screen: the scene, the words and the button share the height left under the nav. */
  main.lost { position: relative; z-index: 1; flex: 1; width: 100%; max-width: 980px; margin: 0 auto; padding: clamp(8px, 2.5svh, 28px) 16px clamp(14px, 3svh, 32px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(2px, 0.9svh, 8px); text-align: center; }
  main.lost p { text-align: center; hyphens: manual; -webkit-hyphens: manual; }
  .scene { width: auto; max-width: 100%; height: clamp(150px, 40svh, 360px); overflow: visible; flex: 0 1 auto; }
  .ghost { animation: bob 3.2s ease-in-out infinite; transform-origin: 300px 230px; }
  .eye { animation: blink 4.5s infinite; transform-origin: center; transform-box: fill-box; }
  .beam { transform-origin: 360px 238px; transform-box: view-box; animation: sweep 3.4s ease-in-out 1 forwards; }
  .beam.follow { animation: none; transition: transform .25s ease-out; }
  .arm { transform-origin: 340px 236px; transform-box: view-box; animation: point 3.4s ease-in-out 1 forwards; }
  .sweat { opacity: 0; animation: sweat 4s ease-in-out 2.2s infinite; }
  .shrug { opacity: 0; }
  .lv2 .shrug, .lv3 .shrug { animation: pop .5s 1.6s ease-out forwards; }
  .tally line { stroke: #cfd6e2; stroke-width: 4; stroke-linecap: round; opacity: 0; animation: chalk .3s ease-out forwards; }
  .trophy { opacity: 0; transform-origin: 230px 140px; transform-box: view-box; }
  .lv3 .trophy { animation: trophy .8s 1s cubic-bezier(.2,1.6,.4,1) forwards; }
  .prop { animation: rise .9s .2s ease-out both; }
  .term { opacity: 0; animation: type .01s forwards; }
  .t1 { animation-delay: .6s } .t2 { animation-delay: 1.4s } .t3 { animation-delay: 2.4s } .t4 { animation-delay: 3.2s }
  .caret { animation: caret 1s steps(1) infinite; }
  .candy { animation: candy 2.4s ease-in-out infinite; }
  .c2 { animation-delay: .3s } .c3 { animation-delay: .6s }
  .sign path, .sign rect { vector-effect: non-scaling-stroke; }
  main.lost .kicker { margin: 0; font-size: 13px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: var(--pumpkin); }
  h1 { margin: 0; font-size: clamp(26px, min(6.2vw, 6.4svh), 64px); line-height: 1.02; letter-spacing: -.045em; max-width: 18ch; }
  .lede { margin: 2px 0 0; max-width: 60ch; color: var(--muted); font-size: clamp(14px, min(2.1vw, 2.2svh), 19px); line-height: 1.5; }
  .extra { margin: 0; max-width: 60ch; color: #cfd6e2; font-size: clamp(13px, 1.9svh, 15px); }
  .extra:empty { display: none; }
  .path { margin: 2px 0 0; font: 13px ui-monospace, Menlo, monospace; color: #6f7a8b; }
  .path s { color: #ff8a9a; text-decoration-thickness: 2px; }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: clamp(4px, 1.4svh, 14px); }
  .home { position: relative; display: inline-flex; align-items: center; gap: 10px; padding: 15px 26px; border-radius: 999px; background: var(--lime); color: #161a04; font-weight: 800; font-size: 17px; text-decoration: none; box-shadow: 0 0 0 0 rgba(223,242,90,.6); animation: glow 2s ease-in-out 3.2s infinite; }
  .home:hover { transform: translateY(-1px); }
  .ghostly { display: inline-flex; align-items: center; padding: 14px 22px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink); text-decoration: none; font-weight: 650; }
  .fine { margin: clamp(4px, 1.2svh, 14px) 0 0; color: #5f6a7b; font-size: 13px; }
  :focus-visible { outline: 2px solid var(--lime); outline-offset: 3px; }
  @keyframes twinkle { 50% { opacity: .9 } }
  @keyframes fly { 0% { transform: translate(0, 0) } 25% { transform: translate(30vw, -6vh) } 50% { transform: translate(60vw, 4vh) } 75% { transform: translate(90vw, -4vh) } 100% { transform: translate(calc(100vw + 160px), 2vh) } }
  @keyframes flap { from { transform: scaleY(1) } to { transform: scaleY(.45) } }
  @keyframes drift { to { transform: translateX(25%) } }
  @keyframes bob { 50% { transform: translateY(-12px) rotate(-1.5deg) } }
  @keyframes blink { 0%, 92%, 100% { transform: scaleY(1) } 95% { transform: scaleY(.1) } }
  @keyframes sweep { 0% { transform: rotate(-38deg) } 30% { transform: rotate(14deg) } 55% { transform: rotate(-22deg) } 100% { transform: rotate(var(--aim, 34deg)) } }
  @keyframes point { 0% { transform: rotate(-30deg) } 30% { transform: rotate(10deg) } 55% { transform: rotate(-18deg) } 100% { transform: rotate(var(--aim, 34deg)) } }
  @keyframes sweat { 0%, 60%, 100% { opacity: 0; transform: translateY(0) } 70% { opacity: 1 } 90% { opacity: 0; transform: translateY(14px) } }
  @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(.8) } to { opacity: 1; transform: none } }
  @keyframes chalk { to { opacity: .9 } }
  @keyframes trophy { from { opacity: 0; transform: scale(.2) rotate(-30deg) } to { opacity: 1; transform: none } }
  @keyframes rise { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: none } }
  @keyframes type { to { opacity: 1 } }
  @keyframes caret { 50% { opacity: 0 } }
  @keyframes candy { 50% { transform: translateY(-8px) } }
  @keyframes glow { 50% { box-shadow: 0 0 0 14px rgba(223,242,90,0), 0 0 40px 6px rgba(223,242,90,.35) } }
  @media (max-width: 640px) {
    .moon { width: 60px; height: 60px; right: 6vw; top: 80px; }
    .scene { height: clamp(130px, 30svh, 260px); }
    .fine, .path { display: none; }
    .home { padding: 13px 20px; font-size: 16px; }
    .ghostly { padding: 12px 18px; font-size: 15px; }
  }
  @media (max-height: 760px) and (min-width: 641px) { .fine, .path { display: none; } }
  @media (max-height: 600px) and (min-width: 641px) { .lede { display: none; } }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } .beam, .arm { transform: rotate(34deg); } .term, .prop, .shrug, .trophy, .tally line { opacity: 1 !important; } }
</style>
</head>
<body class="lv1 kind-${kind}">
<div class="sky" aria-hidden="true">
  <div class="moon"></div>
  ${[...Array(36)].map((_, i) => `<span class="star" style="left:${(i * 37) % 100}%;top:${(i * 53) % 62}%;animation-delay:${(i % 7) * 0.4}s"></span>`).join('')}
  ${['b1', 'b2', 'b3'].map((b) => `<div class="bat ${b}"><svg viewBox="0 0 64 28"><path d="M32 14 C26 2 14 0 2 6 C8 8 10 12 8 16 C14 13 18 16 20 20 C24 16 28 16 32 22 C36 16 40 16 44 20 C46 16 50 13 56 16 C54 12 56 8 62 6 C50 0 38 2 32 14 Z" fill="#2a2140"/></svg></div>`).join('')}
</div>
<div class="torch" aria-hidden="true"></div>
<div class="fog" aria-hidden="true"></div><div class="fog f2" aria-hidden="true"></div>

${nav('')}
<main class="lost">
  <svg class="scene" viewBox="0 0 760 360" role="img" aria-label="A friendly ghost shines a torch toward the way home">
    <defs>
      <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#fff3b0" stop-opacity=".95"/>
        <stop offset=".35" stop-color="#ffe27a" stop-opacity=".45"/>
        <stop offset="1" stop-color="#ffd24a" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="ghostShade" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe6f2"/></radialGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>

    <!-- the path home -->
    <path d="M90 340 C 220 300, 300 352, 420 330 S 640 300, 740 338" stroke="#2b2236" stroke-width="34" fill="none" stroke-linecap="round"/>
    <path d="M90 340 C 220 300, 300 352, 420 330 S 640 300, 740 338" stroke="#ff8a3d" stroke-width="3" stroke-dasharray="2 16" fill="none" stroke-linecap="round" opacity=".7"/>

    <!-- signpost -->
    <g class="sign">
      <rect x="96" y="176" width="10" height="160" rx="3" fill="#5a4330"/>
      <g transform="rotate(-6 100 200)"><path d="M100 188 h86 l16 14 l-16 14 h-86 z" fill="#3a2a1d" stroke="#6b4f36" stroke-width="2"/>
        <text x="146" y="207" text-anchor="middle" font-size="13" font-weight="800" fill="#ff8a9a" text-decoration="line-through">${esc(copy.sign[0])}</text></g>
      <g transform="rotate(4 100 240)"><path d="M100 230 h86 l16 14 l-16 14 h-86 z" fill="#3a2a1d" stroke="#6b4f36" stroke-width="2"/>
        <text x="146" y="249" text-anchor="middle" font-size="13" font-weight="800" fill="#dff25a">${esc(copy.sign[1])} →</text></g>
    </g>

    <!-- chalk tally for repeat visits -->
    <g class="tally" aria-hidden="true"></g>

    <!-- trophy for the truly dedicated -->
    <g class="trophy" aria-hidden="true"><g transform="translate(-62 -6)">
      <path d="M206 112 h48 v14 q0 28 -24 30 q-24 -2 -24 -30 z" fill="#ffcf4a"/>
      <path d="M206 118 q-14 0 -14 12 q0 10 14 12 M254 118 q14 0 14 12 q0 10 -14 12" stroke="#ffcf4a" stroke-width="5" fill="none"/>
      <rect x="222" y="156" width="16" height="12" fill="#e0a92d"/><rect x="212" y="168" width="36" height="9" rx="2" fill="#c98e1a"/>
      <text x="230" y="102" text-anchor="middle" font-size="11" font-weight="800" fill="#ffcf4a">PRO WANDERER</text>
    </g></g>

    ${PROPS[kind]}

    <!-- torch beam, aimed by script after the intro -->
    <g class="beam"><path d="M362 238 L760 140 L760 340 Z" fill="url(#beam)" filter="url(#soft)" opacity=".85"/><path d="M362 238 L700 180 L700 300 Z" fill="url(#beam)" opacity=".55"/></g>

    <!-- the ghost -->
    <g class="ghost">
      <ellipse cx="300" cy="336" rx="56" ry="8" fill="#000" opacity=".35"/>
      <path d="M244 300 L244 196 Q244 132 300 132 Q356 132 356 196 L356 300 Q346 288 336 300 Q326 312 316 300 Q306 288 296 300 Q286 312 276 300 Q266 288 256 300 Q250 308 244 300 Z" fill="url(#ghostShade)"/>
      <g class="eye"><ellipse cx="282" cy="196" rx="8" ry="11" fill="#141826"/><circle cx="285" cy="191" r="3" fill="#fff"/></g>
      <g class="eye"><ellipse cx="318" cy="196" rx="8" ry="11" fill="#141826"/><circle cx="321" cy="191" r="3" fill="#fff"/></g>
      <ellipse cx="270" cy="216" rx="8" ry="4" fill="#ff9fb3" opacity=".6"/><ellipse cx="330" cy="216" rx="8" ry="4" fill="#ff9fb3" opacity=".6"/>
      <path d="M290 224 q10 9 20 0" stroke="#141826" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path class="sweat" d="M352 168 q6 10 0 14 q-6 -4 0 -14 z" fill="#8fd3ff"/>
      <g class="arm"><path d="M340 236 q12 -4 22 2" stroke="#e6ecf6" stroke-width="12" stroke-linecap="round" fill="none"/>
        <rect x="350" y="230" width="20" height="14" rx="3" fill="#3b4252"/><rect x="368" y="228" width="6" height="18" rx="2" fill="#ffe27a"/></g>
      <text class="shrug" x="300" y="116" text-anchor="middle" font-size="22" fill="#cfd6e2" font-family="ui-monospace, Menlo, monospace">¯\\_(ツ)_/¯</text>
    </g>
  </svg>

  <p class="kicker">${esc(copy.kicker)}</p>
  <h1 id="title">${esc(copy.title)}</h1>
  <p class="lede">${esc(copy.lede)}</p>
  <p class="extra" id="extra" aria-live="polite"></p>
  <p class="path">You asked for <s>${esc(shown)}</s></p>
  <div class="actions">
    <a class="home" id="home" href="/">🏠 Take me home</a>
    <a class="ghostly" href="/guides">Read the guides</a>
  </div>
  <p class="fine">PhoneCam keeps no logs of this. The ghost only remembers you in your own browser.</p>
</main>

<script nonce="${nonce}">${NAV_SCRIPT}</script>
<script nonce="${nonce}">
(function () {
  var title2 = ${JSON.stringify(copy.title2)};
  var kind = ${JSON.stringify(kind)};
  var count = 1;
  try { count = (Number(localStorage.getItem('pc.404')) || 0) + 1; localStorage.setItem('pc.404', String(count)); } catch (e) {}
  var body = document.body, extra = document.getElementById('extra');
  var ordinal = function (n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  if (count === 2) {
    body.className = body.className.replace('lv1', 'lv2');
    document.getElementById('title').textContent = title2;
    extra.textContent = 'Back again? The ghost remembers you. (Only in this browser. We don’t keep logs. We’re not that kind of site.)';
  } else if (count >= 3 && count < 5) {
    body.className = body.className.replace('lv1', 'lv2');
    document.getElementById('title').textContent = title2;
    extra.textContent = 'That’s your ' + ordinal(count) + ' wrong turn. The ghost has started a tally on the wall.';
  } else if (count >= 5) {
    body.className = body.className.replace('lv1', 'lv3');
    document.getElementById('title').textContent = 'Achievement unlocked: Professional Wanderer.';
    extra.textContent = ordinal(count) + ' page that doesn’t exist. Honestly impressive. Have a trophy, then go home: ' + (kind === 'lost' ? 'the candy is getting cold.' : 'there’s nothing here, pinky promise.');
  }
  // Chalk tally marks, one per visit (max 15).
  var tally = document.querySelector('.tally');
  if (count >= 3) {
    var marks = Math.min(count, 15), ns = 'http://www.w3.org/2000/svg';
    for (var i = 0; i < marks; i++) {
      var group = Math.floor(i / 5), pos = i % 5, line = document.createElementNS(ns, 'line'), x = 40 + group * 46 + pos * 8;
      if (pos === 4) { line.setAttribute('x1', x - 34); line.setAttribute('y1', 118); line.setAttribute('x2', x + 2); line.setAttribute('y2', 92); }
      else { line.setAttribute('x1', x); line.setAttribute('y1', 90); line.setAttribute('x2', x); line.setAttribute('y2', 120); }
      line.style.animationDelay = (0.6 + i * 0.12) + 's';
      tally.appendChild(line);
    }
  }
  // After the search sweep, the torch follows your pointer, and points home when you stop.
  var beam = document.querySelector('.beam'), arm = document.querySelector('.arm'), svg = document.querySelector('.scene'), torch = document.querySelector('.torch');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches, idle;
  function aimAt(clientX, clientY) {
    var box = svg.getBoundingClientRect(), sx = box.left + box.width * (362 / 760), sy = box.top + box.height * (238 / 360);
    var deg = Math.max(-60, Math.min(80, Math.atan2(clientY - sy, clientX - sx) * 180 / Math.PI));
    beam.style.transform = arm.style.transform = 'rotate(' + deg + 'deg)';
  }
  function aimHome() {
    var r = document.getElementById('home').getBoundingClientRect();
    aimAt(r.left + r.width / 2, r.top + r.height / 2);
  }
  if (!reduce) {
    setTimeout(function () {
      beam.classList.add('follow'); arm.classList.add('follow'); aimHome();
      window.addEventListener('pointermove', function (e) {
        torch.style.setProperty('--x', e.clientX + 'px'); torch.style.setProperty('--y', e.clientY + 'px');
        aimAt(e.clientX, e.clientY); clearTimeout(idle); idle = setTimeout(aimHome, 1600);
      }, { passive: true });
      window.addEventListener('resize', aimHome);
      window.addEventListener('scroll', aimHome, { passive: true });
    }, 3400);
  }
})();
</script>
</body>
</html>`
}

export function notFound(request) {
  const url = new URL(request.url)
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
  const body = request.method === 'HEAD' ? null : notFoundPage(url.pathname, nonce)
  return new Response(body, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'x-robots-tag': 'noindex',
      'content-security-policy': `default-src 'none'; img-src 'self'; style-src 'self' 'nonce-${nonce}'; style-src-elem 'self' 'nonce-${nonce}'; style-src-attr 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
    }
  })
}
