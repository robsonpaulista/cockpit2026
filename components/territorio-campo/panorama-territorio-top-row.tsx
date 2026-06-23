'use client'

import { ComparativoExpectativa2022Barras } from '@/components/territorio-campo/comparativo-expectativa-2022-barras'
import { LiderancasCargoPorCidadeCard } from '@/components/territorio-campo/liderancas-cargo-por-cidade-card'

export function PanoramaTerritorioTopRow() {
  return (
    <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-2 xl:items-start">
      <ComparativoExpectativa2022Barras />
      <LiderancasCargoPorCidadeCard />
    </div>
  )
}
