import { useEffect, useState } from 'react'

export function platform() {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent || ''
  if (/android/i.test(ua)) return 'android'
  // iPadOS reports itself as a Mac, so also check for touch.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  return 'other'
}

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

/*
  Chrome on Android (and desktop) fires beforeinstallprompt when the app can be
  installed. Holding on to it lets us show our own Install button.
*/
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(null)

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault()
      setPrompt(event)
    }
    const onInstalled = () => setPrompt(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!prompt) return
    prompt.prompt()
    await prompt.userChoice.catch(() => {})
    setPrompt(null)
  }

  return { canInstall: Boolean(prompt), install }
}

/* One line telling people how to add PhoneCam to the home screen on their phone. */
export function installHint(os) {
  if (os === 'ios') return 'On iPhone: open this page in Safari, tap Share, then Add to Home Screen. The icon opens the camera.'
  if (os === 'android') return 'On Android: in Chrome, tap the ⋮ menu, then Add to Home screen or Install app. The icon opens the camera.'
  return ''
}
