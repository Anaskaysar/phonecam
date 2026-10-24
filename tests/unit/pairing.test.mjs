// Unit tests for the pairing protocol (src/lib/pairing.js). Run: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PEER_PREFIX, check, fromB64url, isPhoneOf, newKey, newRoomId, newRoomState, nonce,
  pairToken, parsePairToken, phonePeerId, prove, receiverPeerId, seal, toB64url, unseal,
  validKey, validRoomId, validRoomState
} from '../../src/lib/pairing.js'

test('room ids are 16 base32 characters and random', () => {
  const ids = new Set()
  for (let i = 0; i < 200; i += 1) {
    const id = newRoomId()
    assert.match(id, /^[a-z2-7]{16}$/)
    ids.add(id)
  }
  assert.equal(ids.size, 200)
})

test('keys are 256-bit base64url and random', () => {
  const key = newKey()
  assert.ok(validKey(key))
  assert.equal(fromB64url(key).length, 32)
  assert.notEqual(newKey(), key)
})

test('base64url round-trips any bytes', () => {
  const bytes = Uint8Array.from({ length: 300 }, (_, i) => (i * 37) & 255)
  assert.deepEqual(fromB64url(toB64url(bytes)), bytes)
  assert.doesNotMatch(toB64url(bytes), /[+/=]/)
})

test('peer ids carry the protocol version and room', () => {
  const room = newRoomId()
  assert.equal(receiverPeerId(room), `${PEER_PREFIX}${room}`)
  assert.match(PEER_PREFIX, /^phonecam-v2-$/)
  const phone = phonePeerId(room)
  assert.ok(isPhoneOf(room, phone))
  assert.ok(!isPhoneOf(room, receiverPeerId(room)), 'the laptop id is not a phone id')
  assert.ok(!isPhoneOf(newRoomId(), phone), 'a phone of one room is not a phone of another')
  assert.ok(!isPhoneOf(room, `${phone}x`))
})

test('pair tokens parse back, and junk is rejected', () => {
  const room = newRoomId()
  const key = newKey()
  assert.deepEqual(parsePairToken(pairToken(room, key)), { roomId: room, key })
  for (const bad of ['', 'abc', `${room}`, `${room}.short`, `${room}.${key}.extra`, `UPPERCASEROOMIDX.${key}`, null, 42]) {
    assert.equal(parsePairToken(bad), null, `should reject ${bad}`)
  }
})

test('proofs check out only with the same key, role and nonces', async () => {
  const key = newKey()
  const a = nonce()
  const b = nonce()
  const proof = await prove(key, 'phone', a, b)
  assert.ok(await check(key, 'phone', a, b, proof))
  assert.ok(!(await check(newKey(), 'phone', a, b, proof)), 'wrong key')
  assert.ok(!(await check(key, 'laptop', a, b, proof)), 'a phone proof is not a laptop proof')
  assert.ok(!(await check(key, 'phone', b, a, proof)), 'nonces in the wrong order')
  assert.ok(!(await check(key, 'phone', a, nonce(), proof)), 'replayed with a new nonce')
  assert.ok(!(await check(key, 'phone', a, b, 'A'.repeat(43))), 'forged proof')
  assert.ok(!(await check(key, 'phone', a, b, 'x'.repeat(500))), 'oversized proof')
  assert.ok(!(await check('not-a-key', 'phone', a, b, proof)), 'invalid key')
})

test('the session key is sealed with the pairing key', async () => {
  const pairKey = newKey()
  const sessionKey = newKey()
  const sealed = await seal(pairKey, sessionKey)
  assert.ok(!sealed.includes(sessionKey), 'the sealed form does not contain the key')
  assert.equal(await unseal(pairKey, sealed), sessionKey)
  await assert.rejects(unseal(newKey(), sealed), 'another key cannot open it')
  const [iv, data] = sealed.split('.')
  const flipped = data[0] === 'A' ? `B${data.slice(1)}` : `A${data.slice(1)}`
  await assert.rejects(unseal(pairKey, `${iv}.${flipped}`), 'tampering is detected')
})

test('a fresh laptop room has a pairing key and no session key', () => {
  const state = newRoomState()
  assert.ok(validRoomId(state.roomId))
  assert.ok(validKey(state.pairKey))
  assert.equal(state.sessionKey, null)
  assert.ok(validRoomState(state))
  assert.ok(validRoomState({ ...state, pairKey: null, sessionKey: newKey() }), 'paired room')
  assert.ok(!validRoomState({ ...state, pairKey: null, sessionKey: null }), 'a room with no keys is invalid')
  assert.ok(!validRoomState({ ...state, roomId: 'nope' }))
})
