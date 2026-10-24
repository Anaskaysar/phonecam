export function captureConstraints(quality, facing, micOn) {
  const height = Number(quality)
  const width = Math.round((height * 16) / 9)
  return {
    video: {
      facingMode: { ideal: facing },
      width: { ideal: width },
      height: { ideal: height },
      frameRate: { ideal: 30, max: 30 }
    },
    audio: micOn ? { echoCancellation: true, noiseSuppression: true } : false
  }
}

export async function tuneBitrate(peerConnection, quality) {
  const height = Number(quality)
  const maxBitrate = height >= 1080 ? 6_000_000 : height >= 720 ? 3_500_000 : 1_500_000
  await Promise.all(peerConnection.getSenders().map(async (sender) => {
    if (!sender.track || sender.track.kind !== 'video') return
    const params = sender.getParameters()
    if (!params.encodings || !params.encodings.length) params.encodings = [{}]
    params.encodings[0].maxBitrate = maxBitrate
    params.encodings[0].maxFramerate = 30
    params.degradationPreference = 'maintain-resolution'
    try {
      await sender.setParameters(params)
    } catch {
      /* The browser can reject a bitrate cap before the sender is fully live. */
    }
  }))
}

export function cameraMessage(error) {
  const name = error?.name
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera blocked. Allow camera access, then tap Start streaming.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device.'
  }
  if (name === 'NotReadableError') {
    return 'The camera is in use by another app.'
  }
  if (name === 'SecurityError') {
    return 'Open PhoneCam on an https address to use the camera.'
  }
  return 'Could not open the camera.'
}
