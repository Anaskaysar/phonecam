/*
  PhoneCam pairing, protocol version 2.

  A laptop side (receiver page, OBS, or the extension) owns a room:
    roomId     16 random base32 characters. Part of the signalling address.
    pairKey    256-bit secret, only in the QR code. Works once.
    sessionKey 256-bit secret the laptop hands the first phone that proves it
               knows pairKey. From then on only that phone can connect.

  The QR link puts roomId and pairKey after the # so they never reach a server.

  Over the encrypted WebRTC data channel, both sides prove they hold the key
  before any video is sent (HMAC-SHA-256 over fresh nonces from both sides):
    laptop -> phone   { t: 'hello', v: 2, n: nonceL }
    phone  -> laptop  { t: 'auth', n: nonceP, p: HMAC(key, phone|nonceL|nonceP) }
    laptop -> phone   { t: 'ok', p: HMAC(key, laptop|nonceP|nonceL), k?: sealed sessionKey }
                   or { t: 'deny', reason: 'used' | 'bad' }
  The phone only calls once the laptop's proof checks out, so a stranger who
  grabs the room first cannot receive the camera. The laptop only answers a
  call from the phone that passed, so a stranger cannot push video in.
*/

export const PROTOCOL = 2
export const PEER_PREFIX = 'phonecam-v2-'
const ROOM_RE = /^[a-z2-7]{16}$/
const KEY_RE = /^[A-Za-z0-9_-]{43}$/
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'

export function randomBytes(count) {
  const bytes = new Uint8Array(count)
  crypto.getRandomValues(bytes)
  return bytes
}

export function toB64url(bytes) {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromB64url(value) {
  const base = value.replace(/-/g, '+').replace(/_/g, '/')
  const text = atob(base + '='.repeat((4 - (base.length % 4)) % 4))
  return Uint8Array.from(text, (char) => char.charCodeAt(0))
}

export function newRoomId() {
  return [...randomBytes(16)].map((byte) => ALPHABET[byte & 31]).join('')
}

export function newKey() {
  return toB64url(randomBytes(32))
}

export function nonce() {
  return toB64url(randomBytes(16))
}

export const validRoomId = (value) => typeof value === 'string' && ROOM_RE.test(value)
export const validKey = (value) => typeof value === 'string' && KEY_RE.test(value)

export function receiverPeerId(roomId) {
  return `${PEER_PREFIX}${roomId}`
}

export function phonePeerId(roomId) {
  return `${PEER_PREFIX}${roomId}-p${[...randomBytes(8)].map((byte) => ALPHABET[byte & 31]).join('')}`
}

export function isPhoneOf(roomId, peerId) {
  return typeof peerId === 'string' && new RegExp(`^${PEER_PREFIX}${roomId}-p[a-z2-7]{8}$`).test(peerId)
}

/* "roomId.pairKey", the value of ?pair= in the QR link. */
export function pairToken(roomId, key) {
  return `${roomId}.${key}`
}

export function parsePairToken(value) {
  if (typeof value !== 'string') return null
  const [roomId, key, extra] = value.trim().split('.')
  if (extra !== undefined || !validRoomId(roomId) || !validKey(key)) return null
  return { roomId, key }
}

const encoder = new TextEncoder()

async function hmacKey(key) {
  return crypto.subtle.importKey('raw', fromB64url(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

function proofInput(role, first, second) {
  return encoder.encode(`phonecam-v${PROTOCOL}|${role}|${first}|${second}`)
}

export async function prove(key, role, first, second) {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(key), proofInput(role, first, second))
  return toB64url(new Uint8Array(signature))
}

export async function check(key, role, first, second, proof) {
  if (!validKey(key) || typeof proof !== 'string' || proof.length > 64) return false
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(key), fromB64url(proof), proofInput(role, first, second))
  } catch {
    return false
  }
}

async function sealKey(key) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`phonecam-v${PROTOCOL}|seal|${key}`))
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/* Encrypts the new session key with the pairing key, so even the signalling server can't learn it. */
export async function seal(key, text) {
  const iv = randomBytes(12)
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sealKey(key), encoder.encode(text))
  return `${toB64url(iv)}.${toB64url(new Uint8Array(data))}`
}

export async function unseal(key, sealed) {
  const [iv, data] = String(sealed).split('.')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(iv) }, await sealKey(key), fromB64url(data))
  return new TextDecoder().decode(plain)
}

/* ── Phone side: remembered laptops ─────────────────────────────────────── */

const PHONE_KEY = 'pc.pairings.v2'

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key))
    return value ?? fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Private mode can block storage. Pairing then lasts for this visit only. */
  }
}

export function loadPairings() {
  const list = readJson(PHONE_KEY, [])
  return Array.isArray(list) ? list.filter((item) => item && validRoomId(item.roomId) && validKey(item.key)) : []
}

export function savePairing(entry) {
  const list = loadPairings().filter((item) => item.roomId !== entry.roomId)
  const next = [{ ...entry, used: Date.now() }, ...list].slice(0, 5)
  writeJson(PHONE_KEY, next)
  return next
}

export function forgetPairing(roomId) {
  const next = loadPairings().filter((item) => item.roomId !== roomId)
  writeJson(PHONE_KEY, next)
  return next
}

/* ── Laptop side: a room and its keys ───────────────────────────────────── */

export function newRoomState() {
  return { v: PROTOCOL, roomId: newRoomId(), pairKey: newKey(), sessionKey: null, pairedAt: null }
}

export function validRoomState(state) {
  return Boolean(state) && validRoomId(state.roomId) && (validKey(state.pairKey) || validKey(state.sessionKey))
}

export function loadRoomState(storageKey) {
  const state = readJson(storageKey, null)
  return validRoomState(state) ? state : null
}

export function saveRoomState(storageKey, state) {
  writeJson(storageKey, state)
}
