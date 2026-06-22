'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'cockpit:jarvis-panel-open'

interface JarvisVisibilityContextValue {
  visible: boolean
  hydrated: boolean
  openJarvis: () => void
  closeJarvis: () => void
  toggleJarvis: () => void
}

const JarvisVisibilityContext = createContext<JarvisVisibilityContextValue | null>(null)

function readStoredVisibility(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(STORAGE_KEY) === '1'
}

function persistVisibility(visible: boolean): void {
  if (typeof window === 'undefined') return
  if (visible) sessionStorage.setItem(STORAGE_KEY, '1')
  else sessionStorage.removeItem(STORAGE_KEY)
}

export function JarvisVisibilityProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setVisible(readStoredVisibility())
    setHydrated(true)
  }, [])

  const openJarvis = useCallback(() => {
    persistVisibility(true)
    setVisible(true)
  }, [])

  const closeJarvis = useCallback(() => {
    persistVisibility(false)
    setVisible(false)
  }, [])

  const toggleJarvis = useCallback(() => {
    setVisible((prev) => {
      const next = !prev
      persistVisibility(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      visible,
      hydrated,
      openJarvis,
      closeJarvis,
      toggleJarvis,
    }),
    [visible, hydrated, openJarvis, closeJarvis, toggleJarvis]
  )

  return (
    <JarvisVisibilityContext.Provider value={value}>{children}</JarvisVisibilityContext.Provider>
  )
}

export function useJarvisVisibility(): JarvisVisibilityContextValue {
  const ctx = useContext(JarvisVisibilityContext)
  if (!ctx) {
    throw new Error('useJarvisVisibility must be used within JarvisVisibilityProvider')
  }
  return ctx
}
