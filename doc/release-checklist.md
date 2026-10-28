# PhoneCam 1.0.0 release checklist

Work through this top to bottom. Tick each box as you go. If something fails, stop and fix it before moving on, except where it says you can ship without it.

---

## 1. Before you deploy (on your Mac, about 10 minutes)

- [ ] `npm install` finishes with no errors
- [ ] First time only: `npx playwright install chromium`
- [ ] `npm test` → **43 pass, 0 fail** (pairing, Worker and signalling unit tests, a few seconds)
- [ ] `npm run test:e2e` → **68 pass, 0 fail** (about 3 minutes; builds a test copy in `.test-build/`, runs the Worker locally, drives Chromium with a fake camera)
- [ ] `npm run build` finishes and prints `Pages built: 10 files` and `Extension built`
- [ ] `store/phonecam-extension-1.0.0.zip` exists
- [ ] `unzip -l store/phonecam-extension-1.0.0.zip` shows `manifest.json` at the top level (not inside a folder)
- [ ] `git status` shows no `.test-build/`, `dist/` or `dist-extension/` files to commit

### What the automated tests cover

| Suite | Checks |
|---|---|
| Unit: pairing | random 16-character room ids; 256-bit keys; proofs fail with the wrong key, role, nonce order, a replayed nonce, or a forged or oversized proof; the session key is sealed, can't be opened with another key, and tampering is detected; junk pair links are rejected |
| Unit: Worker | signalling refuses other sites, plain requests, old (v1) ids, and runs without the Durable Object binding only as 503; TURN credentials only for PhoneCam and the meeting sites, and port 53 is dropped; ratings: site-only, JSON, whole number 1–5, trimmed text, length limits, bot trap, one per visitor per day, the address is never stored, the table is created on first use; there is no admin API on the public site; missing pages get the 404 page, matched to the path, never echoing it as HTML |
| Unit: signalling room | offers relayed inside a room with the sender's id; never relayed to another room; an offline target gets EXPIRE; junk, unknown types and messages over 32 KB are ignored |
| E2E: security | pair from the link and go live; the key leaves the address bar; the QR key is burned and the phone gets its own key; a second phone with the same code is refused; a phone without the key can't push video mid-call; the paired phone reconnects without scanning; a phone won't stream to someone who grabbed the room first; a junk link is refused |
| E2E: extension | the PhoneCam camera appears in a meeting page with a strict security policy; picking it gives a live track labelled PhoneCam, with the laptop mic; the waiting card shows; the phone pairs from the popup's link and its picture replaces the card; the popup goes Not in a meeting yet → Waiting for you to scan → Live and folds its steps; back to idle after the meeting closes; the OBS view never shows a code |
| E2E: pages | home, the 3 receiver tabs, camera, check, rate, report, privacy, Guides, About and the 7 guides load on a laptop and a phone with no errors and no sideways scroll; one main button on the home page; the Use PhoneCam menu opens, marks the current page and closes on a pick or Escape; the phone menu lists 4 + 3 links and closes; Guides and About are in the nav, guides link back to the guides, and the static pages share the same menu; every picture and social image on the guides and About loads; the sitemap lists them; footer columns and version on every page; the home page steps to a new color edition each visit and keeps it on refresh; Black & white sticks; the accent picked on the phone sticks; the camera won't start before pairing; a rating goes through, a second one is refused, and comments stay hidden until approved; the site has no admin page or admin API (`#/admin` and `/admin` get the ghost); the 404 page matches secrets, WordPress and typos, gets sillier by the fifth wrong turn, and leads home |

---

### After a content change (guides and About)

- [ ] Guides live in `content/guides/*.html`, About in `content/pages/about.html`. `npm run dev` shows them at `/guides`, `/about` and `/<slug>`
- [ ] New or changed pictures: `python3 scripts/guide-art.py` (covers and diagrams), then `node scripts/guide-art-png.mjs` (the PNG social images)
- [ ] Screenshots in `public/guides/img/shots/` are real captures of the app; retake them when a screen changes

---

## 2. Deploy

- [ ] Commit in a few pieces (for example: pairing and signalling · UI and nav/footer · tests and docs · store files), then push
- [ ] The Cloudflare build log ends with `Deployed phonecam` and lists `phonecam.app`
- [ ] The log shows the Durable Object migration (`SignalRoom`) with no error. **If it errors, stop and send the log**
- [ ] Optional now, recommended before you announce it: TURN relay
  - Cloudflare dashboard → Realtime → TURN Server → create a key
  - `npx wrangler secret put TURN_KEY_ID`, then `npx wrangler secret put TURN_KEY_API_TOKEN`
- [ ] Ratings database (see README → Ratings and testimonials): `npx wrangler d1 create phonecam`, paste the id into `wrangler.toml`, push
- [ ] On your Mac: `node admin-local/server.mjs` opens the local admin and shows the totals (0 ratings is fine)
- [ ] Leave a test rating with a comment and "show on site" ticked, approve it in the local admin, check the home page within 30 seconds, then delete it
- [ ] Problem reports and hello@phonecam.app (Cloudflare Email Routing, free):
  - Dashboard → phonecam.app → Email → Email Routing → Enable (adds the MX records)
  - Destination addresses → add kaysarulanas2@gmail.com, then click the verify link in that inbox
  - Routing rules → custom address `hello@phonecam.app` → send to kaysarulanas2@gmail.com
  - Uncomment the `[[send_email]]` and `[vars]` lines at the end of `wrangler.toml`, deploy again
  - Check: send a test from `https://phonecam.app/#/report`; you see "Report sent" and the email arrives. Email hello@phonecam.app from another account; it arrives too

### Live smoke test (laptop browser, 2 minutes)

- [ ] `https://phonecam.app` loads; the nav, hero, three cards and footer look right; the footer says Version 1.0.0
- [ ] `https://phonecam.app/privacy.html` loads (the store needs this exact link)
- [ ] `https://phonecam.app/api/turn` in the address bar shows JSON. `iceServers: null` is fine without the TURN secrets; a list means TURN is on
- [ ] Ratings: with the database set up, the home page shows a "Ratings" section; without it, the section is hidden (both are fine)
- [ ] Receiver → Share a tab shows a large QR code and the status "Scan the code with your phone…" (that means the signalling server answered)

---

## 3. Real devices (the part the tests can't do)

Use the **production** site and the extension built by `npm run build` (`dist-extension/`, loaded unpacked in `chrome://extensions`).

### 3a. Pairing and streaming (Share a tab, no extension)

| | iPhone (Safari) | Android (Chrome) |
|---|---|---|
| Scan the QR on Receiver → Share a tab; Start streaming; laptop shows the picture | [ ] | [ ] |
| Phone shows "Live on your laptop"; after ~4 s the controls fade and "Live · keep this screen open" stays | [ ] | [ ] |
| Tap the video: controls come back | [ ] | [ ] |
| Switch front/back camera while live: the laptop picture switches | [ ] | [ ] |
| Lock the phone for 10 s, unlock, return to PhoneCam: the picture comes back on its own | [ ] | [ ] |
| Stop, close the tab, open phonecam.app/#/camera again: shows "Receiver page · paired"; Start works with no scan | [ ] | [ ] |
| Scan the same (used) QR with a **second** phone: it says the code was already used | [ ] | [ ] |
| Present mode: the "Now share this tab" note shows, the controls fade, no QR anywhere | [ ] | [ ] |

### 3b. The extension in real meetings

| | Google Meet | Microsoft Teams (web) | Zoom (web client) |
|---|---|---|---|
| Camera settings list **PhoneCam** | [ ] | [ ] | [ ] |
| Picking it shows "Pair your phone to start" (before pairing) or "Waiting for your phone" | [ ] | [ ] | [ ] |
| After Start on the phone, your camera tile shows the phone picture | [ ] | [ ] | [ ] |
| Another participant (second laptop or a second account) sees the phone picture | [ ] | [ ] | [ ] |
| Phone locks: the tile shows the waiting card, then recovers by itself after unlock | [ ] | [ ] | [ ] |
| The popup shows "Live in your meeting" while live | [ ] | [ ] | [ ] |
| Your own mic still works in the meeting | [ ] | [ ] | [ ] |

If one site fails and you can't fix it tonight, remove its two lines from `extension/manifest.json`, rebuild, and leave it out of the store description. Ship the others.

### 3c. Networks

- [ ] Phone and laptop on the **same Wi-Fi**: connects within ~5 s
- [ ] Phone on **mobile data**, laptop on Wi-Fi: connects (needs TURN on for the hardest networks). Note the result either way
- [ ] Laptop on a different network (hotspot): connects, or note it

### 3d. Install and look

- [ ] iPhone: Safari → Share → Add to Home Screen. The icon is the lime PhoneCam mark and opens the camera
- [ ] Android: Chrome menu → Install app (or the Install button). The icon isn't cropped on the home screen
- [ ] Home page: open it in two new tabs; each shows the next color edition. "Black & white" stays after a refresh, and "Use color" brings it back
- [ ] Phone camera → Settings → Color: the choice stays after closing and reopening

---

## 4. Security spot checks on the live site (5 minutes)

- [ ] Share a meeting screen while the extension waits: nobody can see a code or QR in your camera tile
- [ ] Present mode before pairing: it says to pair first and shows **no** QR code
- [ ] In the phone's address bar after scanning: the `pair=` part is gone
- [ ] Receiver → "Pair a different phone": your old phone no longer connects; the new QR works once
- [ ] Popup → "Pair a different phone": same, for the extension

---

## 5. Chrome Web Store submission

- [ ] Developer account registered (one-time US$5) and 2-step verification on
- [ ] New item → upload `store/phonecam-extension-1.0.0.zip`
- [ ] Store listing: copy everything from `store/listing.md`
- [ ] Screenshots: `store/screenshot-1.png`, `screenshot-2.png`, `screenshot-3.png` (1280×800)
- [ ] Small promo tile: `store/promo-440x280.png`
- [ ] Privacy tab: single purpose, the `storage` and host permission justifications, "No remote code", data usage "none", the three certifications, privacy URL `https://phonecam.app/privacy.html`
- [ ] Distribution: Free, Public, all regions
- [ ] **Submit for review**

## 6. After you submit

- [ ] Note the submission date. Review often takes a few days for an extension that runs on meeting sites
- [ ] When it's approved: change the receiver's extension tab from "Download" to the store link, and update `manifest.json` → next version is 1.0.1
- [ ] Any change to how phones and laptops pair needs a new protocol version (`phonecam-v3-…`) running next to v2. See README → Pairing and security
- [ ] Keep `npm test` and `npm run test:e2e` green before every deploy
