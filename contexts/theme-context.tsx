'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

type ThemeName = 'premium' | 'agentes' | 'republicanos' | 'cockpit'
export type AppearanceMode = 'light' | 'dark'

interface ThemeContextType {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  toggleTheme: () => void
  appearance: AppearanceMode
  setAppearance: (mode: AppearanceMode) => void
  toggleAppearance: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = 'cockpit-theme'
const APPEARANCE_KEY = 'cockpit-appearance'

function applyAppearanceToDocument(mode: AppearanceMode) {
  document.documentElement.setAttribute('data-appearance', mode)
  document.documentElement.style.colorScheme = mode
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('republicanos')
  const [appearance, setAppearanceState] = useState<AppearanceMode>('light')

  // Sincroniza com localStorage na montagem
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeName | null
    if (saved === 'premium' || saved === 'agentes' || saved === 'republicanos' || saved === 'cockpit') {
      setThemeState(saved)
      document.documentElement.setAttribute('data-theme', saved)
    } else {
      // Se não há tema salvo, aplicar o padrão (republicanos)
      document.documentElement.setAttribute('data-theme', 'republicanos')
    }

    const savedAppearance = localStorage.getItem(APPEARANCE_KEY) as AppearanceMode | null
    const nextAppearance = savedAppearance === 'dark' ? 'dark' : 'light'
    setAppearanceState(nextAppearance)
    applyAppearanceToDocument(nextAppearance)
  }, [])

  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    const order: ThemeName[] = ['republicanos', 'premium', 'agentes', 'cockpit']
    const idx = order.indexOf(theme)
    const next = order[(idx + 1) % order.length]
    setTheme(next)
  }, [theme, setTheme])

  const setAppearance = useCallback((mode: AppearanceMode) => {
    setAppearanceState(mode)
    localStorage.setItem(APPEARANCE_KEY, mode)
    applyAppearanceToDocument(mode)
  }, [])

  const toggleAppearance = useCallback(() => {
    setAppearanceState((prev) => {
      const next: AppearanceMode = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem(APPEARANCE_KEY, next)
      applyAppearanceToDocument(next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, toggleTheme, appearance, setAppearance, toggleAppearance }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
