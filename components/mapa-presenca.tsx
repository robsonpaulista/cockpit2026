'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import municipiosPiaui from '@/lib/municipios-piaui.json'

// Dynamic import do wrapper Leaflet (client-only)
const MapWrapperLeaflet = dynamic(
  () => import('./mapa-wrapper-leaflet').then(mod => mod.MapWrapperLeaflet),
  { ssr: false }
)

interface MapaPresencaProps {
  cidadesComPresenca: string[]
  totalCidades: number
  onFullscreen?: () => void
  fullscreen?: boolean
}

export function MapaPresenca({ cidadesComPresenca, totalCidades, onFullscreen, fullscreen = false }: MapaPresencaProps) {
  const [clientReady, setClientReady] = useState(false)

  useEffect(() => {
    setClientReady(true)
  }, [])

  if (!clientReady) {
    return (
      <div className="w-full h-96 bg-surface rounded-2xl border border-card flex items-center justify-center">
        <p className="text-secondary">Carregando mapa...</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      {/* Mapa */}
      <div className={`w-full ${fullscreen ? 'h-[calc(100vh-300px)]' : 'h-96'} bg-surface rounded-2xl border border-card overflow-hidden`}>
        <MapWrapperLeaflet 
          cidadesComPresenca={cidadesComPresenca}
          municipiosPiaui={municipiosPiaui}
        />
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-6 text-xs text-secondary">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent-gold border border-accent-gold"></div>
          <span>Presença Ativa</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#E5DED4] border border-[#D4D0C8]"></div>
          <span>Sem Ação</span>
        </div>
      </div>
    </div>
  )
}
