'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type WarRoomViewMode = 'padrao' | 'desempenho' | 'copiloto'

type WarRoomViewModeContextValue = {
  viewMode: WarRoomViewMode
  isDesempenho: boolean
  isCopiloto: boolean
  setViewMode: (mode: WarRoomViewMode) => void
  toggleDesempenho: () => void
  toggleCopiloto: () => void
}

const WarRoomViewModeContext = createContext<WarRoomViewModeContextValue | null>(
  null,
)

export function WarRoomViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<WarRoomViewMode>('padrao')

  const setViewMode = useCallback((mode: WarRoomViewMode) => {
    setViewModeState((prev) => (prev === mode ? prev : mode))
  }, [])

  const toggleDesempenho = useCallback(() => {
    setViewModeState((prev) => (prev === 'desempenho' ? 'padrao' : 'desempenho'))
  }, [])

  const toggleCopiloto = useCallback(() => {
    setViewModeState((prev) => (prev === 'copiloto' ? 'padrao' : 'copiloto'))
  }, [])

  const value = useMemo(
    () => ({
      viewMode,
      isDesempenho: viewMode === 'desempenho',
      isCopiloto: viewMode === 'copiloto',
      setViewMode,
      toggleDesempenho,
      toggleCopiloto,
    }),
    [viewMode, setViewMode, toggleDesempenho, toggleCopiloto],
  )

  return (
    <WarRoomViewModeContext.Provider value={value}>
      {children}
    </WarRoomViewModeContext.Provider>
  )
}

export function useWarRoomViewMode(): WarRoomViewModeContextValue {
  const ctx = useContext(WarRoomViewModeContext)
  if (!ctx) {
    throw new Error('useWarRoomViewMode must be used within WarRoomViewModeProvider')
  }
  return ctx
}
