# PhoneCam feature plan

Last updated: 24 October 2026 (pairing, own signalling and TURN added)

## The rule we design around

**Nothing gets installed on the phone.** The phone always runs the PhoneCam web app in Safari or Chrome (optionally added to the home screen). This is the main difference from Camo, DroidCam and Iriun, which all need an app on the phone *and* on the computer.

Everything in this plan is about the **laptop side**: how the phone's picture gets into the meeting.

## Where the picture can go (outputs)

A web page cannot register itself as a system camera. Only a native driver can. So PhoneCam keeps one connection layer (`src/lib/receiver-core.js`: room, call, reconnects) and offers several outputs on top of it.

| # | Output | Status | Install on laptop | Works in | Cost |
|---|---|---|---|---|---|
| 1 | **Share a tab** (Present mode) | Shipped | Nothing | Every meeting app. Shows as a screen share, not the camera tile | Free |
| 2 | **Browser extension** | Shipped (load unpacked) | Chrome/Edge extension | Meet, Teams, Zoom, Discord, Whereby, Jitsi, Webex **in the browser** | $5 one-time for Chrome Web Store |
| 3 | **Native helper app** | Planned, see below | Small desktop app | Every app, including the Zoom and Teams desktop apps, as a real camera | $99/yr Apple + about $120/yr Windows signing |
| 4 | **OBS** | Shipped | OBS Studio | Every app, through OBS Virtual Camera | Free |

### 1. Share a tab: how it works

`#/receiver?present=1` shows only the video, and the controls fade out after 2.5 seconds. The user shares that tab in the meeting. No install, but people see a screen share instead of a camera tile.

### 2. Browser extension: how it works

Folder: `extension/`. Build: `npm run build:extension`. Output: `dist-extension/` plus `dist/phonecam-extension.zip`, which the site serves for download.

- `main-world.js` runs inside the meeting page. It adds a **PhoneCam** device to `enumerateDevices()`, and when `getUserMedia()` asks for it, returns a track from a `MediaStreamTrackGenerator`. The generator shows a waiting card until the phone connects, then the phone's frames. The meeting keeps one track the whole time, so a phone that drops and comes back needs no action in the meeting. If the phone goes quiet for 3 seconds (iOS pausing the camera), the waiting card comes back.
- `bridge.js` runs in the extension's isolated world and opens the PeerJS room. That world isn't bound by the meeting site's Content-Security-Policy, which matters because Meet and Teams restrict `connect-src`. The stream is handed to the page through a hidden `<video>` element that both worlds can see.
- `popup.html` shows the room code and the QR code for the phone.

Verified in headless Chromium (against a local Worker with the real signalling server and pairing) on a test page with `connect-src 'none'`: the device appears, the waiting card shows, the phone's video arrives, and the same track recovers after the phone disconnects and reconnects. **Still to verify on the real Meet, Teams and Zoom web clients.**

**To publish:** Chrome Web Store developer account ($5 one-time), Edge Add-ons (free), then switch the receiver's download button to the store links. Firefox needs a separate check, because Firefox doesn't support `MediaStreamTrackGenerator`.

## 3. Native helper app (planned)

### What it is

A small desktop app (Tauri suggested, so the UI reuses the React code) that:

1. Opens the PhoneCam room itself, using the same `receiver-core` protocol, so the phone side doesn't change at all.
2. Pushes the decoded frames into a **real system camera** called "PhoneCam".

This is the only option that reaches the **Zoom, Teams, FaceTime and Webex desktop apps** as a normal camera, with no OBS. It's how Camo and DroidCam work on the computer side. The difference is that PhoneCam still needs **no phone app**.

### Per-platform work

| Platform | Virtual camera API | Notes |
|---|---|---|
| macOS 12.3+ | **CoreMediaIO Camera Extension** (system extension, Swift) | The host app receives WebRTC and feeds frames to the extension through a CMIO "sink" stream. The user approves the extension once in System Settings. The app must live in /Applications. Needs the System Extension entitlement, a Developer ID signature and notarization. |
| Windows 11 | **`MFCreateVirtualCamera`** (Media Foundation, Windows 11 build 22000+) | No kernel driver. The app registers a custom media source (COM, C++ or Rust). Windows 10 would need the older DirectShow filter route. Skip that unless users ask. |
| Linux | **v4l2loopback** | Free kernel module from the distro's packages. The app writes frames to `/dev/videoN`. Secure Boot systems need the module signed (DKMS handles most cases). |

### Costs

| Item | Cost | Needed for |
|---|---|---|
| Apple Developer Program | **US$99 / year** | Signing and notarizing the macOS app and camera extension. Required, since unsigned system extensions won't load for normal users. |
| Windows code signing, Azure Artifact Signing (Basic) | **US$9.99 / month** (about $120/yr). Open to individuals in the US and Canada | Avoids SmartScreen "unknown publisher" warnings |
| Windows code signing, traditional OV certificate (alternative) | Roughly US$200–400 / year | Same purpose, if Azure isn't an option |
| Linux | Free | — |
| Tauri, Rust, Swift toolchains | Free | — |
| **Total to ship on Mac + Windows** | **About US$220 / year** | |

Time estimate for one developer: macOS camera extension 2–3 weeks (learning CMIO, entitlements and notarization is most of it), Windows virtual camera 2 weeks, Linux 2–3 days, Tauri shell and updater 1 week.

### When to build it

Only once the extension shows real demand, **and** users specifically ask for desktop Zoom or Teams. Signals to watch: extension installs, and feedback that mentions desktop apps.

## Done since the first plan

| Item | Status |
|---|---|
| **One-time pairing and phone lock** | Shipped (protocol v2). QR carries a one-time 256-bit key; phone and laptop prove it to each other before any video; first phone gets its own key and the code is burned. See README → Pairing and security |
| **No codes on shared screens** | Shipped. The extension's waiting card, present mode and the OBS view never show a code or QR |
| **Own signalling server** | Shipped. Durable Object per room speaking the PeerJS protocol at `/signal/`, origin-restricted, max 4 sockets per room |
| **TURN relay** (Cloudflare Realtime) | Built. Turns on once the `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` secrets are set. First 1,000 GB/month free, then US$0.05/GB |
| **Delete `phonecam/`** | Done. The old static version stays in git history |

## Other roadmap items

| Item | Why | Cost |
|---|---|---|
| **Real-meeting test pass** | Follow doc/release-checklist.md section 3 before submitting version 1.0.0 to the store | Free |
| **Ratings database** | Create the D1 database and apply `worker/schema.sql` (see README) | Free tier |
| **Rate limiting `/api/turn`** | Credentials are only handed to PhoneCam and the supported meeting sites, but a script could still ask for them. Add a per-address limit (Workers rate limiting binding or D1) if relay usage grows | Free |
| **Multi-camera** | Several phones as separate angles, for streamers using OBS | Free |
| **Firefox and Safari extension** | Both lack `MediaStreamTrackGenerator`; needs a canvas-based fallback | Free |

## Sources for costs

- Apple Developer Program fee: https://developer.apple.com/support/enrollment/
- Azure Artifact Signing pricing and eligibility: https://azure.microsoft.com/pricing/details/trusted-signing/ and https://devclass.com/2026/01/14/code-signing-windows-apps-may-be-easier-and-more-secure-with-new-azure-artifact-service/
- Cloudflare Realtime TURN pricing: https://developers.cloudflare.com/realtime/pricing/
- Chrome Web Store registration fee: https://developer.chrome.com/docs/webstore/register
