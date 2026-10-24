# Chrome Web Store listing: PhoneCam

Copy these into the developer dashboard. Images are in this folder.

## Package
- File: `store/phonecam-extension-1.0.0.zip` (made by `npm run build`; `manifest.json` is at the root of the zip)

## Store listing tab
- **Name:** PhoneCam (from the manifest)
- **Summary** (from the manifest): Use your phone as a camera in Google Meet, Teams, Zoom and other browser meetings. Nothing to install on the phone.
- **Category:** Communication
- **Language:** English
- **Store icon:** `icons` in the zip (`icon-128.png`), also upload `store/icon-128.png` if asked
- **Screenshots (1280×800):** `screenshot-1.png`, `screenshot-2.png`, `screenshot-3.png`
- **Small promo tile (440×280):** `promo-440x280.png`
- **Homepage URL:** https://phonecam.app
- **Support URL:** https://github.com/Anaskaysar/phonecam/issues

### Description

PhoneCam turns the phone you already own into a camera for browser meetings, with no app on the phone.

Open the PhoneCam extension, scan its QR code with your phone and tap Start streaming. Then choose “PhoneCam” as your camera in Google Meet, Microsoft Teams, Zoom, Discord, Whereby, Jitsi Meet or Webex, the same way you would pick any webcam.

Why PhoneCam
• Nothing to install on the phone. It runs in Safari or Chrome on iPhone and Android.
• Shows up as a normal camera. No OBS, no virtual camera driver, no extra desktop app.
• Private by design. Each QR code pairs one phone, once, and only that phone can connect afterwards. The video goes directly from your phone to your computer over an encrypted peer-to-peer connection. It never passes through a PhoneCam server (on strict networks it may use Cloudflare’s relay, still encrypted), and nothing is recorded or tracked.
• Stays steady. If the phone locks or loses Wi-Fi, the meeting shows a waiting card and picks the picture back up on its own, without reselecting the camera.
• Works on Mac, Windows, Linux and ChromeOS, in Chrome, Edge, Brave and Arc.

How to use it
1. Click the PhoneCam icon in the toolbar.
2. Scan the QR code with your phone and tap Start streaming. Keep the PhoneCam screen open on the phone. Next time, just open PhoneCam on the phone and tap Start.
3. In your meeting’s camera settings, choose PhoneCam.

Tips
• Keep the phone and the computer on the same Wi-Fi for the most reliable connection.
• Use a phone stand and a charger for long meetings.
• Check the camera any time at https://phonecam.app/#/check

PhoneCam works in meetings that run in the browser. For desktop apps like the Zoom or Teams app, use the “Share a tab” or OBS options at https://phonecam.app.

## Privacy practices tab
- **Single purpose:** Adds the user’s phone camera to the camera list in browser-based video meetings, as a camera named “PhoneCam”, and delivers the phone’s video when the user selects it.
- **Permission justification, `storage`:** Saves the pairing keys locally so the user's phone can reconnect between meetings without scanning again.
- **Host permission justification (content scripts on meet.google.com, teams.microsoft.com, teams.live.com, teams.cloud.microsoft, zoom.us, discord.com, whereby.com, meet.jit.si, webex.com, phonecam.app):** On these meeting sites the extension adds the PhoneCam device to navigator.mediaDevices so it appears in the site’s camera list, and supplies the phone’s video only when the user selects PhoneCam. It does not read, change or send the content of these pages. phonecam.app is included for the extension’s self-test page.
- **Remote code:** No, I am not using remote code. All JavaScript is bundled in the package. The extension connects to the PhoneCam signalling service (wss://phonecam.app/signal/) and fetches relay settings from https://phonecam.app/api/turn; neither returns code.
- **Data usage:** Collects none of the listed data types. The camera picture goes from the user’s phone to the user’s own computer and is handed to the meeting site the user chose. The developer never receives it.
- **Certifications:** tick all three (no selling to third parties, no use for unrelated purposes, no use for creditworthiness or lending).
- **Privacy policy URL:** https://phonecam.app/privacy.html

## Distribution tab
- Free, Public, all regions.
