'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

type ThemeName = 'premium' | 'agentes' | 'republicanos'

interface ThemeContextType {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const STORAGE_KEY = 'cockpit-theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('republicanos')

  // Sincroniza com localStorage na montagem
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeName | null
    if (saved === 'premium' || saved === 'agentes' || saved === 'republicanos') {
      setThemeState(saved)
      document.documentElement.setAttribute('data-theme', saved)
    } else {
      // Se não há tema salvo, aplicar o padrão (republicanos)
      document.documentElement.setAttribute('data-theme', 'republicanos')
    }
  }, [])

  const setTheme = useCallback((newTheme: ThemeName) => {
    setThemeState(newTheme)
    localStorage.setItem(STORAGE_KEY, newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    const order: ThemeName[] = ['republicanos', 'premium', 'agentes']
    const idx = order.indexOf(theme)
    const next = order[(idx + 1) % order.length]
    setTheme(next)
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
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
