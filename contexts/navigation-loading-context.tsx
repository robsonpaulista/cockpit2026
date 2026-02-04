'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface NavigationLoadingContextType {
  navigating: boolean
  setNavigating: (value: boolean) => void
}

const NavigationLoadingContext = createContext<NavigationLoadingContextType | undefined>(undefined)

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const [navigating, setNavigatingState] = useState(false)

  const setNavigating = useCallback((value: boolean) => {
    setNavigatingState(value)
  }, [])

  return (
    <NavigationLoadingContext.Provider value={{ navigating, setNavigating }}>
      {children}
    </NavigationLoadingContext.Provider>
  )
}

export function useNavigationLoading() {
  const context = useContext(NavigationLoadingContext)
  if (context === undefined) {
    throw new Error('useNavigationLoading must be used within a NavigationLoadingProvider')
  }
  return context
}
