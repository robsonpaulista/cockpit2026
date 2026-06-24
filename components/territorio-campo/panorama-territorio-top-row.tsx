'use client'

import { useCallback, useMemo, useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { ComparativoExpectativa2022Barras } from '@/components/territorio-campo/comparativo-expectativa-2022-barras'
import { LiderancasCargoPorCidadeCard } from '@/components/territorio-campo/liderancas-cargo-por-cidade-card'
import type { ComparativoExpectativa2022Resumo, ComparativoExpectativa2022Row } from '@/lib/comparativo-expectativa-2022'
import type { CidadeLiderancasCargoRow, LiderancasCargoPorCidadeResumo } from '@/lib/territorio-liderancas-cargo-por-cidade'
import { typographyBodyClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

function buildInsightText(
  comparativoRows: ComparativoExpectativa2022Row[],
  baseResumo: LiderancasCargoPorCidadeResumo | null
): string | null {
  const top = [...comparativoRows]
    .filter((r) => r.expectativa2026 > 0)
    .sort((a, b) => b.expectativa2026 - a.expectativa2026)[0]

  if (!top) return null

  const pct =
    top.deltaPercentual != null && Number.isFinite(top.deltaPercentual)
      ? `${top.deltaPercentual > 0 ? '+' : ''}${Math.round(top.deltaPercentual)}%`
      : null

  const destaque = baseResumo?.destaqueExpectativa
  const sufixoCargo = destaque
    ? ` — ${destaque.cargo} concentra ${destaque.percentualExpectativa}% da expectativa da base (${destaque.totalLiderancas} lideranças).`
    : '.'

  return `${top.cidade} lidera o potencial com ${top.expectativa2026.toLocaleString('pt-BR')} votos${pct ? ` (${pct})` : ''}${sufixoCargo}`
}

export function PanoramaTerritorioTopRow() {
  const [cargoFiltro, setCargoFiltro] = useState<string | null>(null)
  const [liderancasPorCidade, setLiderancasPorCidade] = useState<CidadeLiderancasCargoRow[]>([])
  const [comparativoResumo, setComparativoResumo] = useState<ComparativoExpectativa2022Resumo | null>(null)
  const [comparativoRows, setComparativoRows] = useState<ComparativoExpectativa2022Row[]>([])
  const [baseResumo, setBaseResumo] = useState<LiderancasCargoPorCidadeResumo | null>(null)

  const insight = useMemo(
    () => buildInsightText(comparativoRows, baseResumo),
    [comparativoRows, baseResumo]
  )

  const handleComparativoLoaded = useCallback(
    (resumo: ComparativoExpectativa2022Resumo | null, rows: ComparativoExpectativa2022Row[]) => {
      setComparativoResumo(resumo)
      setComparativoRows(rows)
    },
    []
  )

  const handleClearCargoFiltro = useCallback(() => setCargoFiltro(null), [])

  return (
    <div className="flex flex-col gap-3">
      <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-2 xl:items-stretch">
        <ComparativoExpectativa2022Barras
          cargoFiltro={cargoFiltro}
          liderancasPorCidade={liderancasPorCidade}
          onClearCargoFiltro={handleClearCargoFiltro}
          onResumoLoaded={handleComparativoLoaded}
        />
        <LiderancasCargoPorCidadeCard
          cargoSelecionado={cargoFiltro}
          onCargoSelecionado={setCargoFiltro}
          onRowsLoaded={setLiderancasPorCidade}
          onResumoLoaded={setBaseResumo}
        />
      </div>

      {insight ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-[rgb(var(--color-border-secondary)/0.45)] bg-bg-app/60 px-4 py-2.5">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#C8900A]" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Insight rápido</p>
            <p className={cn('mt-0.5 leading-snug text-text-secondary', typographyBodyClass)}>{insight}</p>
            {comparativoResumo && baseResumo ? (
              <p className="mt-1 text-[11px] text-text-muted">
                {comparativoResumo.municipiosComDados} municípios · {baseResumo.totalLiderancas} lideranças ·{' '}
                {baseResumo.totalExpectativaVotos.toLocaleString('pt-BR')} votos de expectativa na base
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
