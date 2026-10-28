import { Peer } from 'peerjs'
import { connectionOptions, onPeerDown } from './connection.js'
import { check, nonce, phonePeerId, prove, receiverPeerId, unseal, validKey } from './pairing.js'

/*
  The phone half of a PhoneCam connection.

  1. Open a data channel to the laptop's room.
  2. Prove we hold the key, and check the laptop proves it too. If the laptop
     can't, it isn't the one that made the QR code, so no video is sent.
  3. On first pairing the laptop sends a new key just for this phone; onKey
     saves it.
  4. Call the laptop with the camera stream. Retry if anything drops.

  Status codes: connecting, looking, live, lost, network, denied, imposter.
*/
const STEP_TIMEOUT = 10000

export function startPhoneLink({ roomId, key, getStream, onStatus = () => {}, onKey = () => {}, onDenied = () => {}, onLive = () => {} }) {
  let stopped = false
  let peer = null
  let conn = null
  let call = null
  let retryTimer = 0
  let currentKey = key
  const laptop = receiverPeerId(roomId)

  const status = (code, text, state = 'wait') => {
    if (!stopped) onStatus({ code, text, state })
  }

  const clearLink = () => {
    const oldCall = call
    const oldConn = conn
    call = null
    conn = null
    try { oldCall?.close() } catch { /* already closed */ }
    try { oldConn?.close() } catch { /* already closed */ }
  }

  const scheduleRetry = (delay = 3000) => {
    clearTimeout(retryTimer)
    clearLink()
    if (stopped) return
    retryTimer = setTimeout(() => handshake(), delay)
  }

  const placeCall = () => {
    const media = getStream()
    if (stopped || !peer || peer.destroyed || !media) return
    const next = peer.call(laptop, media)
    if (!next) {
      scheduleRetry()
      return
    }
    call = next
    const pc = next.peerConnection
    if (pc) {
      pc.addEventListener('connectionstatechange', () => {
        if (stopped || call !== next) return
        if (pc.connectionState === 'connected') {
          status('live', 'Live on your laptop', 'live')
          onLive(pc)
        }
      })
      onPeerDown(pc, () => {
        if (stopped || call !== next) return
        status('lost', 'Connection lost. Retrying…')
        scheduleRetry()
      })
    }
    next.on('close', () => {
      if (!stopped && call === next) {
        status('lost', 'Laptop disconnected. Retrying…')
        scheduleRetry()
      }
    })
    next.on('error', () => {
      if (!stopped && call === next) scheduleRetry()
    })
  }

  const handshake = () => {
    if (stopped || !peer || peer.destroyed) return
    clearLink()
    status('looking', 'Looking for your laptop…')
    const ours = nonce()
    const channel = peer.connect(laptop, { reliable: true, serialization: 'json', metadata: { v: 2 } })
    if (!channel) {
      scheduleRetry()
      return
    }
    conn = channel
    let theirs = null
    let finished = false
    const give = setTimeout(() => {
      if (!finished && conn === channel) scheduleRetry()
    }, STEP_TIMEOUT)

    channel.on('data', async (message) => {
      if (stopped || conn !== channel || !message || typeof message !== 'object') return
      if (message.t === 'hello' && !theirs && typeof message.n === 'string' && message.n.length <= 64) {
        theirs = message.n
        try {
          channel.send({ t: 'auth', n: ours, p: await prove(currentKey, 'phone', theirs, ours) })
        } catch {
          scheduleRetry()
        }
        return
      }
      if (message.t === 'deny') {
        finished = true
        clearTimeout(give)
        stop()
        onDenied(message.reason === 'used' ? 'used' : 'bad')
        return
      }
      if (message.t === 'ok' && theirs && !finished) {
        finished = true
        clearTimeout(give)
        if (!(await check(currentKey, 'laptop', ours, theirs, message.p))) {
          // Someone else is holding the room. Don't send them the camera.
          status('imposter', 'This laptop could not prove it made your code. Not sending video.')
          scheduleRetry(8000)
          return
        }
        if (message.k) {
          try {
            const fresh = await unseal(currentKey, message.k)
            if (!validKey(fresh)) throw new Error('bad key')
            currentKey = fresh
            await onKey(fresh)
          } catch {
            scheduleRetry()
            return
          }
        }
        if (stopped || conn !== channel) return
        status('connecting', 'Connecting the camera…')
        placeCall()
      }
    })

    channel.on('close', () => {
      if (!stopped && conn === channel) {
        if (call) status('lost', 'Laptop disconnected. Retrying…')
        scheduleRetry()
      }
    })
    channel.on('error', () => {
      if (!stopped && conn === channel) scheduleRetry()
    })
  }

  const start = async () => {
    status('connecting', 'Connecting…')
    const options = await connectionOptions()
    if (stopped) return
    peer = new Peer(phonePeerId(roomId), options)
    peer.on('open', () => handshake())
    peer.on('error', (error) => {
      if (stopped) return
      if (error.type === 'peer-unavailable') {
        status('looking', 'Laptop page is not open yet. Retrying…')
        scheduleRetry()
        return
      }
      if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(error.type)) {
        status('network', 'Network problem. Retrying…')
        setTimeout(() => {
          if (!stopped && peer && !peer.destroyed && peer.disconnected) peer.reconnect()
        }, 3000)
        return
      }
      if (error.type === 'unavailable-id') {
        // Very unlikely: our random id was taken. Start over with a new one.
        const old = peer
        peer = null
        old.destroy()
        setTimeout(() => { if (!stopped) start() }, 1000)
        return
      }
      status('network', 'Could not connect. Retrying…')
      scheduleRetry(4000)
    })
    peer.on('disconnected', () => {
      if (stopped) return
      setTimeout(() => {
        if (!stopped && peer && !peer.destroyed && peer.disconnected) peer.reconnect()
      }, 2000)
    })
  }

  function stop() {
    stopped = true
    clearTimeout(retryTimer)
    clearLink()
    if (peer && !peer.destroyed) peer.destroy()
    peer = null
  }

  start()

  return {
    stop,
    peerConnection: () => call?.peerConnection || null
  }
}
