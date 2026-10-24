import { useEffect, useState } from 'react'
import { readStorage, writeStorage } from './room.js'

/*
  A few accent colours people can pick. Each one sets --accent (buttons, the
  logo, highlights) and --accent-ink (text drawn on top of the accent).
  The choice is saved on this device only.
*/
export const THEMES = [
  { id: 'lime', name: 'Lime', accent: '#dff25a', ink: '#161a04' },
  { id: 'sky', name: 'Sky', accent: '#7cc4ff', ink: '#04213b' },
  { id: 'coral', name: 'Coral', accent: '#ff8f6e', ink: '#2b0c03' },
  { id: 'violet', name: 'Violet', accent: '#b8a3ff', ink: '#170b38' },
  { id: 'mint', name: 'Mint', accent: '#6fe3b4', ink: '#03261a' }
]

const KEY = 'pc.theme'
const EVENT = 'phonecam:theme'

export function findTheme(id) {
  return THEMES.find((theme) => theme.id === id) || THEMES[0]
}

export function applyTheme(id) {
  const theme = findTheme(id)
  const root = document.documentElement
  root.style.setProperty('--accent', theme.accent)
  root.style.setProperty('--accent-ink', theme.ink)
  root.dataset.theme = theme.id
  return theme.id
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => findTheme(readStorage(KEY, 'lime')).id)

  useEffect(() => {
    const onChange = (event) => setThemeState(event.detail)
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])

  function setTheme(id) {
    const next = applyTheme(id)
    writeStorage(KEY, next)
    setThemeState(next)
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }))
  }

  return [theme, setTheme]
}
