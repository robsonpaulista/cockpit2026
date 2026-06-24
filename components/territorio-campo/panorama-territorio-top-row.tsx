'use client'

import { useState } from 'react'
import { ComparativoExpectativa2022Barras } from '@/components/territorio-campo/comparativo-expectativa-2022-barras'
import { LiderancasCargoPorCidadeCard } from '@/components/territorio-campo/liderancas-cargo-por-cidade-card'
import type { CidadeLiderancasCargoRow } from '@/lib/territorio-liderancas-cargo-por-cidade'

export function PanoramaTerritorioTopRow() {
  const [cargoFiltro, setCargoFiltro] = useState<string | null>(null)
  const [liderancasPorCidade, setLiderancasPorCidade] = useState<CidadeLiderancasCargoRow[]>([])

  return (
    <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
      <ComparativoExpectativa2022Barras
        cargoFiltro={cargoFiltro}
        liderancasPorCidade={liderancasPorCidade}
        onClearCargoFiltro={() => setCargoFiltro(null)}
      />
      <LiderancasCargoPorCidadeCard
        cargoSelecionado={cargoFiltro}
        onCargoSelecionado={setCargoFiltro}
        onRowsLoaded={setLiderancasPorCidade}
      />
    </div>
  )
}
