'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type WarRoomCidadeContextValue = {
  municipio: string | null
  setMunicipio: (municipio: string | null) => void
}

const WarRoomCidadeContext = createContext<WarRoomCidadeContextValue | null>(null)

export function WarRoomCidadeProvider({ children }: { children: ReactNode }) {
  const [municipio, setMunicipio] = useState<string | null>(null)
  const value = useMemo(() => ({ municipio, setMunicipio }), [municipio])
  return (
    <WarRoomCidadeContext.Provider value={value}>{children}</WarRoomCidadeContext.Provider>
  )
}

export function useWarRoomCidade(): WarRoomCidadeContextValue {
  const ctx = useContext(WarRoomCidadeContext)
  if (!ctx) {
    throw new Error('useWarRoomCidade deve ser usado dentro de WarRoomCidadeProvider')
  }
  return ctx
}
