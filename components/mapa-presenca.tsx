'use client'

import { useEffect, useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Maximize2 } from 'lucide-react'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import { getAllEleitores } from '@/lib/eleitores'

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

  // Montar mapa de eleitores por cidade
  const eleitoresPorCidade = useMemo(() => {
    const mapa: Record<string, number> = {}
    const eleitores = getAllEleitores()
    eleitores.forEach(e => {
      mapa[e.municipio] = e.eleitorado
    })
    return mapa
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
      {/* Header com botão de tela cheia */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-secondary">Mapa de Presença Territorial</h3>
        </div>
        {onFullscreen && (
          <button
            onClick={onFullscreen}
            className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-text-primary"
            title="Visualizar mapa em tela cheia"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Mapa */}
      <div className={`w-full ${fullscreen ? 'h-[calc(100vh-300px)]' : 'h-96'} bg-surface rounded-2xl border border-card overflow-hidden relative`}>
        <MapWrapperLeaflet 
          cidadesComPresenca={cidadesComPresenca}
          municipiosPiaui={municipiosPiaui}
          eleitoresPorCidade={eleitoresPorCidade}
        />
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-secondary">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent-gold border border-accent-gold"></div>
          <span>Com liderança</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-600 border border-red-800 opacity-70"></div>
          <span>Sem liderança (+ eleitores)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400 border border-red-500 opacity-50"></div>
          <span>Sem liderança</span>
        </div>
      </div>
    </div>
  )
}
