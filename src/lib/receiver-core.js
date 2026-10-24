import { Peer } from 'peerjs'
import { connectionOptions } from './connection.js'
import { check, isPhoneOf, newKey, nonce, prove, receiverPeerId, seal } from './pairing.js'

/*
  The laptop half of a PhoneCam connection, with no UI attached. The receiver
  page, OBS and the browser extension all use it.

  room: { roomId, pairKey, sessionKey } (see pairing.js). The object is kept up
  to date in place; onPaired(sessionKey) is called once a phone pairs, so the
  caller can save the new key.

  Status codes: connecting, waiting, live, dropped, reconnecting, in-use,
  network, failed, rejected.
*/
const AUTH_TIMEOUT = 10000

export function openRoom(room, { onStatus = () => {}, onStream = () => {}, onDrop = () => {}, onPaired = () => {} } = {}) {
  let closed = false
  let peer = null
  let current = null
  let control = null
  let trustedPeer = null
  let generation = 0
  let timer = 0

  const status = (code, text, state = 'wait') => {
    if (!closed) onStatus({ code, text, state, paired: Boolean(room.sessionKey) })
  }

  const dropped = () => {
    if (closed) return
    const call = current
    current = null
    if (call) {
      try { call.close() } catch { /* already closed */ }
    }
    onDrop()
    status('dropped', 'Phone disconnected. Waiting…')
  }

  const retry = (gen, delay, code, text) => {
    status(code, text)
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (!closed && gen === generation) connect()
    }, delay)
  }

  // A phone has opened a data channel. It must prove it holds our key before anything else.
  const authenticate = (conn) => {
    let done = false
    const ours = nonce()
    const give = setTimeout(() => {
      if (!done) {
        done = true
        try { conn.close() } catch { /* already closed */ }
      }
    }, AUTH_TIMEOUT)

    conn.on('open', () => {
      try { conn.send({ t: 'hello', v: 2, n: ours }) } catch { /* closed */ }
    })

    conn.on('data', async (message) => {
      if (done || !message || message.t !== 'auth' || typeof message.n !== 'string' || message.n.length > 64) return
      done = true
      clearTimeout(give)
      let key = null
      let sessionKey = null
      const pairKey = room.pairKey
      if (room.sessionKey && await check(room.sessionKey, 'phone', ours, message.n, message.p)) {
        key = room.sessionKey
      } else if (pairKey && await check(pairKey, 'phone', ours, message.n, message.p) && room.pairKey === pairKey) {
        // Claim the QR code in one synchronous step, so two phones can't both pair with it.
        key = pairKey
        sessionKey = newKey()
        room.sessionKey = sessionKey
        room.pairKey = null
        room.pairedAt = new Date().toISOString()
      }
      if (closed) return
      if (!key) {
        try { conn.send({ t: 'deny', reason: room.pairKey ? 'bad' : 'used' }) } catch { /* closed */ }
        setTimeout(() => { try { conn.close() } catch { /* already closed */ } }, 500)
        if (!current) status('rejected', 'A phone without the right code tried to connect. It was blocked.')
        return
      }

      const reply = { t: 'ok', p: await prove(key, 'laptop', message.n, ours) }
      if (sessionKey) {
        // The QR code is now used up. Only this phone gets the key for future sessions.
        reply.k = await seal(pairKey, sessionKey)
        await onPaired(sessionKey)
      }
      try { conn.send(reply) } catch { return }

      if (control && control !== conn) {
        try { control.close() } catch { /* already closed */ }
      }
      control = conn
      trustedPeer = conn.peer
      if (!current) status('waiting', 'Your phone is connecting…')
      conn.on('close', () => {
        if (control === conn) {
          control = null
          trustedPeer = null
        }
      })
    })
  }

  const connect = async () => {
    const gen = ++generation
    if (peer && !peer.destroyed) {
      const old = peer
      peer = null
      old.destroy()
    }
    status('connecting', 'Starting…')
    const options = await connectionOptions()
    if (closed || gen !== generation) return
    const next = new Peer(receiverPeerId(room.roomId), options)
    peer = next

    next.on('open', () => {
      if (gen === generation) status('waiting', room.sessionKey ? 'Waiting for your phone…' : 'Scan the code with your phone…')
    })

    next.on('connection', (conn) => {
      if (closed || gen !== generation) return
      if (!isPhoneOf(room.roomId, conn.peer)) {
        try { conn.close() } catch { /* already closed */ }
        return
      }
      authenticate(conn)
    })

    next.on('call', (incoming) => {
      if (closed || gen !== generation) return
      // Only the phone that just proved itself may send video.
      if (!trustedPeer || incoming.peer !== trustedPeer) {
        try { incoming.close() } catch { /* already closed */ }
        return
      }
      if (current) {
        try { current.close() } catch { /* already closed */ }
      }
      current = incoming
      incoming.answer()
      incoming.on('stream', (media) => {
        if (closed || gen !== generation || current !== incoming) return
        onStream(media)
        status('live', 'Live from the phone', 'live')
      })
      const pc = incoming.peerConnection
      if (pc) {
        pc.addEventListener('connectionstatechange', () => {
          if (closed || current !== incoming) return
          if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) dropped()
        })
      }
      incoming.on('close', () => {
        if (current === incoming) dropped()
      })
    })

    next.on('disconnected', () => {
      if (closed || gen !== generation) return
      status('reconnecting', 'Reconnecting…')
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (!closed && gen === generation && !next.destroyed) next.reconnect()
      }, 2000)
    })

    next.on('error', (error) => {
      if (closed || gen !== generation) return
      if (error.type === 'unavailable-id') {
        retry(gen, 5000, 'in-use', 'This PhoneCam is open somewhere else, like another tab. Close the other one.')
        return
      }
      if (error.type === 'network' || error.type === 'server-error' || error.type === 'socket-error' || error.type === 'socket-closed') {
        retry(gen, 4000, 'network', 'Network problem. Retrying…')
        return
      }
      if (error.type === 'peer-unavailable') return
      status('failed', 'Could not start PhoneCam. Retrying…')
      retry(gen, 6000, 'failed', 'Could not start PhoneCam. Retrying…')
    })
  }

  connect()

  return function close() {
    closed = true
    generation += 1
    clearTimeout(timer)
    try { current?.close() } catch { /* already closed */ }
    try { control?.close() } catch { /* already closed */ }
    current = null
    control = null
    trustedPeer = null
    if (peer && !peer.destroyed) peer.destroy()
    peer = null
  }
}
