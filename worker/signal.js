/*
  PhoneCam signalling server.

  Speaks the PeerJS server protocol, so the PeerJS client works unchanged:
    client connects   wss://phonecam.app/signal/peerjs?key=peerjs&id=<id>&token=<token>
    server replies    { type: 'OPEN' } or { type: 'ID-TAKEN' }
    client sends      { type: 'OFFER' | 'ANSWER' | 'CANDIDATE' | 'LEAVE', dst, payload }
    server forwards   { type, src, dst, payload } to dst, or { type: 'EXPIRE', src: dst } back if dst is offline

  One Durable Object per room. Peers can only reach peers in their own room,
  and a room holds at most a few sockets. WebSocket hibernation keeps idle
  rooms free, and heartbeats are answered without waking the object.
*/

const ID_RE = /^phonecam-v2-([a-z2-7]{16})(?:-p[a-z2-7]{8})?$/
const TOKEN_RE = /^[a-z0-9]{1,32}$/
const MAX_SOCKETS = 4
const MAX_MESSAGE = 32 * 1024
const RELAYED = new Set(['OFFER', 'ANSWER', 'CANDIDATE', 'LEAVE'])

export function roomOf(id) {
  const match = ID_RE.exec(id || '')
  return match ? match[1] : null
}

export class SignalRoom {
  constructor(state) {
    this.state = state
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"type":"HEARTBEAT"}', '{"type":"HEARTBEAT-ACK"}'))
  }

  async fetch(request) {
    if (request.headers.get('upgrade') !== 'websocket') return new Response('Expected a WebSocket.', { status: 426 })
    const url = new URL(request.url)
    const id = url.searchParams.get('id') || ''
    const token = url.searchParams.get('token') || ''
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    const reject = (message) => {
      server.accept()
      server.send(JSON.stringify(message))
      server.close(1008, message.type)
      return new Response(null, { status: 101, webSocket: client })
    }

    if (!roomOf(id) || !TOKEN_RE.test(token)) {
      return reject({ type: 'ERROR', payload: { msg: 'Invalid id or token' } })
    }

    for (const socket of this.state.getWebSockets(id)) {
      const owner = socket.deserializeAttachment()
      if (owner?.token !== token) return reject({ type: 'ID-TAKEN', payload: { msg: 'ID is taken' } })
      // Same peer reconnecting: replace its old socket.
      try { socket.close(1000, 'Replaced') } catch { /* already closed */ }
    }

    if (this.state.getWebSockets().length >= MAX_SOCKETS) {
      return reject({ type: 'ERROR', payload: { msg: 'Room is full' } })
    }

    this.state.acceptWebSocket(server, [id])
    server.serializeAttachment({ id, token })
    server.send(JSON.stringify({ type: 'OPEN' }))
    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketMessage(socket, raw) {
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE) return
    let message
    try {
      message = JSON.parse(raw)
    } catch {
      return
    }
    if (!message || !RELAYED.has(message.type)) return
    const owner = socket.deserializeAttachment()
    const dst = String(message.dst || '')
    if (!owner || roomOf(dst) !== roomOf(owner.id) || dst === owner.id) return

    const targets = this.state.getWebSockets(dst)
    if (!targets.length) {
      if (message.type === 'OFFER') socket.send(JSON.stringify({ type: 'EXPIRE', src: dst, dst: owner.id }))
      return
    }
    const out = JSON.stringify({ type: message.type, src: owner.id, dst, payload: message.payload })
    for (const target of targets) {
      try { target.send(out) } catch { /* the target just left */ }
    }
  }

  webSocketClose(socket, code) {
    try { socket.close(code === 1005 ? 1000 : code, 'Closed') } catch { /* already closed */ }
  }

  webSocketError(socket) {
    try { socket.close(1011, 'Error') } catch { /* already closed */ }
  }
}
