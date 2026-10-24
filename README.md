# PhoneCam

Use the phone you already own as a webcam on a laptop, with **no app on the phone**. The phone runs PhoneCam in Safari or Chrome, and the picture goes straight from the phone to the laptop over WebRTC. Live at **https://phonecam.app**.

On the laptop, pick how the meeting gets the picture:

| Way | Install on the laptop | Works in |
| --- | --- | --- |
| **Browser extension** | PhoneCam extension (Chrome, Edge, Brave, Arc) | Meet, Teams, Zoom, Discord, Whereby, Jitsi and Webex in the browser. Shows up as a camera called **PhoneCam** |
| **Share a tab** | Nothing | Every meeting app, as a screen share |
| **OBS** | OBS Studio | Every app, through OBS Virtual Camera |

The roadmap, including a native desktop helper and its costs, is in [doc/feature_plan.md](doc/feature_plan.md). Privacy is at [phonecam.app/privacy.html](https://phonecam.app/privacy.html).

## Pages

| Path | Who | What |
| --- | --- | --- |
| `#/` | Anyone | How PhoneCam works, and a link to the camera or the receiver |
| `#/camera` | Phone | The camera. A QR code opens this page and pairs the phone |
| `#/receiver` | Laptop | Pairing QR code, and the three ways above |
| `#/check` | Laptop | Preview the PhoneCam camera the extension adds |

Old `camera.html` and `receiver.html` links still open these pages.

## Run it

```bash
npm install
npm run dev
```

Open the laptop page at `http://localhost:5173/#/receiver`. The QR code uses an address the phone can open, such as the computer’s Wi-Fi address (`http://192.168.x.x:5173`).

A phone can open the camera only on an https address. On a plain Wi-Fi address the page loads, and the camera stays blocked. For a real session use https://phonecam.app. To test against this dev server, point the QR code at an https tunnel:

```bash
PHONECAM_ORIGIN=https://your-tunnel.trycloudflare.com npm run dev
```

Vite accepts `*.trycloudflare.com`. The same URL can go in `.phone-origin` (one line, not committed). Then `npm run dev` picks it up on its own.

## Tests

```bash
npm test               # unit tests: pairing, Worker, signalling (seconds)
npx playwright install chromium   # first time only
npm run test:e2e       # browser tests against a local Worker (about 3 minutes)
```

`npm run test:e2e` builds a test copy into `.test-build/` (your `dist/` is never touched), starts the Worker with `wrangler dev` (signalling Durable Object and a local ratings database) plus a fake meeting page with a strict security policy, then drives Chromium with a fake camera through pairing, the attacks, the extension, every page on a laptop and a phone, nav, footer and ratings. Run one file with `node tests/e2e/run.mjs tests/e2e/security.spec.mjs`.

The release checklist, including the manual tests on real phones and real meetings, is in [doc/release-checklist.md](doc/release-checklist.md).

## Build and deploy

```bash
npm run build
npm run deploy
```

`npm run build` writes the web app to `dist/`, the extension to `dist-extension/`, and a download zip to `dist/phonecam-extension.zip`. The receiver page offers that zip. With the default signalling server and no extra extension sites, it also writes a Chrome Web Store zip to `store/phonecam-extension-<version>.zip`. Store copy and screenshots are in [store/listing.md](store/listing.md).

`npm run deploy` publishes `dist/` with Wrangler. `wrangler.toml` serves it as a Worker with static assets at `phonecam.app` and `www.phonecam.app`.

`npm run build:pages` is the same build with a `/phonecam/` base path.

### Build options

| Variable | Effect |
| --- | --- |
| `PHONECAM_PEER_SERVER` | JSON PeerJS options for the web app and the extension, for example `{"host":"127.0.0.1","port":8787,"path":"/signal/","secure":false}` for `wrangler dev`. Without it, the site on phonecam.app and the extension use PhoneCam's own signalling server, and `localhost` falls back to the public PeerJS server. |
| `PHONECAM_API` | Origin for `/api/turn`, for example `http://127.0.0.1:8787`. The extension defaults to `https://phonecam.app` |
| `PHONECAM_EXTRA_MATCHES` | Extra sites for the extension, comma-separated, for example `http://localhost/*` while testing |
| `PHONECAM_ORIGIN` | Dev server only. https origin to put in the phone QR code. A `.phone-origin` file does the same job |

## The browser extension

The extension has its own pairing, saved in the browser. After it is installed, the receiver page can stay closed. Its QR code always opens https://phonecam.app.

Install it from a build:

1. Download `phonecam-extension.zip` from the receiver page (or run `npm run build:extension`) and unzip it.
2. Open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked** and pick the `phonecam-extension` folder (or `dist-extension/`).
3. Click the PhoneCam icon in the toolbar and scan its QR code with the phone. Tap **Start streaming**.
4. In the meeting, choose **PhoneCam** as the camera. `#/check` previews it before you join.

How it works: `extension/src/main-world.js` adds the PhoneCam device to the page's camera list and feeds a generated video track. The track shows a waiting card first, then the phone's frames. If the phone goes quiet, the waiting card comes back on that same track, so the meeting keeps PhoneCam selected. `extension/src/bridge.js` holds the connection and the pairing check in the extension's isolated world, which the meeting site's security policy cannot block. The waiting card never shows a code, because everyone in the meeting sees it.

## Each session with Share a tab

1. On the laptop, open `#/receiver` and choose **Share a tab**.
2. On the phone, scan the QR code and tap **Start streaming**.
3. Click **Present mode**. The controls fade out so they stay out of the picture.
4. In the meeting, share that browser tab. In the Zoom or Teams desktop apps, share the browser window. Turn the meeting camera off so people see the phone.

## Each session with OBS

1. On the laptop, open `#/receiver`, choose **OBS** and copy the OBS link. It pairs a phone with OBS, so keep it private. The receiver page itself doesn't receive video in OBS mode.
2. OBS → Sources → **+** → **Browser**. Paste the link. Use **1280 × 720** for 720p, or **1920 × 1080** for 1080p.
3. Click **Start Virtual Camera**.
4. On the phone, scan the QR code and tap **Start streaming**.
5. In the meeting app, choose **OBS Virtual Camera**.

## On the phone

The camera page is `#/camera`.

- Quality is 720p, 1080p, or 480p, all at 30 fps. 480p is the one for a weak Wi-Fi.
- The mic starts off, so the laptop mic is used. **Send the phone mic** sends the phone’s microphone too. On the receiver, turn on **Phone mic** (`audio=1`) to hear it.
- The round button switches between the front and back camera.
- Leave this screen on. iOS pauses the camera in the background. A stand and a charger help.
- A home-screen icon is optional. On iPhone: Safari → Share → **Add to Home Screen**. On Android: Chrome → menu → **Add to Home screen** or **Install app**. The icon opens the camera.

## Pairing and security

Each laptop side (the Share a tab page, the OBS link, the extension) owns a room with a random 16-character id and a one-time 256-bit pairing key. The QR code carries both after the `#`, so they never reach a server.

1. Over the encrypted WebRTC data channel, the phone and the laptop each prove they hold the key (HMAC-SHA-256 over fresh nonces from both sides).
2. The phone only sends video after the laptop's proof checks out, so someone who grabs the room first gets nothing.
3. The laptop only answers a video call from the phone that just passed, so nobody can push video into your meeting.
4. On first pairing the laptop sends that phone a new key, encrypted with the pairing key, and forgets the pairing key. The QR code is used up; any other phone that scans it is refused. Next time the paired phone reconnects without scanning.
5. **Pair a different phone** (receiver, popup) makes a new room and code. **Forget** on the phone removes a laptop.

The protocol is versioned in the peer ids (`phonecam-v2-…`) so a future change can run next to this one. Code: `src/lib/pairing.js`, `src/lib/receiver-core.js`, `src/lib/phone-link.js`.

## Signalling and relay

`worker/signal.js` is PhoneCam's own signalling server: a Durable Object per room that speaks the PeerJS server protocol at `/signal/peerjs`. Peers can only reach peers in their own room, a room holds at most 4 sockets, and only PhoneCam and the meeting sites the extension supports may connect. It runs on the Workers free plan (SQLite-backed Durable Objects; the migration is in `wrangler.toml`).

`/api/turn` hands out 4-hour TURN credentials from Cloudflare Realtime, so phones on mobile data or strict Wi-Fi can still connect. To turn it on, create a TURN key in the Cloudflare dashboard (Realtime → TURN Server), then:

```bash
npx wrangler secret put TURN_KEY_ID
npx wrangler secret put TURN_KEY_API_TOKEN
```

Without them PhoneCam uses direct connections only. The first 1,000 GB of relay traffic each month is free, then US$0.05/GB.

Test the whole thing locally with `wrangler dev`: build with `PHONECAM_PEER_SERVER='{"host":"127.0.0.1","port":8787,"path":"/signal/","secure":false}' PHONECAM_API=http://127.0.0.1:8787 npm run build`, then `npx wrangler dev --port 8787`.

## Ratings and testimonials

`#/rate` lets people leave 1 to 5 stars, an optional comment and name, and tick whether the comment may be shown on the site. The home page shows the average rating and approved comments. `worker/index.js` serves `/api/feedback` and stores ratings in a Cloudflare D1 database. Until the database is set up, the home page hides the ratings section and the API answers 503.

Turn it on once:

```bash
npx wrangler d1 create phonecam          # copy the database_id it prints
# paste it into the [[d1_databases]] block in wrangler.toml and remove the # signs
npx wrangler d1 execute phonecam --remote --file=worker/schema.sql
npm run build && npm run deploy
```

Read new feedback and approve comments for the site:

```bash
npx wrangler d1 execute phonecam --remote --command "SELECT id, rating, name, comment, public_ok, approved, created_at FROM feedback ORDER BY id DESC LIMIT 20"
npx wrangler d1 execute phonecam --remote --command "UPDATE feedback SET approved = 1 WHERE id = 12"
```

Only rows with `public_ok = 1` and `approved = 1` appear on the site, within 5 minutes. To remove one, `DELETE FROM feedback WHERE id = 12`. One rating per visitor per day; the Worker stores a hash of the network address and the date, never the address.

## Color

People can pick an accent color (Lime, Sky, Coral, Violet, Mint) on the home page, the receiver and in the camera settings. It is saved in that browser only. The colors are in `src/lib/theme.js`, and `index.html` applies the saved one before the page draws.

## Receiver options

The chips on Share a tab and OBS write these into the link.

| Option | Effect |
| --- | --- |
| `mirror=1` | Mirror the picture |
| `fit=cover` | Fill the frame and crop |
| `audio=1` | Play the phone mic. Also set Mic to “Send the phone mic” on the phone |
| `present=1` | Present mode: video only, controls fade out after a few seconds |

## Notes

- The signalling server only introduces the two devices. The video goes directly between them, or through Cloudflare's TURN relay (still encrypted) when a direct path isn't possible.
- Nothing is recorded. Details are in the [privacy policy](https://phonecam.app/privacy.html).
