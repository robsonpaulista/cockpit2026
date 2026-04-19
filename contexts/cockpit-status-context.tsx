'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export type CockpitStatusMetrics = {
  territorioLabel: string
  lugarChapa: string
}

type CockpitStatusContextValue = {
  metrics: CockpitStatusMetrics | null
  setCockpitStatusMetrics: (value: CockpitStatusMetrics | null) => void
}

const CockpitStatusContext = createContext<CockpitStatusContextValue | undefined>(undefined)

export function CockpitStatusProvider({ children }: { children: ReactNode }) {
  const [metrics, setMetricsState] = useState<CockpitStatusMetrics | null>(null)

  const setCockpitStatusMetrics = useCallback((value: CockpitStatusMetrics | null) => {
    setMetricsState(value)
  }, [])

  const value = useMemo(
    () => ({ metrics, setCockpitStatusMetrics }),
    [metrics, setCockpitStatusMetrics]
  )

  return <CockpitStatusContext.Provider value={value}>{children}</CockpitStatusContext.Provider>
}

export function useCockpitStatus(): CockpitStatusContextValue {
  const ctx = useContext(CockpitStatusContext)
  if (!ctx) {
    throw new Error('useCockpitStatus must be used within CockpitStatusProvider')
  }
  return ctx
}
