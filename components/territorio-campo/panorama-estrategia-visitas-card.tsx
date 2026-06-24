'use client'

import { useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Loader2, Maximize2 } from 'lucide-react'
import {
  TerritorioDataPanel,
  TerritorioPanelHeader,
  TerritorioPanelIconButton,
  territorioPanoramaPanelLayout,
} from '@/components/territorio-campo/territorio-panorama-panel-chrome'
import type { TerritorioEstrategiaMapaData } from '@/hooks/use-territorio-estrategia-mapa'
import { typographyBodyMutedClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

const MapaPresenca = dynamic(
  () => import('@/components/mapa-presenca').then((mod) => mod.MapaPresenca),
  {
    ssr: false,
    loading: () => (
      <div className={cn('flex min-h-0 flex-1 items-center justify-center', typographyBodyMutedClass)}>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Carregando mapa…
      </div>
    ),
  }
)

const MAP_CONTAINER_ID = 'mapa-estrategia-panorama-container'

export function PanoramaEstrategiaVisitasCard({ mapa }: { mapa: TerritorioEstrategiaMapaData }) {
  const {
    loading,
    territoriosFrios,
    territoriosQuentes,
    territoriosMornos,
    cidadesComLiderancas,
    cidadesVisitadasLista,
    expectativaPorCidadeLista,
    prioridadeCampoLista,
    hasMapData,
  } = mapa

  const handleFullscreen = useCallback(() => {
    const container = document.getElementById(MAP_CONTAINER_ID)
    if (!container) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void container.requestFullscreen()
    }
  }, [])

  if (loading) {
    return (
      <TerritorioDataPanel {...territorioPanoramaPanelLayout}>
        <div className={cn('flex flex-1 items-center justify-center gap-2 py-12', typographyBodyMutedClass)}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando mapa de estratégia territorial…
        </div>
      </TerritorioDataPanel>
    )
  }

  return (
    <TerritorioDataPanel {...territorioPanoramaPanelLayout}>
      <TerritorioPanelHeader
        title="Mapa de Estratégia Territorial de Visitas"
        description="Presença de lideranças, visitas de campo e oportunidades territoriais no Piauí."
        action={
          hasMapData ? (
            <TerritorioPanelIconButton
              onClick={handleFullscreen}
              title="Expandir mapa"
              icon={Maximize2}
            />
          ) : null
        }
      />

      <div className="min-h-0 flex-1 overflow-hidden p-3 pt-0">
        {!hasMapData ? (
          <div
            className={cn(
              'flex h-full items-center justify-center rounded-md border border-[rgb(var(--color-border-secondary)/0.55)] bg-bg-app px-4 text-center',
              typographyBodyMutedClass
            )}
          >
            Configure o território (Google Sheets ou servidor) para carregar o mapa de presença e lideranças.
          </div>
        ) : (
          <div
            id={MAP_CONTAINER_ID}
            className={cn(
              'relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-[rgb(var(--color-border-secondary)/0.55)]',
              '[&:fullscreen]:flex [&:fullscreen]:h-screen [&:fullscreen]:w-full [&:fullscreen]:flex-col [&:fullscreen]:min-h-0 [&:fullscreen]:bg-bg-surface'
            )}
          >
            <MapaPresenca
              embedded
              cidadesComPresenca={cidadesComLiderancas}
              cidadesVisitadas={cidadesVisitadasLista}
              expectativaPorCidadeLista={expectativaPorCidadeLista}
              prioridadeCampoLista={prioridadeCampoLista}
              totalCidades={224}
              fullscreen={false}
              showStatsOverlay
              territoriosQuentes={territoriosQuentes}
              territoriosMornos={territoriosMornos}
              territoriosFrios={territoriosFrios}
              onFullscreen={handleFullscreen}
            />
          </div>
        )}
      </div>
    </TerritorioDataPanel>
  )
}
