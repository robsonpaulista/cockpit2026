'use client'

import { PanoramaExpectativaVisitasQuadrantesCard } from '@/components/territorio-campo/panorama-expectativa-visitas-quadrantes-card'
import { useTerritorioEstrategiaMapa } from '@/hooks/use-territorio-estrategia-mapa'

export function PanoramaCampoDataSection() {
  const mapa = useTerritorioEstrategiaMapa()

  return (
    <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
      <PanoramaExpectativaVisitasQuadrantesCard mapa={mapa} />
    </div>
  )
}
