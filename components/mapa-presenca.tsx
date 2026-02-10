'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Maximize2, Minimize2 } from 'lucide-react'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import { getAllEleitores } from '@/lib/eleitores'

// Dynamic import do wrapper Leaflet (client-only)
const MapWrapperLeaflet = dynamic(
  () => import('./mapa-wrapper-leaflet').then(mod => mod.MapWrapperLeaflet),
  { ssr: false }
)

interface MapaPresencaProps {
  cidadesComPresenca: string[]
  cidadesVisitadas?: string[]
  totalCidades: number
  onFullscreen?: () => void
  fullscreen?: boolean
}

export function MapaPresenca({ cidadesComPresenca, cidadesVisitadas = [], totalCidades, onFullscreen, fullscreen = false }: MapaPresencaProps) {
  const [clientReady, setClientReady] = useState(false)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)

  useEffect(() => {
    setClientReady(true)
  }, [])

  // Escutar mudanças de fullscreen nativo
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleExitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    }
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
    <div className={`w-full ${isNativeFullscreen ? 'h-screen bg-background flex flex-col' : 'space-y-4'}`}>
      {/* Header com botão de tela cheia */}
      <div className={`flex items-center justify-between ${isNativeFullscreen ? 'bg-surface border-b border-card px-4 py-3' : ''}`}>
        <div className="flex items-center gap-2">
          <h3 className={`font-medium text-secondary ${isNativeFullscreen ? 'text-base' : 'text-sm'}`}>Mapa de Presença Territorial</h3>
        </div>
        <div className="flex items-center gap-1">
          {onFullscreen && !isNativeFullscreen && (
            <button
              onClick={onFullscreen}
              className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-text-primary"
              title="Expandir mapa em tela cheia"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          {isNativeFullscreen && (
            <button
              onClick={handleExitFullscreen}
              className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-text-primary"
              title="Sair da tela cheia"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Mapa */}
      <div className={`w-full bg-surface overflow-hidden relative ${
        isNativeFullscreen
          ? 'flex-1'
          : fullscreen
            ? 'h-[calc(100vh-300px)] rounded-2xl border border-card'
            : 'h-96 rounded-2xl border border-card'
      }`}>
        <MapWrapperLeaflet 
          cidadesComPresenca={cidadesComPresenca}
          cidadesVisitadas={cidadesVisitadas}
          municipiosPiaui={municipiosPiaui}
          eleitoresPorCidade={eleitoresPorCidade}
        />
      </div>

      {/* Legenda */}
      <div className={`flex flex-wrap items-center justify-center gap-5 text-xs text-secondary ${isNativeFullscreen ? 'bg-surface border-t border-card px-4 py-3' : ''}`}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-blue-700 flex items-center justify-center">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <span>Visitada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-600 border border-blue-700"></div>
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
