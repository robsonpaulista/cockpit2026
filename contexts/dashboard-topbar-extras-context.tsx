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

export type DashboardTopbarExtras = {
  description?: ReactNode
  actions?: ReactNode
  /** Oculta o h1 da página (útil quando o título vai na mesma linha da description). */
  hidePageTitle?: boolean
}

type DashboardTopbarExtrasContextValue = {
  extras: DashboardTopbarExtras | null
  setExtras: (extras: DashboardTopbarExtras | null) => void
}

const DashboardTopbarExtrasContext = createContext<DashboardTopbarExtrasContextValue | null>(
  null,
)

export function DashboardTopbarExtrasProvider({ children }: { children: ReactNode }) {
  const [extras, setExtrasState] = useState<DashboardTopbarExtras | null>(null)
  const setExtras = useCallback((next: DashboardTopbarExtras | null) => {
    setExtrasState(next)
  }, [])

  const value = useMemo(
    () => ({ extras, setExtras }),
    [extras, setExtras],
  )

  return (
    <DashboardTopbarExtrasContext.Provider value={value}>
      {children}
    </DashboardTopbarExtrasContext.Provider>
  )
}

export function useDashboardTopbarExtras(): DashboardTopbarExtras | null {
  return useContext(DashboardTopbarExtrasContext)?.extras ?? null
}

/** Registra descrição/ações na top bar geral; limpa ao desmontar. */
export function useSetDashboardTopbarExtras(extras: DashboardTopbarExtras | null): void {
  const setExtras = useContext(DashboardTopbarExtrasContext)?.setExtras

  useEffect(() => {
    if (!setExtras) return
    setExtras(extras)
    return () => setExtras(null)
  }, [setExtras, extras])
}
