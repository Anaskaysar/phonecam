export const ROOM_PREFIX = 'phonecam-v1-'

const WORDS = [
  'amber', 'birch', 'cedar', 'delta', 'ember', 'frost', 'grove', 'harbor',
  'iris', 'juniper', 'kite', 'lumen', 'maple', 'nova', 'orbit', 'pine',
  'quartz', 'river', 'sierra', 'tundra', 'umber', 'vale', 'willow', 'zephyr'
]

export function cleanRoom(value) {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
}

function randomIndex(size) {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0] % size
}

export function randomCode() {
  const word = () => WORDS[randomIndex(WORDS.length)]
  return `${word()}-${word()}-${100 + randomIndex(900)}`
}

export function readStorage(key, fallback = '') {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* Private mode can block storage. The page still works for this visit. */
  }
}
