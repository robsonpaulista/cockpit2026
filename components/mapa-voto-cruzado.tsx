'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Maximize2, Minimize2, MapPinned } from 'lucide-react'
import municipiosPiaui from '@/lib/municipios-piaui.json'

const MapaVotoCruzadoWrapperLeaflet = dynamic(
  () => import('./mapa-voto-cruzado-wrapper-leaflet').then((mod) => mod.MapaVotoCruzadoWrapperLeaflet),
  { ssr: false }
)

interface VotoCruzadoCidade {
  cidade: string
  votos: number
  liderancas: number
  deputadoDominante?: string
  rankingDeputados?: Array<{
    nome: string
    votos: number
    liderancas: number
  }>
}

interface MapaVotoCruzadoProps {
  deputados?: string[]
  deputado?: string
  cidades: VotoCruzadoCidade[]
  onFullscreen?: () => void
}

function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

export function MapaVotoCruzado({ deputados, deputado, cidades, onFullscreen }: MapaVotoCruzadoProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsElement = document.fullscreenElement
      const root = rootRef.current
      setIsNativeFullscreen(Boolean(fsElement && root && fsElement.contains(root)))
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const handleExitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }

  const deputadosAtivos = deputados && deputados.length > 0
    ? deputados
    : deputado
      ? [deputado]
      : []
  const palette = [
    '#2563EB',
    '#059669',
    '#D97706',
    '#7C3AED',
    '#DC2626',
    '#0D9488',
    '#4F46E5',
    '#EA580C',
    '#16A34A',
    '#BE123C',
  ]

  const corPorDeputado = useMemo(() => {
    const map = new Map<string, string>()
    deputadosAtivos.forEach((dep, i) => {
      map.set(dep, palette[i % palette.length])
    })
    return map
  }, [deputadosAtivos])

  const points = useMemo(() => {
    const mapaMunicipios = new Map(municipiosPiaui.map((m) => [normalizeName(m.nome), m]))
    return cidades
      .map((item) => {
        const municipio = mapaMunicipios.get(normalizeName(item.cidade))
        if (!municipio) return null
        const nivel: 'alto' | 'medio' | 'baixo' =
          item.votos >= 1500 ? 'alto' : item.votos >= 600 ? 'medio' : 'baixo'
        const deputadoDominante = item.deputadoDominante || 'Não informado'
        return {
          cidade: item.cidade,
          lat: municipio.lat,
          lng: municipio.lng,
          votos: item.votos,
          liderancas: item.liderancas,
          nivel,
          deputadoDominante,
          corDeputado: corPorDeputado.get(deputadoDominante) || '#6B7280',
          rankingDeputados: item.rankingDeputados || [],
        }
      })
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
  }, [cidades, corPorDeputado])

  const totalVotos = cidades.reduce((sum, c) => sum + c.votos, 0)

  const labelDeputados =
    deputadosAtivos.length <= 2
      ? deputadosAtivos.join(', ')
      : `${deputadosAtivos.slice(0, 2).join(', ')} +${deputadosAtivos.length - 2}`

  return (
    <div
      ref={rootRef}
      className={isNativeFullscreen
        ? 'h-screen bg-background p-4 flex flex-col gap-3'
        : 'space-y-3'}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <MapPinned className="w-4 h-4 text-accent-gold" />
            Mapa de Voto Cruzado — {labelDeputados}
          </h3>
          <p className="text-xs text-secondary mt-1">
            Apenas cidades com potencial conjunto Federal + Estadual.
          </p>
        </div>
        {isNativeFullscreen ? (
          <button
            type="button"
            onClick={handleExitFullscreen}
            className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-text-primary"
            title="Sair da tela cheia"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
        ) : onFullscreen ? (
          <button
            type="button"
            onClick={onFullscreen}
            className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-text-primary"
            title="Expandir mapa"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="px-3 py-2 rounded-lg border border-card bg-background">
          <p className="text-[11px] text-secondary">Cidades</p>
          <p className="text-sm font-semibold text-text-primary">{points.length}</p>
        </div>
        <div className="px-3 py-2 rounded-lg border border-card bg-background">
          <p className="text-[11px] text-secondary">Votos cruzados</p>
          <p className="text-sm font-semibold text-accent-gold">{Math.round(totalVotos).toLocaleString('pt-BR')}</p>
        </div>
        <div className="px-3 py-2 rounded-lg border border-card bg-background">
          <p className="text-[11px] text-secondary">Deputados analisados</p>
          <p className="text-sm font-semibold text-text-primary truncate">{deputadosAtivos.length}</p>
        </div>
      </div>

      <div className={isNativeFullscreen ? 'flex-1 min-h-0 rounded-2xl border border-card overflow-hidden bg-surface' : 'h-[420px] rounded-2xl border border-card overflow-hidden bg-surface'}>
        {points.length > 0 ? (
          <MapaVotoCruzadoWrapperLeaflet points={points} />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-secondary">
            Sem cidades com coordenadas válidas para exibir.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-secondary">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-emerald-700" />
          <span>Alto (≥ 1.500 votos)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-amber-700" />
          <span>Médio (600-1.499)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-blue-700" />
          <span>Base (&lt; 600)</span>
        </div>
        <div className="h-4 w-px bg-card" />
        <span className="text-[11px] text-secondary">Borda do ponto = deputado dominante no município</span>
      </div>

      {deputadosAtivos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {deputadosAtivos.map((dep) => (
            <span
              key={dep}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-card bg-background text-secondary"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: corPorDeputado.get(dep) || '#6B7280' }}
              />
              <span className="truncate max-w-[180px]" title={dep}>{dep}</span>
            </span>
          ))}
        </div>
      )}

      <div className="text-[11px] text-secondary">
        Passe o mouse/click em um município para ver o deputado dominante e o ranking local.
      </div>
    </div>
  )
}

