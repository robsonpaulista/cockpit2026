'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Briefcase, Filter, Loader2 } from 'lucide-react'
import type {
  CidadeLiderancasCargoRow,
  LiderancasCargoPorCidadeResumo,
} from '@/lib/territorio-liderancas-cargo-por-cidade'
import {
  TerritorioDataPanel,
  TerritorioPanelHeader,
  TerritorioPanoramaTableSection,
  TerritorioTextButton,
  TerritorioThinProgress,
  territorioPanoramaPanelHeaderClass,
  territorioPanoramaTopRowPanelLayout,
  territorioPanoramaTableTotalClass,
  TERRITORIO_PANORAMA_PREVIEW_ROWS,
} from '@/components/territorio-campo/territorio-panorama-panel-chrome'
import { typographyBodyClass, typographyBodyMediumClass, typographyBodyMutedClass, typographySectionLabelClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

function formatVotos(value: number): string {
  return value.toLocaleString('pt-BR')
}

function expectativaPercent(total: number, base: number): number {
  if (base <= 0) return 0
  return Math.round((total / base) * 100)
}

export type LiderancasCargoPorCidadeCardProps = {
  cargoSelecionado: string | null
  onCargoSelecionado: (cargo: string | null) => void
  onRowsLoaded?: (rows: CidadeLiderancasCargoRow[]) => void
  onResumoLoaded?: (resumo: LiderancasCargoPorCidadeResumo | null) => void
}

export function LiderancasCargoPorCidadeCard({
  cargoSelecionado,
  onCargoSelecionado,
  onRowsLoaded,
  onResumoLoaded,
}: LiderancasCargoPorCidadeCardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resumo, setResumo] = useState<LiderancasCargoPorCidadeResumo | null>(null)
  const [showAll, setShowAll] = useState(false)
  const onRowsLoadedRef = useRef(onRowsLoaded)
  const onResumoLoadedRef = useRef(onResumoLoaded)
  onRowsLoadedRef.current = onRowsLoaded
  onResumoLoadedRef.current = onResumoLoaded

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/territorio/liderancas-por-cargo-cidade')
        if (cancelled) return

        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string }
          setError(payload.error ?? 'Não foi possível carregar lideranças por cargo.')
          setResumo(null)
          onRowsLoadedRef.current?.([])
          onResumoLoadedRef.current?.(null)
          return
        }
        const data = (await res.json()) as {
          resumo?: LiderancasCargoPorCidadeResumo
          rows?: CidadeLiderancasCargoRow[]
        }
        const nextResumo = data.resumo ?? null
        setResumo(nextResumo)
        onRowsLoadedRef.current?.(data.rows ?? [])
        onResumoLoadedRef.current?.(nextResumo)
      } catch {
        if (cancelled) return
        setError('Erro ao carregar lideranças por cargo.')
        setResumo(null)
        onRowsLoadedRef.current?.([])
        onResumoLoadedRef.current?.(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const cargos = useMemo(() => resumo?.cargosDetalhe ?? [], [resumo])
  const totalExpectativa = resumo?.totalExpectativaVotos ?? 0
  const totalLiderancas = resumo?.totalLiderancas ?? cargos.reduce((s, c) => s + c.totalLiderancas, 0)

  const cargosVisiveis = showAll ? cargos : cargos.slice(0, TERRITORIO_PANORAMA_PREVIEW_ROWS)

  if (loading) {
    return (
      <TerritorioDataPanel {...territorioPanoramaTopRowPanelLayout}>
        <div className={cn('flex flex-1 items-center justify-center gap-2 py-12', typographyBodyMutedClass)}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando base política…
        </div>
      </TerritorioDataPanel>
    )
  }

  if (error) {
    return (
      <TerritorioDataPanel {...territorioPanoramaTopRowPanelLayout}>
        <TerritorioPanelHeader title="Composição da Base Política (2026)" description={error} />
      </TerritorioDataPanel>
    )
  }

  return (
    <TerritorioDataPanel {...territorioPanoramaTopRowPanelLayout}>
      <TerritorioPanelHeader
        title="Composição da Base Política (2026)"
        className={territorioPanoramaPanelHeaderClass}
        description="Peso eleitoral por cargo — barras usam a soma da expectativa de votos 2026, não só a quantidade de lideranças."
        action={
          cargoSelecionado ? (
            <TerritorioTextButton onClick={() => onCargoSelecionado(null)}>
              <Filter className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              Limpar filtro
            </TerritorioTextButton>
          ) : null
        }
      />

      <TerritorioPanoramaTableSection
        footer={
          cargos.length > 0 ? (
            <div className={territorioPanoramaTableTotalClass}>
              <div className="flex w-full items-center gap-2 px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[12px] font-semibold text-text-primary', typographyBodyMediumClass)}>
                    Total
                  </p>
                  <p className={cn('mt-0.5 text-[10px] text-text-muted', typographyBodyMutedClass)}>
                    {cargos.length} cargos · {totalLiderancas} lideranças · {formatVotos(totalExpectativa)} votos
                  </p>
                </div>
                <span className="flex w-28 shrink-0 items-center gap-2">
                  <TerritorioThinProgress percent={100} active />
                </span>
                <span className="w-9 shrink-0 text-right tabular-nums text-[12px] font-bold text-text-primary">
                  100%
                </span>
                <span className={cn('w-10 shrink-0 text-right tabular-nums text-[12px] font-bold', typographyBodyClass)}>
                  {totalLiderancas}
                </span>
              </div>
            </div>
          ) : null
        }
        expandAction={
          cargos.length > TERRITORIO_PANORAMA_PREVIEW_ROWS ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="shrink-0 text-left text-[12px] font-medium text-[rgb(var(--color-primary))] hover:underline"
            >
              {showAll ? 'Mostrar menos cargos' : `Ver todos os cargos (${cargos.length}) ›`}
            </button>
          ) : null
        }
      >
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-bg-surface">
            <tr>
              <th className={cn('pb-1 text-left', typographySectionLabelClass)}>Cargo</th>
              <th className={cn('pb-1', typographySectionLabelClass)}>Peso (expectativa)</th>
              <th className={cn('pb-1 text-right', typographySectionLabelClass)}>%</th>
              <th className={cn('pb-1 text-right', typographySectionLabelClass)}>Lid.</th>
            </tr>
          </thead>
          <tbody>
            {cargosVisiveis.length === 0 ? (
              <tr>
                <td colSpan={4} className={cn('py-6 text-center', typographyBodyMutedClass)}>
                  Nenhum cargo na base.
                </td>
              </tr>
            ) : (
              cargosVisiveis.map((item) => {
                const selected = cargoSelecionado === item.cargo
                const pctExp = expectativaPercent(item.expectativaVotos, totalExpectativa)
                return (
                  <tr key={item.cargo}>
                    <td colSpan={4} className="p-0">
                      <button
                        type="button"
                        title={`${item.cargo} — ${formatVotos(item.expectativaVotos)} votos · ${item.totalLiderancas} lideranças`}
                        aria-pressed={selected}
                        onClick={() => onCargoSelecionado(selected ? null : item.cargo)}
                        className={cn(
                          'flex w-full min-h-[2rem] items-center gap-2 border-b border-[rgb(var(--color-border-secondary)/0.3)] bg-bg-surface px-2 py-1 text-left transition-colors hover:bg-bg-app/55',
                          selected && 'border-l-2 border-l-[#C8900A] bg-[#C8900A]/10 pl-[6px]'
                        )}
                      >
                        <Briefcase className="h-3.5 w-3.5 shrink-0 text-[#C8900A]/80" aria-hidden />
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-[12px] text-text-primary',
                            selected && 'font-semibold'
                          )}
                        >
                          {item.cargo}
                        </span>
                        <span className="flex w-28 shrink-0 items-center gap-2">
                          <TerritorioThinProgress percent={pctExp} active={selected} />
                        </span>
                        <span
                          className={cn(
                            'w-9 shrink-0 text-right tabular-nums text-[12px] text-text-primary',
                            selected && 'font-semibold'
                          )}
                        >
                          {pctExp}%
                        </span>
                        <span
                          className={cn(
                            'w-10 shrink-0 text-right tabular-nums text-[12px] text-text-primary',
                            selected && 'font-semibold'
                          )}
                        >
                          {item.totalLiderancas}
                        </span>
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </TerritorioPanoramaTableSection>
    </TerritorioDataPanel>
  )
}
