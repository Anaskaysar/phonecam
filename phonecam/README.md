# PhoneCam

Use your iPhone as a webcam on Windows (or Mac) — a free PWA, no App Store, no Apple developer account.

**How it works:** the iPhone PWA captures the camera with `getUserMedia` and sends it peer-to-peer over WebRTC (PeerJS for the initial handshake). The laptop opens `receiver.html` inside OBS, and OBS Virtual Camera exposes it to Zoom, Meet, Teams and PowerPoint Cameo.

## 1. Host it (free, HTTPS)

iOS only allows camera access over HTTPS, so host it rather than opening the files locally.

**GitHub Pages**
1. Create a repo (e.g. `phonecam`) and upload every file here, keeping the `icons/` folder.
2. Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / root → Save.
3. After a minute it's live at `https://anaskaysar.github.io/phonecam/`.

## 2. Laptop (one-time)

1. Open `https://…/phonecam/receiver.html`. It shows a **room code** and an **OBS URL**.
2. Install OBS Studio. Sources → **+** → **Browser** → paste the OBS URL, width 1280, height 720.
3. Click **Start Virtual Camera**.

## 3. iPhone (one-time)

1. Open `https://…/phonecam/camera.html` in Safari → Share → **Add to Home Screen**.
2. Open PhoneCam from the home screen, allow the camera, type the room code. It's remembered.

## Every day

Open OBS (virtual camera on) → open PhoneCam on the iPhone → **Start streaming** → pick **OBS Virtual Camera** in Zoom / Meet / PowerPoint.

## Receiver URL options

| Option | Effect |
|---|---|
| `&mirror=1` | Mirror the image (selfie view) |
| `&fit=cover` | Fill the frame and crop instead of letterboxing |
| `&audio=1` | Play the phone's mic (also set Mic → "Send phone mic" on the phone) |

## Notes

- Keep PhoneCam open with the screen on; iOS pauses the camera in the background. A tripod + charger helps.
- Works best with phone and laptop on the same Wi‑Fi. Across different networks some connections may fail without a TURN server.
- The room code is the only lock — use the generated random one, not something guessable.
- PeerJS's free public server is only used for the handshake; the video goes directly between devices.
