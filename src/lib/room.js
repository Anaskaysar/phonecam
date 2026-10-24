/* Small storage helpers. Rooms and keys live in pairing.js. */

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
