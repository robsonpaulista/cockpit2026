'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  WAR_ROOM_AUTO_REFRESH_MS,
  WAR_ROOM_CHANGE_TTL_MS,
  type WarRoomCardChange,
  type WarRoomCardId,
} from '@/lib/war-room/change-snapshots'

type ReloadFn = (opts: { silent: boolean }) => Promise<void>

type WarRoomRefreshContextValue = {
  generation: number
  lastRefreshAt: number | null
  refreshing: boolean
  register: (id: WarRoomCardId, reload: ReloadFn) => () => void
  reportChange: (id: WarRoomCardId, change: Omit<WarRoomCardChange, 'at'> | null) => void
  getChange: (id: WarRoomCardId) => WarRoomCardChange | null
  refreshAll: (opts?: { silent?: boolean }) => Promise<void>
}

const WarRoomRefreshContext = createContext<WarRoomRefreshContextValue | null>(null)

export function WarRoomRefreshProvider({ children }: { children: ReactNode }) {
  const loadersRef = useRef(new Map<WarRoomCardId, ReloadFn>())
  const changesRef = useRef(new Map<WarRoomCardId, WarRoomCardChange>())
  const [generation, setGeneration] = useState(0)
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [, setTick] = useState(0)

  const register = useCallback((id: WarRoomCardId, reload: ReloadFn) => {
    loadersRef.current.set(id, reload)
    return () => {
      loadersRef.current.delete(id)
    }
  }, [])

  const reportChange = useCallback(
    (id: WarRoomCardId, change: Omit<WarRoomCardChange, 'at'> | null) => {
      if (!change) {
        changesRef.current.delete(id)
      } else {
        changesRef.current.set(id, { ...change, at: Date.now() })
      }
      setTick((n) => n + 1)
    },
    [],
  )

  const getChange = useCallback((id: WarRoomCardId): WarRoomCardChange | null => {
    const change = changesRef.current.get(id)
    if (!change) return null
    if (Date.now() - change.at > WAR_ROOM_CHANGE_TTL_MS) {
      changesRef.current.delete(id)
      return null
    }
    return change
  }, [])

  const refreshAll = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent !== false
    setRefreshing(true)
    const loaders = [...loadersRef.current.values()]
    try {
      await Promise.allSettled(loaders.map((fn) => fn({ silent })))
      setLastRefreshAt(Date.now())
      setGeneration((g) => g + 1)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'hidden') return
      void refreshAll({ silent: true })
    }
    const id = window.setInterval(run, WAR_ROOM_AUTO_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [refreshAll])

  /** Limpa badges expirados. */
  useEffect(() => {
    const id = window.setInterval(() => {
      let cleared = false
      const now = Date.now()
      for (const [key, change] of changesRef.current) {
        if (now - change.at > WAR_ROOM_CHANGE_TTL_MS) {
          changesRef.current.delete(key)
          cleared = true
        }
      }
      if (cleared) setTick((n) => n + 1)
    }, 15_000)
    return () => window.clearInterval(id)
  }, [])

  const value = useMemo(
    () => ({
      generation,
      lastRefreshAt,
      refreshing,
      register,
      reportChange,
      getChange,
      refreshAll,
    }),
    [generation, lastRefreshAt, refreshing, register, reportChange, getChange, refreshAll],
  )

  return (
    <WarRoomRefreshContext.Provider value={value}>{children}</WarRoomRefreshContext.Provider>
  )
}

export function useWarRoomRefresh(): WarRoomRefreshContextValue {
  const ctx = useContext(WarRoomRefreshContext)
  if (!ctx) {
    throw new Error('useWarRoomRefresh deve ser usado dentro de WarRoomRefreshProvider')
  }
  return ctx
}

/** Lê o estado de mudança de um card (re-render via generation/tick do provider). */
export function useWarRoomCardChange(cardId: WarRoomCardId): WarRoomCardChange | null {
  const { getChange, generation } = useWarRoomRefresh()
  void generation
  return getChange(cardId)
}
