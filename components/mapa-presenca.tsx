'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Maximize2, Minimize2, MapPin, Users, Eye, Target, Navigation, Filter, TrendingUp, Crosshair } from 'lucide-react'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import { getAllEleitores } from '@/lib/eleitores'
import type { MapStats } from './mapa-wrapper-leaflet'

// Dynamic import (client-only)
const MapWrapperLeaflet = dynamic(
  () => import('./mapa-wrapper-leaflet').then(mod => mod.MapWrapperLeaflet),
  { ssr: false }
)

interface TerritorioInfo {
  cidade: string
  motivo: string
  expectativaVotos?: number
  visitas?: number
}

interface MapaPresencaProps {
  cidadesComPresenca: string[]
  cidadesVisitadas?: string[]
  totalCidades: number
  onFullscreen?: () => void
  fullscreen?: boolean
  territoriosQuentes?: TerritorioInfo[]
  territoriosMornos?: TerritorioInfo[]
  territoriosFrios?: TerritorioInfo[]
}

const FILTROS = [
  { id: 'todas', label: 'Todas', icon: Eye, description: 'Todas as cidades' },
  { id: 'com-lideranca', label: 'Com liderança', icon: MapPin, description: 'Cidades com liderança ativa' },
  { id: 'sem-lideranca', label: 'Sem liderança', icon: Navigation, description: 'Cidades sem cobertura' },
  { id: 'visitadas', label: 'Visitadas', icon: Crosshair, description: 'Cidades já visitadas' },
  { id: 'oportunidades', label: 'Oportunidades', icon: Target, description: 'Alto potencial sem liderança' },
]

export function MapaPresenca({
  cidadesComPresenca,
  cidadesVisitadas = [],
  totalCidades,
  onFullscreen,
  fullscreen = false,
  territoriosQuentes = [],
  territoriosMornos = [],
  territoriosFrios = [],
}: MapaPresencaProps) {
  const [clientReady, setClientReady] = useState<boolean>(false)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false)
  const [filtroAtivo, setFiltroAtivo] = useState<string>('todas')
  const [mapStats, setMapStats] = useState<MapStats | null>(null)

  useEffect(() => {
    setClientReady(true)
  }, [])

  // Fullscreen listener
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

  // Voter data map
  const eleitoresPorCidade = useMemo(() => {
    const mapa: Record<string, number> = {}
    const eleitores = getAllEleitores()
    eleitores.forEach(e => {
      mapa[e.municipio] = e.eleitorado
    })
    return mapa
  }, [])

  const handleStatsCalculated = useCallback((stats: MapStats) => {
    setMapStats(stats)
  }, [])

  if (!clientReady) {
    return (
      <div className="w-full h-96 bg-surface rounded-2xl border border-card flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
          <p className="text-secondary text-sm">Carregando mapa estratégico...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full ${isNativeFullscreen ? 'h-screen bg-background flex flex-col' : 'space-y-3'}`}>
      {/* Header com Título Dinâmico */}
      <div className={`flex items-center justify-between ${isNativeFullscreen ? 'bg-surface border-b border-card px-4 py-3' : ''}`}>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-text-primary ${isNativeFullscreen ? 'text-lg' : 'text-sm'}`}>
              Mapa de Estratégia Territorial
            </h3>
          </div>
          {/* Dynamic Insight Title */}
          {mapStats?.insightPrincipal && (
            <p className="text-xs text-accent-gold font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              {mapStats.insightPrincipal}
            </p>
          )}
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

      {/* Filtros Rápidos */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Filter className="w-3.5 h-3.5 text-secondary mr-0.5" />
        {FILTROS.map(filtro => {
          const Icon = filtro.icon
          const isActive = filtroAtivo === filtro.id
          return (
            <button
              key={filtro.id}
              onClick={() => setFiltroAtivo(filtro.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-accent-gold text-white shadow-sm'
                  : 'bg-background text-secondary hover:bg-card hover:text-text-primary border border-card'
              }`}
              title={filtro.description}
            >
              <Icon className="w-3 h-3" />
              {filtro.label}
              {filtro.id === 'oportunidades' && mapStats && mapStats.oportunidades > 0 && (
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/25' : 'bg-amber-100 text-amber-700'
                }`}>
                  {mapStats.oportunidades}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Mapa com Overlay de Contadores */}
      <div className={`w-full bg-surface overflow-hidden relative ${
        isNativeFullscreen
          ? 'flex-1'
          : fullscreen
            ? 'h-[calc(100vh-300px)] rounded-2xl border border-card'
            : 'h-96 rounded-2xl border border-card'
      }`}>
        {/* Map Component */}
        <MapWrapperLeaflet
          cidadesComPresenca={cidadesComPresenca}
          cidadesVisitadas={cidadesVisitadas}
          municipiosPiaui={municipiosPiaui}
          eleitoresPorCidade={eleitoresPorCidade}
          territoriosQuentes={territoriosQuentes}
          territoriosMornos={territoriosMornos}
          territoriosFrios={territoriosFrios}
          filtroAtivo={filtroAtivo}
          onStatsCalculated={handleStatsCalculated}
        />

        {/* Live Counter Overlay */}
        {mapStats && (
          <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur-md rounded-xl shadow-lg border border-gray-200/50 p-3 space-y-1.5 min-w-[170px] pointer-events-none">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-[11px] text-gray-900 font-bold">{mapStats.cidadesComPresenca}</span>
              <span className="text-[11px] text-gray-500">com presença</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-[11px] text-gray-900 font-bold">{mapStats.oportunidades}</span>
              <span className="text-[11px] text-gray-500">oportunidades</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 opacity-70" />
              <span className="text-[11px] text-gray-900 font-bold">{mapStats.cidadesSemPresenca}</span>
              <span className="text-[11px] text-gray-500">sem liderança</span>
            </div>
            <div className="h-px bg-gray-200 my-1" />
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-[11px] font-bold text-blue-700">{mapStats.percentualCobertura}%</span>
              <span className="text-[11px] text-gray-500">eleitorado</span>
            </div>
          </div>
        )}
      </div>

      {/* Legenda Aprimorada */}
      <div className={`flex flex-wrap items-center justify-center gap-4 text-xs text-secondary ${isNativeFullscreen ? 'bg-surface border-t border-card px-4 py-3' : ''}`}>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-blue-700 flex items-center justify-center">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <span>Visitada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-600"></div>
          <span>Com liderança</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500 border border-amber-600 animate-pulse"></div>
          <span className="text-amber-700 font-medium">Oportunidade</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-600 opacity-70"></div>
          <span>Sem liderança</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-2 rounded bg-blue-400/20 border border-blue-300/30"></div>
          <span>Zona de presença</span>
        </div>
      </div>
    </div>
  )
}
