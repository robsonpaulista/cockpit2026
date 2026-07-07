'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { SPLASH_SESSION_KEY } from '@/lib/splash-screen-config'

function readShown(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(SPLASH_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('storage', cb)
  return () => window.removeEventListener('storage', cb)
}

export function useSplashScreenSession(forceShow = false) {
  const shown = useSyncExternalStore(subscribe, readShown, () => false)

  const markShown = useCallback(() => {
    try {
      sessionStorage.setItem(SPLASH_SESSION_KEY, '1')
    } catch {
      /* ignore quota / private mode */
    }
  }, [])

  const shouldShow = forceShow || !shown

  return { shouldShow, markShown, alreadyShown: shown }
}
