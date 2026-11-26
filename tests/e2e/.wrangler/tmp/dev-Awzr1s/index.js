var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-bw8eTv/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// ../../worker/signal.js
var ID_RE = /^phonecam-v2-([a-z2-7]{16})(?:-p[a-z2-7]{8})?$/;
var TOKEN_RE = /^[a-z0-9]{1,32}$/;
var MAX_SOCKETS = 4;
var MAX_MESSAGE = 32 * 1024;
var RELAYED = /* @__PURE__ */ new Set(["OFFER", "ANSWER", "CANDIDATE", "LEAVE"]);
function roomOf(id) {
  const match = ID_RE.exec(id || "");
  return match ? match[1] : null;
}
__name(roomOf, "roomOf");
var SignalRoom = class {
  constructor(state) {
    this.state = state;
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"type":"HEARTBEAT"}', '{"type":"HEARTBEAT-ACK"}'));
  }
  async fetch(request) {
    if (request.headers.get("upgrade") !== "websocket")
      return new Response("Expected a WebSocket.", { status: 426 });
    const url = new URL(request.url);
    const id = url.searchParams.get("id") || "";
    const token = url.searchParams.get("token") || "";
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const reject = /* @__PURE__ */ __name((message) => {
      server.accept();
      server.send(JSON.stringify(message));
      server.close(1008, message.type);
      return new Response(null, { status: 101, webSocket: client });
    }, "reject");
    if (!roomOf(id) || !TOKEN_RE.test(token)) {
      return reject({ type: "ERROR", payload: { msg: "Invalid id or token" } });
    }
    for (const socket of this.state.getWebSockets(id)) {
      const owner = socket.deserializeAttachment();
      if (owner?.token !== token)
        return reject({ type: "ID-TAKEN", payload: { msg: "ID is taken" } });
      try {
        socket.close(1e3, "Replaced");
      } catch {
      }
    }
    if (this.state.getWebSockets().length >= MAX_SOCKETS) {
      return reject({ type: "ERROR", payload: { msg: "Room is full" } });
    }
    this.state.acceptWebSocket(server, [id]);
    server.serializeAttachment({ id, token });
    server.send(JSON.stringify({ type: "OPEN" }));
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(socket, raw) {
    if (typeof raw !== "string" || raw.length > MAX_MESSAGE)
      return;
    let message;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (!message || !RELAYED.has(message.type))
      return;
    const owner = socket.deserializeAttachment();
    const dst = String(message.dst || "");
    if (!owner || roomOf(dst) !== roomOf(owner.id) || dst === owner.id)
      return;
    const targets = this.state.getWebSockets(dst);
    if (!targets.length) {
      if (message.type === "OFFER")
        socket.send(JSON.stringify({ type: "EXPIRE", src: dst, dst: owner.id }));
      return;
    }
    const out = JSON.stringify({ type: message.type, src: owner.id, dst, payload: message.payload });
    for (const target of targets) {
      try {
        target.send(out);
      } catch {
      }
    }
  }
  webSocketClose(socket, code) {
    try {
      socket.close(code === 1005 ? 1e3 : code, "Closed");
    } catch {
    }
  }
  webSocketError(socket) {
    try {
      socket.close(1011, "Error");
    } catch {
    }
  }
};
__name(SignalRoom, "SignalRoom");

// ../../worker/visits.js
var SKIP = /* @__PURE__ */ new Set(["XX", "T1", "A1", "A2", "O1", "AP", "EU"]);
var HOUR = 60 * 60 * 1e3;
var LIVE_MS = 150 * 1e3;
var MAX_LIVE = 2e3;
var MAX_COUNTRIES = 250;
function countryOf(request) {
  const raw = request.cf && request.cf.country || request.headers.get("cf-ipcountry") || "";
  const code = String(raw).trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || SKIP.has(code))
    return "";
  return code;
}
__name(countryOf, "countryOf");
function hourKey(time) {
  return new Date(time).toISOString().slice(0, 13);
}
__name(hourKey, "hourKey");
function list(countries) {
  return Object.entries(countries).filter(([code, count]) => /^[A-Z]{2}$/.test(code) && count > 0).map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count || a.code.localeCompare(b.code)).slice(0, MAX_COUNTRIES);
}
__name(list, "list");
function add(into, code, count = 1) {
  const key = code || "?";
  into[key] = (Number(into[key]) || 0) + count;
}
__name(add, "add");
var sum = /* @__PURE__ */ __name((counts) => Object.values(counts).reduce((total, count) => total + (Number(count) || 0), 0), "sum");
var VisitCounter = class {
  constructor(state, _env, now = () => Date.now()) {
    this.storage = state.storage;
    this.now = now;
    this.live = /* @__PURE__ */ new Map();
  }
  async read() {
    const [total, countries, hours] = await Promise.all([
      this.storage.get("total"),
      this.storage.get("countries"),
      this.storage.get("hours")
    ]);
    return {
      total: Number(total) || 0,
      countries: countries && typeof countries === "object" ? { ...countries } : {},
      hours: hours && typeof hours === "object" ? { ...hours } : {}
    };
  }
  // Only the last 24 hours are kept.
  keys(now) {
    return Array.from({ length: 24 }, (_, index) => hourKey(now - (23 - index) * HOUR));
  }
  prune(now) {
    for (const [id, seen] of this.live)
      if (now - seen.at > LIVE_MS)
        this.live.delete(id);
  }
  body(data, now) {
    this.prune(now);
    const keys = this.keys(now);
    const day = {};
    for (const key of keys)
      for (const [code, count] of Object.entries(data.hours[key] || {}))
        add(day, code === "?" ? "" : code, count);
    const live = {};
    for (const seen of this.live.values())
      add(live, seen.code);
    return {
      // total and countries stay at the top for older pages that read them.
      total: data.total,
      countries: list(data.countries),
      day: { total: sum(day), countries: list(day) },
      live: { total: this.live.size, countries: list(live) },
      hours: keys.map((key) => sum(data.hours[key] || {}))
    };
  }
  async fetch(request) {
    const now = this.now();
    const path = new URL(request.url).pathname;
    const data = await this.read();
    if (request.method === "POST" && path.endsWith("/live")) {
      let id = "";
      try {
        id = String((await request.json())?.id || "");
      } catch {
        id = "";
      }
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(id))
        return reply({ error: "Bad id." }, 400);
      this.prune(now);
      if (this.live.has(id) || this.live.size < MAX_LIVE)
        this.live.set(id, { code: countryOf(request), at: now });
    } else if (request.method === "POST") {
      const code = countryOf(request);
      data.total += 1;
      if (code)
        add(data.countries, code);
      const key = hourKey(now);
      const keep = new Set(this.keys(now));
      const hours = {};
      for (const [hour, counts] of Object.entries(data.hours))
        if (keep.has(hour))
          hours[hour] = counts;
      hours[key] = { ...hours[key] || {} };
      add(hours[key], code);
      data.hours = hours;
      await this.storage.put({ total: data.total, countries: data.countries, hours });
    }
    return reply(this.body(data, now));
  }
};
__name(VisitCounter, "VisitCounter");
function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}
__name(reply, "reply");

// ../../scripts/site-nav.mjs
var LOGO = '<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" style="fill:var(--accent)"/><circle cx="16" cy="16" r="6.5" style="fill:var(--accent-ink)"/><circle cx="23.5" cy="9.5" r="1.7" style="fill:var(--accent-ink)"/></svg>';
var USE_LINKS = [
  { href: "/#/receiver", label: "Receiver", note: "Pair your phone and pick a way in" },
  { href: "/#/camera", label: "Phone camera", note: "Open this on your phone" },
  { href: "/#/receiver?mode=meeting", label: "Browser extension", note: "PhoneCam in Meet, Teams and Zoom" },
  { href: "/#/check", label: "Check the extension", note: "Preview what the meeting sees" }
];
function nav(current) {
  const link = /* @__PURE__ */ __name((href, label, key) => `<a href="${href}"${current === key ? ' class="on" aria-current="page"' : ""}>${label}</a>`, "link");
  const useMenu = USE_LINKS.map((item) => `<a href="${item.href}"><strong>${item.label}</strong><span>${item.note}</span></a>`).join("");
  return `<header class="site-nav">
  <div class="site-nav-bar">
    <a class="brand" href="/" aria-label="PhoneCam home">${LOGO}PhoneCam</a>
    <nav class="site-nav-links" aria-label="Main">
      <details class="nav-drop">
        <summary>Use PhoneCam</summary>
        <div class="nav-drop-menu">${useMenu}</div>
      </details>
      ${link("/#/?section=how", "How it works", "how")}
      ${link("/guides", "Guides", "guides")}
      ${link("/about", "About", "about")}
    </nav>
    <div class="site-nav-actions">
      <a class="lp-btn primary site-nav-cta" href="/#/receiver">Get started</a>
      <details class="nav-mobile">
        <summary aria-label="Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></summary>
        <nav class="site-nav-menu" aria-label="Main">
          <p class="menu-group">Use PhoneCam</p>
          ${USE_LINKS.map((item) => `<a href="${item.href}">${item.label}</a>`).join("")}
          <p class="menu-group">Learn</p>
          ${link("/#/?section=how", "How it works", "how")}
          ${link("/guides", "Guides", "guides")}
          ${link("/about", "About", "about")}
          <a class="lp-btn primary" href="/#/receiver">Get started</a>
        </nav>
      </details>
    </div>
  </div>
</header>`;
}
__name(nav, "nav");
var THEME_SCRIPT = `
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
  `;
var NAV_SCRIPT = `
  document.addEventListener('click', function (event) {
    document.querySelectorAll('details.nav-drop[open], details.nav-mobile[open]').forEach(function (menu) {
      if (!menu.contains(event.target) || event.target.closest('a')) menu.removeAttribute('open')
    })
  })
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') document.querySelectorAll('details[open]').forEach(function (menu) { menu.removeAttribute('open') })
  })
`;

// ../../worker/notfound.js
var KINDS = [
  {
    kind: "secrets",
    test: /(^|\/)\.(env|git|aws|ssh|svn|hg|htpasswd|htaccess|npmrc|docker)|(^|\/)(config|configs|backup|backups|dump|database|db|secrets?|credentials?|private|id_rsa|keys?)(\/|\.|$)|\.(sql|bak|old|swp|zip|tar|gz|pem|key|log|ya?ml|ini|conf)$/i
  },
  { kind: "wordpress", test: /(^|\/)(wp-|wordpress|xmlrpc)|\.php\d?$|(^|\/)(cgi-bin|vendor\/phpunit)/i },
  { kind: "admin", test: /(^|\/)(admin|administrator|login|signin|sign-in|dashboard|panel|cpanel|controlpanel|manager|console|backend|root|superuser|moderator|staff|portal|auth|user\/login|phpmyadmin|pma|adminer)(\/|\.|$)/i }
];
function kindOf(pathname) {
  const path = String(pathname || "");
  for (const { kind, test } of KINDS)
    if (test.test(path))
      return kind;
  return "lost";
}
__name(kindOf, "kindOf");
var COPY = {
  admin: {
    kicker: "Error 404 \xB7 admin not found",
    title: "You\u2019re wandering in the wrong place, bro.",
    lede: "There\u2019s no admin panel here. Not hidden, not behind a secret door, not under the doormat. It doesn\u2019t exist on this website at all. Come on, I\u2019ll light the way home.",
    title2: "Back for the admin panel? Still not here.",
    sign: ["admin", "home"]
  },
  secrets: {
    kicker: "Error 404 \xB7 secrets not found",
    title: "Looking for secrets? Cute.",
    lede: "No .env, no .git, no backups lying around. The only secret here is that there\u2019s no secret. Let me show you the way out before the ghost gets bored.",
    title2: "Still digging? The ghost hid the shovel.",
    sign: [".env", "home"]
  },
  wordpress: {
    kicker: "Error 404 \xB7 not WordPress",
    title: "This isn\u2019t WordPress, friend.",
    lede: "No wp-admin, no xmlrpc.php, no PHP at all. Just a tiny webcam app and one very bored ghost. Here, follow the light.",
    title2: "Still not WordPress. We checked twice.",
    sign: ["wp-admin", "home"]
  },
  lost: {
    kicker: "Error 404 \xB7 page not found",
    title: "This page went trick-or-treating.",
    lede: "It\u2019s not here. Maybe a typo, maybe an old link, maybe a ghost ate it. Either way, the way home is this way.",
    title2: "Lost again? Happens to the best of us.",
    sign: ["???", "home"]
  }
};
function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
__name(esc, "esc");
var PROPS = {
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
      <text class="term t2" x="552" y="220" font-size="11" fill="#7cf29c" font-family="ui-monospace, Menlo, monospace">hacking\u2026 \u2593\u2593\u2591\u2591\u2591 12%</text>
      <text class="term t3" x="552" y="238" font-size="11" fill="#ff8a3d" font-family="ui-monospace, Menlo, monospace">denied by: 1 ghost \u{1F47B}</text>
      <text class="term t4" x="552" y="254" font-size="11" fill="#7cf29c" font-family="ui-monospace, Menlo, monospace">$ go home_<tspan class="caret">\u258D</tspan></text>
    </g>`,
  wordpress: `<g class="prop">
      <path d="M560 316 L560 210 Q560 160 615 160 Q670 160 670 210 L670 316 Z" fill="#2a2f3a" stroke="#454e5e" stroke-width="3"/>
      <text x="615" y="214" text-anchor="middle" font-size="22" font-weight="900" fill="#9aa4b4">RIP</text>
      <text x="615" y="242" text-anchor="middle" font-size="12" font-weight="700" fill="#8792a3">WordPress</text>
      <text x="615" y="262" text-anchor="middle" font-size="10" fill="#6f7a8b">never installed</text>
      <text x="615" y="280" text-anchor="middle" font-size="10" fill="#6f7a8b">2026 \u2013 2026</text>
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
};
function notFoundPage(pathname, nonce) {
  const kind = kindOf(pathname);
  const copy = COPY[kind];
  const shown = String(pathname || "/").slice(0, 80);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>404 \xB7 PhoneCam</title>
<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="stylesheet" href="/site.css">
<script nonce="${nonce}">${THEME_SCRIPT}<\/script>
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
  ${[...Array(36)].map((_, i) => `<span class="star" style="left:${i * 37 % 100}%;top:${i * 53 % 62}%;animation-delay:${i % 7 * 0.4}s"></span>`).join("")}
  ${["b1", "b2", "b3"].map((b) => `<div class="bat ${b}"><svg viewBox="0 0 64 28"><path d="M32 14 C26 2 14 0 2 6 C8 8 10 12 8 16 C14 13 18 16 20 20 C24 16 28 16 32 22 C36 16 40 16 44 20 C46 16 50 13 56 16 C54 12 56 8 62 6 C50 0 38 2 32 14 Z" fill="#2a2140"/></svg></div>`).join("")}
</div>
<div class="torch" aria-hidden="true"></div>
<div class="fog" aria-hidden="true"></div><div class="fog f2" aria-hidden="true"></div>

${nav("")}
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
        <text x="146" y="249" text-anchor="middle" font-size="13" font-weight="800" fill="#dff25a">${esc(copy.sign[1])} \u2192</text></g>
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
      <text class="shrug" x="300" y="116" text-anchor="middle" font-size="22" fill="#cfd6e2" font-family="ui-monospace, Menlo, monospace">\xAF\\_(\u30C4)_/\xAF</text>
    </g>
  </svg>

  <p class="kicker">${esc(copy.kicker)}</p>
  <h1 id="title">${esc(copy.title)}</h1>
  <p class="lede">${esc(copy.lede)}</p>
  <p class="extra" id="extra" aria-live="polite"></p>
  <p class="path">You asked for <s>${esc(shown)}</s></p>
  <div class="actions">
    <a class="home" id="home" href="/">\u{1F3E0} Take me home</a>
    <a class="ghostly" href="/guides">Read the guides</a>
  </div>
  <p class="fine">PhoneCam keeps no logs of this. The ghost only remembers you in your own browser.</p>
</main>

<script nonce="${nonce}">${NAV_SCRIPT}<\/script>
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
    extra.textContent = 'Back again? The ghost remembers you. (Only in this browser. We don\u2019t keep logs. We\u2019re not that kind of site.)';
  } else if (count >= 3 && count < 5) {
    body.className = body.className.replace('lv1', 'lv2');
    document.getElementById('title').textContent = title2;
    extra.textContent = 'That\u2019s your ' + ordinal(count) + ' wrong turn. The ghost has started a tally on the wall.';
  } else if (count >= 5) {
    body.className = body.className.replace('lv1', 'lv3');
    document.getElementById('title').textContent = 'Achievement unlocked: Professional Wanderer.';
    extra.textContent = ordinal(count) + ' page that doesn\u2019t exist. Honestly impressive. Have a trophy, then go home: ' + (kind === 'lost' ? 'the candy is getting cold.' : 'there\u2019s nothing here, pinky promise.');
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
<\/script>
</body>
</html>`;
}
__name(notFoundPage, "notFoundPage");
function notFound(request) {
  const url = new URL(request.url);
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const body = request.method === "HEAD" ? null : notFoundPage(url.pathname, nonce);
  return new Response(body, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-robots-tag": "noindex",
      "content-security-policy": `default-src 'none'; img-src 'self'; style-src 'self' 'nonce-${nonce}'; style-src-elem 'self' 'nonce-${nonce}'; style-src-attr 'unsafe-inline'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
    }
  });
}
__name(notFound, "notFound");

// ../../worker/report.js
var MAX_MESSAGE2 = 2e3;
var MIN_MESSAGE = 10;
var MAX_DETAILS = 600;
var MAX_EMAIL = 120;
var PER_DAY = 5;
var FROM = "reports@phonecam.app";
var WAYS = { extension: "Browser extension", share: "Share a tab", obs: "OBS", camera: "Phone camera page", unsure: "Not sure" };
function clean(value, max) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim().slice(0, max);
}
__name(clean, "clean");
function validEmail(value) {
  return value.length <= MAX_EMAIL && /^[^\s@<>"(),;:\\[\]]+@[^\s@<>"(),;:\\[\]]+\.[a-z]{2,}$/i.test(value);
}
__name(validEmail, "validEmail");
function base64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes)
    binary += String.fromCharCode(byte);
  return btoa(binary);
}
__name(base64, "base64");
function wrap(text) {
  return text.match(/.{1,76}/g)?.join("\r\n") ?? "";
}
__name(wrap, "wrap");
function headerText(text) {
  const plain = text.replace(/[\r\n]+/g, " ");
  return /^[\x20-\x7e]*$/.test(plain) ? plain : `=?UTF-8?B?${base64(plain)}?=`;
}
__name(headerText, "headerText");
function buildMime({ to, replyTo, subject, body, id }) {
  const lines = [
    `From: ${headerText("PhoneCam reports")} <${FROM}>`,
    `To: <${to}>`,
    replyTo ? `Reply-To: <${replyTo}>` : null,
    `Subject: ${headerText(subject)}`,
    `Message-ID: <${id}@phonecam.app>`,
    `Date: ${(/* @__PURE__ */ new Date()).toUTCString()}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(base64(body))
  ];
  return lines.filter((line) => line !== null).join("\r\n");
}
__name(buildMime, "buildMime");
async function emailMessage(from, to, raw) {
  try {
    const { EmailMessage } = await import("cloudflare:email");
    return new EmailMessage(from, to, raw);
  } catch {
    return { from, to, raw };
  }
}
__name(emailMessage, "emailMessage");
async function hash(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(hash, "hash");
async function overLimit(request, salt) {
  const cache = globalThis.caches?.default;
  if (!cache)
    return false;
  const address = request.headers.get("cf-connecting-ip") || "unknown";
  const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const key = new Request(`https://phonecam.app/__report-limit/${await hash(`${salt}|report|${address}|${day}`)}`);
  const hit = await cache.match(key);
  const count = hit ? Number(await hit.text()) || 0 : 0;
  if (count >= PER_DAY)
    return true;
  await cache.put(key, new Response(String(count + 1), { headers: { "cache-control": "max-age=86400" } }));
  return false;
}
__name(overLimit, "overLimit");
async function report(request, env, json2) {
  if (request.method !== "POST")
    return json2({ error: "Method not allowed." }, 405, { allow: "POST" });
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== new URL(request.url).host) {
    return json2({ error: "Send reports from the PhoneCam site." }, 403);
  }
  if (!(request.headers.get("content-type") || "").includes("application/json")) {
    return json2({ error: "Expected JSON." }, 415);
  }
  if (Number(request.headers.get("content-length") || 0) > 8e3)
    return json2({ error: "That is too long." }, 413);
  let body;
  try {
    body = await request.json();
  } catch {
    return json2({ error: "Expected JSON." }, 400);
  }
  if (body?.website)
    return json2({ ok: true }, 201);
  const message = clean(body?.message, MAX_MESSAGE2);
  if (message.length < MIN_MESSAGE)
    return json2({ error: "Tell us a little more about what happened." }, 400);
  const email = clean(body?.email, MAX_EMAIL).replace(/\s/g, "");
  if (email && !validEmail(email))
    return json2({ error: "That email address doesn\u2019t look right." }, 400);
  const way = WAYS[body?.way] || WAYS.unsure;
  const details = clean(body?.details, MAX_DETAILS);
  if (!env.REPORT_MAIL || !env.REPORT_TO) {
    return json2({ error: "Reports can\u2019t be sent from the site right now.", fallback: "hello@phonecam.app" }, 503);
  }
  if (await overLimit(request, env.FEEDBACK_SALT || "phonecam")) {
    return json2({ error: "You\u2019ve sent several reports today. Thank you! Email hello@phonecam.app if it\u2019s urgent." }, 429);
  }
  const id = crypto.randomUUID();
  const text = [
    message,
    "",
    "---",
    `Way in: ${way}`,
    `Reply to: ${email || "(no email given)"}`,
    details ? `Device: ${details}` : null,
    `Country: ${request.cf?.country || "unknown"}`,
    `Sent: ${(/* @__PURE__ */ new Date()).toISOString()}`,
    `Report id: ${id}`
  ].filter((line) => line !== null).join("\n");
  const subject = `PhoneCam report: ${message.split("\n")[0].slice(0, 60)}`;
  try {
    const raw = buildMime({ to: env.REPORT_TO, replyTo: email, subject, body: text, id });
    await env.REPORT_MAIL.send(await emailMessage(FROM, env.REPORT_TO, raw));
  } catch {
    return json2({ error: "Your report couldn\u2019t be sent. Try again in a minute.", fallback: "hello@phonecam.app" }, 502);
  }
  return json2({ ok: true, id: id.slice(0, 8) }, 201);
}
__name(report, "report");

// ../../worker/index.js
var ORIGINS = [
  /^https:\/\/(www\.)?phonecam\.app$/,
  /^https:\/\/phonecam\.kaysarulanas2\.workers\.dev$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^https:\/\/meet\.google\.com$/,
  /^https:\/\/teams\.(microsoft\.com|live\.com|cloud\.microsoft)$/,
  /^https:\/\/([a-z0-9-]+\.)*zoom\.us$/,
  /^https:\/\/discord\.com$/,
  /^https:\/\/([a-z0-9-]+\.)*whereby\.com$/,
  /^https:\/\/meet\.jit\.si$/,
  /^https:\/\/([a-z0-9-]+\.)*webex\.com$/
];
function allowedOrigin(request) {
  const origin = request.headers.get("origin");
  return origin && ORIGINS.some((pattern) => pattern.test(origin)) ? origin : null;
}
__name(allowedOrigin, "allowedOrigin");
var TURN_TTL = 4 * 60 * 60;
async function turn(request, env) {
  const origin = allowedOrigin(request);
  const headers = { "cache-control": "no-store", vary: "Origin" };
  if (origin)
    headers["access-control-allow-origin"] = origin;
  if (!origin && request.headers.get("origin"))
    return json({ error: "Not allowed." }, 403, headers);
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN)
    return json({ iceServers: null }, 200, headers);
  const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ ttl: TURN_TTL })
  });
  if (!response.ok)
    return json({ iceServers: null }, 200, headers);
  const data = await response.json();
  const iceServers = (data.iceServers || []).map((server) => ({
    ...server,
    urls: [].concat(server.urls).filter((url) => !/:53(\?|$)/.test(url))
  })).filter((server) => server.urls.length);
  return json({ iceServers, ttl: TURN_TTL }, 200, headers);
}
__name(turn, "turn");
function signal(request, env) {
  if (request.headers.get("upgrade") !== "websocket")
    return new Response("Expected a WebSocket.", { status: 426 });
  if (!allowedOrigin(request))
    return new Response("Not allowed.", { status: 403 });
  if (!env.SIGNAL)
    return new Response("Signalling is not set up.", { status: 503 });
  const room = roomOf(new URL(request.url).searchParams.get("id"));
  if (!room)
    return new Response("Invalid id.", { status: 400 });
  return env.SIGNAL.get(env.SIGNAL.idFromName(room)).fetch(request);
}
__name(signal, "signal");
var MAX_COMMENT = 500;
var MAX_NAME = 40;
var SHOWN = 12;
function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      ...extra
    }
  });
}
__name(json, "json");
function clean2(value, max) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\s+\n/g, "\n").trim().slice(0, max);
}
__name(clean2, "clean");
async function visitorDay(request, salt) {
  const address = request.headers.get("cf-connecting-ip") || "unknown";
  const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const bytes = new TextEncoder().encode(`${salt}|${address}|${day}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(visitorDay, "visitorDay");
var SCHEMA = [
  `CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    public_ok INTEGER NOT NULL DEFAULT 0,
    approved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    visitor_day TEXT NOT NULL UNIQUE
  )`,
  "CREATE INDEX IF NOT EXISTS feedback_shown ON feedback (approved, public_ok, created_at)"
];
var ready = /* @__PURE__ */ new WeakMap();
function ensureSchema(db) {
  if (!ready.has(db)) {
    const job = db.batch(SCHEMA.map((sql) => db.prepare(sql))).catch((error) => {
      ready.delete(db);
      throw error;
    });
    ready.set(db, job);
  }
  return ready.get(db);
}
__name(ensureSchema, "ensureSchema");
async function summary(env) {
  const stats = await env.DB.prepare("SELECT COUNT(*) AS count, AVG(rating) AS average FROM feedback").first();
  const { results } = await env.DB.prepare(
    "SELECT rating, comment, name, created_at FROM feedback WHERE approved = 1 AND public_ok = 1 AND comment <> '' ORDER BY created_at DESC LIMIT ?"
  ).bind(SHOWN).all();
  return json(
    {
      count: stats?.count || 0,
      average: stats?.average ? Math.round(stats.average * 10) / 10 : null,
      testimonials: (results || []).map((row) => ({
        rating: row.rating,
        comment: row.comment,
        name: row.name || "PhoneCam user",
        date: row.created_at.slice(0, 10)
      }))
    },
    200,
    { "cache-control": "public, max-age=30" }
  );
}
__name(summary, "summary");
async function submit(request, env) {
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== new URL(request.url).host) {
    return json({ error: "Send feedback from the PhoneCam site." }, 403);
  }
  if (!(request.headers.get("content-type") || "").includes("application/json")) {
    return json({ error: "Expected JSON." }, 415);
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 4e3)
    return json({ error: "That is too long." }, 413);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Expected JSON." }, 400);
  }
  if (body.website)
    return json({ ok: true });
  const rating = body.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ error: "Pick a rating from 1 to 5 stars." }, 400);
  }
  const comment = clean2(body.comment, MAX_COMMENT);
  const name = clean2(body.name, MAX_NAME).replace(/\n/g, " ");
  const publicOk = body.publicOk === true && comment !== "" ? 1 : 0;
  const key = await visitorDay(request, env.FEEDBACK_SALT || "phonecam");
  try {
    await env.DB.prepare(
      "INSERT INTO feedback (rating, comment, name, public_ok, visitor_day) VALUES (?, ?, ?, ?, ?)"
    ).bind(rating, comment, name, publicOk, key).run();
  } catch (error) {
    if (String(error?.message || error).includes("UNIQUE")) {
      return json({ error: "You already rated PhoneCam today. Thank you!" }, 429);
    }
    throw error;
  }
  return json({ ok: true }, 201);
}
__name(submit, "submit");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/visits" || url.pathname === "/api/visits/live") {
      if (!env.VISITS)
        return json({ error: "Visits are not set up yet." }, 503);
      if (url.pathname === "/api/visits/live" ? request.method !== "POST" : request.method !== "GET" && request.method !== "POST") {
        return json({ error: "Method not allowed." }, 405, { allow: "GET, POST" });
      }
      if (request.method === "POST") {
        const origin = request.headers.get("origin");
        let sameSite = false;
        try {
          sameSite = !!origin && new URL(origin).host === url.host;
        } catch {
          sameSite = false;
        }
        if (!sameSite)
          return json({ error: "Not allowed." }, 403);
      }
      try {
        return await env.VISITS.get(env.VISITS.idFromName("site")).fetch(request);
      } catch {
        return json({ error: "Something went wrong. Try again later." }, 500);
      }
    }
    if (url.pathname === "/api/feedback") {
      if (!env.DB)
        return json({ error: "Ratings are not set up yet." }, 503);
      try {
        await ensureSchema(env.DB);
        if (request.method === "GET")
          return await summary(env);
        if (request.method === "POST")
          return await submit(request, env);
        return json({ error: "Method not allowed." }, 405, { allow: "GET, POST" });
      } catch {
        return json({ error: "Something went wrong. Try again later." }, 500);
      }
    }
    if (url.pathname === "/api/report")
      return report(request, env, json);
    if (url.pathname === "/signal/peerjs")
      return signal(request, env);
    if (url.pathname === "/api/turn") {
      if (request.method === "OPTIONS") {
        const origin = allowedOrigin(request);
        return new Response(null, { status: origin ? 204 : 403, headers: origin ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET", vary: "Origin" } : {} });
      }
      try {
        return await turn(request, env);
      } catch {
        return json({ iceServers: null }, 200, { "cache-control": "no-store" });
      }
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not found.", hint: "There is no admin API here. There never was. Go outside, it\u2019s nice out." }, 404);
    }
    const response = await env.ASSETS.fetch(request);
    if (response.status === 404 && (request.method === "GET" || request.method === "HEAD"))
      return notFound(request);
    return response;
  }
};

// ../../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-bw8eTv/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-bw8eTv/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  SignalRoom,
  VisitCounter,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
