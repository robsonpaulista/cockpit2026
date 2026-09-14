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

export type WarRoomCopilotoTabHint =
  | 'cidades'
  | 'cobertura'
  | 'obras'
  | 'emendas'
  | 'redes'
  | 'anuncios'
  | 'panorama'
  | 'comparativo'
  | 'relatorio'

type WarRoomViewModeContextValue = {
  viewMode: WarRoomViewMode
  isDesempenho: boolean
  isCopiloto: boolean
  copilotoTabHint: WarRoomCopilotoTabHint | null
  setViewMode: (mode: WarRoomViewMode) => void
  toggleDesempenho: () => void
  toggleCopiloto: () => void
  openCopilotoTab: (tab: WarRoomCopilotoTabHint) => void
  clearCopilotoTabHint: () => void
}

const WarRoomViewModeContext = createContext<WarRoomViewModeContextValue | null>(
  null,
)

export function WarRoomViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<WarRoomViewMode>('padrao')
  const [copilotoTabHint, setCopilotoTabHint] = useState<WarRoomCopilotoTabHint | null>(
    null,
  )

  const setViewMode = useCallback((mode: WarRoomViewMode) => {
    setViewModeState((prev) => (prev === mode ? prev : mode))
  }, [])

  const toggleDesempenho = useCallback(() => {
    setViewModeState((prev) => (prev === 'desempenho' ? 'padrao' : 'desempenho'))
  }, [])

  const toggleCopiloto = useCallback(() => {
    setViewModeState((prev) => (prev === 'copiloto' ? 'padrao' : 'copiloto'))
  }, [])

  const openCopilotoTab = useCallback((tab: WarRoomCopilotoTabHint) => {
    setCopilotoTabHint(tab)
    setViewModeState('copiloto')
  }, [])

  const clearCopilotoTabHint = useCallback(() => {
    setCopilotoTabHint(null)
  }, [])

  const value = useMemo(
    () => ({
      viewMode,
      isDesempenho: viewMode === 'desempenho',
      isCopiloto: viewMode === 'copiloto',
      copilotoTabHint,
      setViewMode,
      toggleDesempenho,
      toggleCopiloto,
      openCopilotoTab,
      clearCopilotoTabHint,
    }),
    [
      viewMode,
      copilotoTabHint,
      setViewMode,
      toggleDesempenho,
      toggleCopiloto,
      openCopilotoTab,
      clearCopilotoTabHint,
    ],
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
