'use client'

import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { PanoramaExpectativaVisitasPanel } from '@/components/territorio-campo/panorama-expectativa-visitas-panel'
import {
  TerritorioDataPanel,
  TerritorioPanelHeader,
  territorioPanoramaQuadrantLayout,
} from '@/components/territorio-campo/territorio-panorama-panel-chrome'
import type { TerritorioEstrategiaMapaData } from '@/hooks/use-territorio-estrategia-mapa'
import { buildExpectativaVisitasPanelModel } from '@/lib/territorio-expectativa-visitas-cobertura'
import { typographyBodyMutedClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

export function PanoramaExpectativaVisitasQuadrantesCard({ mapa }: { mapa: TerritorioEstrategiaMapaData }) {
  const { loading, prioridadeCampoLista } = mapa

  const model = useMemo(
    () => buildExpectativaVisitasPanelModel(prioridadeCampoLista),
    [prioridadeCampoLista]
  )

  if (loading) {
    return (
      <TerritorioDataPanel {...territorioPanoramaQuadrantLayout}>
        <div className={cn('flex flex-1 items-center justify-center gap-2 py-12', typographyBodyMutedClass)}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando expectativa × visitas…
        </div>
      </TerritorioDataPanel>
    )
  }

  return (
    <TerritorioDataPanel {...territorioPanoramaQuadrantLayout}>
      <TerritorioPanelHeader
        title="Expectativa 2026 × Visitas de campo"
        description="Priorize municípios com alto potencial eleitoral e baixa cobertura de visitas registradas."
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-3">
        <PanoramaExpectativaVisitasPanel model={model} className="min-h-0 flex-1" />
      </div>
    </TerritorioDataPanel>
  )
}
