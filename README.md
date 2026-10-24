# PhoneCam

Use the phone you already own as a webcam on a laptop. PhoneCam is a React app you can install on the phone. The picture goes straight from the phone to the laptop. OBS Virtual Camera then makes it available to Zoom, Meet, Teams, and PowerPoint.

## Run it

```bash
npm install
npm run dev
```

Open the laptop page at `http://localhost:5173/#/receiver`. Refresh it, then scan the QR code. That code uses the computer’s Wi-Fi address, such as `http://192.168.x.x:5173`, because a phone cannot open `127.0.0.1`. Keep the phone on the same Wi-Fi. The camera on an iPhone still needs an https address, so for a real session use the deployed site.

## Publish

The app is a static site after the build.

```bash
npm run build
```

Upload the `dist` folder. For a GitHub project site such as `https://anaskaysar.github.io/phonecam/`, build with the project path:

```bash
npm run build:pages
```

Then publish the `dist` folder from the `main` branch root, or set GitHub Pages to deploy that folder. The site must be https. iPhone will not open the camera on a plain http address.

Old `camera.html` and `receiver.html` links still open the new app.

## Each session

1. On the laptop, open `#/receiver`. Copy the OBS link. Leave that page open in only one place.
2. OBS → Sources → **+** → **Browser**. Paste the link. Use **1280 × 720** for 720p, or **1920 × 1080** for 1080p.
3. Click **Start Virtual Camera**.
4. On the phone, scan the QR code or open `#/camera`, enter the room code, and tap **Start streaming**. In Safari: Share → **Add to Home Screen**. The icon opens the camera.
5. In the meeting app, choose **OBS Virtual Camera**.

## Receiver options

The chips on the receiver write these into the OBS link.

| Option | Effect |
| --- | --- |
| `mirror=1` | Mirror the picture |
| `fit=cover` | Fill the frame and crop |
| `audio=1` | Play the phone mic. Also set Mic to “Send the phone mic” on the phone |

## Notes

- Leave PhoneCam open with the screen on. iOS pauses the camera in the background. A stand and a charger help.
- Same Wi-Fi is the reliable setup. The free PeerJS service is only the handshake. The video does not go through that server, and there is no paid relay, so some networks will fail to connect.
- The room code is the only lock. Use the generated one.
