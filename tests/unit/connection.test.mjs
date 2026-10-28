import { test } from 'node:test'
import assert from 'node:assert/strict'
import { onPeerDown } from '../../src/lib/connection.js'

function fakePc() {
  let listener = null
  return {
    connectionState: 'new',
    addEventListener(type, fn) {
      assert.equal(type, 'connectionstatechange')
      listener = fn
    },
    emit(state) {
      this.connectionState = state
      listener()
    }
  }
}

test('a brief disconnect does not drop the call if it recovers', async () => {
  const pc = fakePc()
  let lost = 0
  onPeerDown(pc, () => { lost += 1 }, 40)
  pc.emit('disconnected')
  pc.emit('connected')
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert.equal(lost, 0)
})

test('a disconnect that never recovers drops the call after the grace period', async () => {
  const pc = fakePc()
  let lost = 0
  onPeerDown(pc, () => { lost += 1 }, 40)
  pc.emit('disconnected')
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(lost, 0)
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(lost, 1)
})

test('failed drops the call immediately', () => {
  const pc = fakePc()
  let lost = 0
  onPeerDown(pc, () => { lost += 1 }, 40)
  pc.emit('failed')
  assert.equal(lost, 1)
})
