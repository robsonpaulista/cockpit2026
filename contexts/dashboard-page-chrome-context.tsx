'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type DashboardPageChromeContextValue = {
  fixedChromeDepth: number
  registerFixedChrome: () => () => void
}

const DashboardPageChromeContext = createContext<DashboardPageChromeContextValue | null>(null)

export function DashboardPageChromeProvider({ children }: { children: ReactNode }) {
  const [fixedChromeDepth, setFixedChromeDepth] = useState(0)

  const registerFixedChrome = useCallback(() => {
    setFixedChromeDepth((depth) => depth + 1)
    return () => setFixedChromeDepth((depth) => Math.max(0, depth - 1))
  }, [])

  const value = useMemo(
    () => ({ fixedChromeDepth, registerFixedChrome }),
    [fixedChromeDepth, registerFixedChrome]
  )

  return (
    <DashboardPageChromeContext.Provider value={value}>{children}</DashboardPageChromeContext.Provider>
  )
}

export function useDashboardFixedChromeActive(): boolean {
  const ctx = useContext(DashboardPageChromeContext)
  return (ctx?.fixedChromeDepth ?? 0) > 0
}

/** Chamado por `DashboardPageShell` para indicar scroll interno (cabeçalho + abas fixos). */
export function useRegisterDashboardFixedChrome(): () => void {
  const ctx = useContext(DashboardPageChromeContext)
  if (!ctx) return () => {}
  return ctx.registerFixedChrome
}
