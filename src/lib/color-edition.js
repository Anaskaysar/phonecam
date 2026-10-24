import { useEffect, useState } from 'react'
import { readStorage, writeStorage } from './room.js'

/* Home page color edition. A new visit wears the next palette.
   Freeze keeps the page black and white. */

const MODE_KEY = 'pc.color.mode'
const INDEX_KEY = 'pc.color.index'
const SESSION_KEY = 'pc.color.seen'
const EVENT = 'phonecam:color'

export const EDITIONS = [
  {
    id: 'lime',
    name: 'Lime',
    bg: '#14210c',
    raise: '#243616',
    ink: '#f4f7ec',
    muted: '#c9d4b0',
    line: 'rgba(255, 255, 255, 0.16)',
    accent: '#dff25a',
    accentInk: '#161a04',
    glow: 'rgba(223, 242, 90, 0.45)'
  },
  {
    id: 'harbor',
    name: 'Harbor',
    bg: '#0b2744',
    raise: '#143656',
    ink: '#f2f7fb',
    muted: '#c5d6e6',
    line: 'rgba(255, 255, 255, 0.16)',
    accent: '#7cc4ff',
    accentInk: '#042033',
    glow: 'rgba(124, 196, 255, 0.5)'
  },
  {
    id: 'ember',
    name: 'Ember',
    bg: '#35140e',
    raise: '#4c2219',
    ink: '#fff6f2',
    muted: '#f0d0c6',
    line: 'rgba(255, 255, 255, 0.16)',
    accent: '#ff8f6e',
    accentInk: '#2b0e06',
    glow: 'rgba(255, 143, 110, 0.5)'
  },
  {
    id: 'iris',
    name: 'Iris',
    bg: '#241445',
    raise: '#38225f',
    ink: '#f7f3ff',
    muted: '#ddd4f4',
    line: 'rgba(255, 255, 255, 0.16)',
    accent: '#c4b5ff',
    accentInk: '#1a1033',
    glow: 'rgba(196, 181, 255, 0.5)'
  },
  {
    id: 'lagoon',
    name: 'Lagoon',
    bg: '#063028',
    raise: '#0e4638',
    ink: '#f1fbf7',
    muted: '#c6e6da',
    line: 'rgba(255, 255, 255, 0.16)',
    accent: '#5ee0b5',
    accentInk: '#04261a',
    glow: 'rgba(94, 224, 181, 0.48)'
  },
  {
    id: 'marigold',
    name: 'Marigold',
    bg: '#332608',
    raise: '#4a3810',
    ink: '#fff8ea',
    muted: '#f0e2c0',
    line: 'rgba(255, 255, 255, 0.16)',
    accent: '#f0c14b',
    accentInk: '#241a04',
    glow: 'rgba(240, 193, 75, 0.48)'
  },
  {
    id: 'blush',
    name: 'Blush',
    bg: '#3a1224',
    raise: '#541c34',
    ink: '#fff3f7',
    muted: '#f3d0de',
    line: 'rgba(255, 255, 255, 0.16)',
    accent: '#ff8fb8',
    accentInk: '#2b0a16',
    glow: 'rgba(255, 143, 184, 0.48)'
  },
  {
    id: 'glacier',
    name: 'Glacier',
    bg: '#0e3340',
    raise: '#164858',
    ink: '#f3fbfe',
    muted: '#d0eaf2',
    line: 'rgba(255, 255, 255, 0.16)',
    accent: '#9be7ff',
    accentInk: '#062028',
    glow: 'rgba(155, 231, 255, 0.48)'
  }
]

export const FROZEN = {
  id: 'frozen',
  name: 'Black & white',
  bg: '#0c0c0c',
  raise: '#1a1a1a',
  ink: '#f4f4f4',
  muted: '#a3a3a3',
  line: 'rgba(255, 255, 255, 0.16)',
  accent: '#f4f4f4',
  accentInk: '#141414',
  glow: 'rgba(255, 255, 255, 0.08)'
}

export function readColorMode() {
  return readStorage(MODE_KEY, 'edition') === 'frozen' ? 'frozen' : 'edition'
}

export function writeColorMode(mode) {
  writeStorage(MODE_KEY, mode === 'frozen' ? 'frozen' : 'edition')
}

export function readEditionIndex() {
  const raw = readStorage(INDEX_KEY, '')
  if (raw === '') return null
  const index = Number(raw)
  if (!Number.isInteger(index) || index < 0 || index >= EDITIONS.length) return null
  return index
}

export function writeEditionIndex(index) {
  writeStorage(INDEX_KEY, String(index))
}

function seenThisSession() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function rememberSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* Private mode can block storage. This visit still shows a color. */
  }
}

/** Palette index for this visit. A new session steps forward; a refresh stays put. */
export function editionIndexForVisit() {
  const stored = readEditionIndex()
  if (seenThisSession()) return stored ?? 0
  const index = stored == null ? 0 : (stored + 1) % EDITIONS.length
  writeEditionIndex(index)
  rememberSession()
  return index
}

export function advanceEdition(index) {
  const next = (Number(index) + 1) % EDITIONS.length
  writeEditionIndex(next)
  return next
}

export function paletteFor(mode, index) {
  if (mode === 'frozen') return FROZEN
  const edition = EDITIONS[index]
  return edition || EDITIONS[0]
}

export function bootColorEdition() {
  if (typeof window === 'undefined') {
    return { mode: 'edition', index: 0, edition: EDITIONS[0] }
  }
  const mode = readColorMode()
  const index = mode === 'frozen' ? (readEditionIndex() ?? 0) : editionIndexForVisit()
  return { mode, index, edition: paletteFor(mode, index) }
}

export function paletteStyle(edition) {
  return {
    '--ce-bg': edition.bg,
    '--ce-raise': edition.raise,
    '--ce-ink': edition.ink,
    '--ce-muted': edition.muted,
    '--ce-line': edition.line,
    '--ce-accent': edition.accent,
    '--ce-accent-ink': edition.accentInk,
    '--ce-glow': edition.glow
  }
}

export function useColorEdition() {
  const [state, setState] = useState(bootColorEdition)

  useEffect(() => {
    const onChange = (event) => setState(event.detail)
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])

  function commit(next) {
    setState(next)
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }))
  }

  function freeze() {
    writeColorMode('frozen')
    commit({ mode: 'frozen', index: state.index, edition: paletteFor('frozen', state.index) })
  }

  function unfreeze() {
    writeColorMode('edition')
    commit({ mode: 'edition', index: state.index, edition: paletteFor('edition', state.index) })
  }

  return { ...state, freeze, unfreeze }
}
