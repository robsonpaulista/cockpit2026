'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Loader2,
  MapPin,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import type {
  ComparativoExpectativa2022Resumo,
  ComparativoExpectativa2022Row,
} from '@/lib/comparativo-expectativa-2022'
import { loadComparativoAnterior2026Client } from '@/lib/territorio-comparativo-anterior-2026-client'
import {
  buildCidadesComCargoSet,
  type CidadeLiderancasCargoRow,
} from '@/lib/territorio-liderancas-cargo-por-cidade'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import { typographyBodyClass, typographyBodyMediumClass, typographyBodyMutedClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'
import {
  TerritorioDataPanel,
  TerritorioPanelHeader,
  TerritorioPanoramaTableSection,
  TerritorioTextButton,
  territorioPanoramaPanelHeaderClass,
  territorioPanoramaTopRowPanelLayout,
  territorioPanoramaTableTotalClass,
  TERRITORIO_PANORAMA_PREVIEW_ROWS,
  territorioTdClass,
  territorioThClass,
} from '@/components/territorio-campo/territorio-panorama-panel-chrome'

const MapaExpectativaVs2022 = dynamic(
  () => import('@/components/mapa-expectativa-vs-2022').then((mod) => mod.MapaExpectativaVs2022),
  {
    ssr: false,
    loading: () => (
      <div className={cn('flex min-h-[min(40vh,360px)] items-center justify-center', typographyBodyMutedClass)}>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Carregando mapa…
      </div>
    ),
  }
)

const PREVIEW_ROWS = TERRITORIO_PANORAMA_PREVIEW_ROWS

function formatVotos(value: number): string {
  return value.toLocaleString('pt-BR')
}

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${Math.round(value)}%`
}

function ComparativoBarraCell({ row }: { row: ComparativoExpectativa2022Row }) {
  const max = Math.max(row.votos2022, row.expectativa2026, 1)
  const pct2022 = (row.votos2022 / max) * 100
  const pct2026 = (row.expectativa2026 / max) * 100
  const cresceu = row.expectativa2026 > row.votos2022

  return (
    <div className="relative mx-auto h-2 w-full min-w-[3.5rem] max-w-[5.5rem] overflow-hidden rounded-full bg-[rgb(var(--color-border-secondary)/0.45)]">
      <div className="absolute inset-y-0 left-0 rounded-full bg-text-primary/20" style={{ width: `${pct2022}%` }} />
      <div
        className={cn('absolute inset-y-0 left-0 rounded-full', cresceu ? 'bg-emerald-500' : 'bg-red-500')}
        style={{ width: `${pct2026}%` }}
      />
    </div>
  )
}

export type ComparativoExpectativa2022BarrasProps = {
  cargoFiltro?: string | null
  liderancasPorCidade?: CidadeLiderancasCargoRow[]
  onClearCargoFiltro?: () => void
  onResumoLoaded?: (resumo: ComparativoExpectativa2022Resumo | null, rows: ComparativoExpectativa2022Row[]) => void
}

export function ComparativoExpectativa2022Barras({
  cargoFiltro = null,
  liderancasPorCidade = [],
  onClearCargoFiltro,
  onResumoLoaded,
}: ComparativoExpectativa2022BarrasProps = {}) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const onResumoLoadedRef = useRef(onResumoLoaded)
  onResumoLoadedRef.current = onResumoLoaded

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cenarioLabel, setCenarioLabel] = useState('Expectativa 2026')
  const [rows, setRows] = useState<ComparativoExpectativa2022Row[]>([])
  const [view, setView] = useState<'tabela' | 'mapa'>('tabela')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await loadComparativoAnterior2026Client()
        if (cancelled) return

        if (!result.ok) {
          setError(result.error)
          setRows([])
          onResumoLoadedRef.current?.(null, [])
          return
        }
        setCenarioLabel(result.cenarioLabel)
        setRows(result.rows)
        onResumoLoadedRef.current?.(result.resumo, result.rows)
      } catch {
        if (cancelled) return
        setError('Erro ao carregar comparativo territorial.')
        setRows([])
        onResumoLoadedRef.current?.(null, [])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const cidadesCargoSet = useMemo(() => {
    if (!cargoFiltro || liderancasPorCidade.length === 0) return null
    return buildCidadesComCargoSet(liderancasPorCidade, cargoFiltro)
  }, [cargoFiltro, liderancasPorCidade])

  const rowsFiltradas = useMemo(() => {
    return rows.filter((row) => {
      if (cidadesCargoSet && !cidadesCargoSet.has(normalizeMunicipioNome(row.cidade))) return false
      if (row.tendencia === 'sem-dados') return false
      return row.votos2022 > 0 || row.expectativa2026 > 0
    })
  }, [rows, cidadesCargoSet])

  const rowsOrdenadas = useMemo(
    () => [...rowsFiltradas].sort((a, b) => b.expectativa2026 - a.expectativa2026),
    [rowsFiltradas]
  )

  const rowsVisiveis = showAll ? rowsOrdenadas : rowsOrdenadas.slice(0, PREVIEW_ROWS)

  const totais = useMemo(() => {
    const totalVotos2022 = rowsFiltradas.reduce((s, r) => s + r.votos2022, 0)
    const totalExpectativa2026 = rowsFiltradas.reduce((s, r) => s + r.expectativa2026, 0)
    const delta = totalExpectativa2026 - totalVotos2022
    const deltaPercentual = totalVotos2022 > 0 ? (delta / totalVotos2022) * 100 : null
    const cresceu = rowsFiltradas.filter((r) => r.tendencia === 'cresceu').length

    return {
      totalVotos2022,
      totalExpectativa2026,
      delta,
      deltaPercentual,
      municipios: rowsFiltradas.length,
      cresceu,
    }
  }, [rowsFiltradas])

  if (loading) {
    return (
      <TerritorioDataPanel {...territorioPanoramaTopRowPanelLayout}>
        <div className={cn('flex flex-1 items-center justify-center gap-2 py-12', typographyBodyMutedClass)}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando potencial eleitoral…
        </div>
      </TerritorioDataPanel>
    )
  }

  if (error) {
    return (
      <TerritorioDataPanel {...territorioPanoramaTopRowPanelLayout}>
        <TerritorioPanelHeader title="Potencial Eleitoral: 2022 → 2026" description={error} />
      </TerritorioDataPanel>
    )
  }

  return (
    <TerritorioDataPanel {...territorioPanoramaTopRowPanelLayout}>
      <TerritorioPanelHeader
        title="Potencial Eleitoral: 2022 → 2026"
        className={territorioPanoramaPanelHeaderClass}
        description={
          cargoFiltro ? (
            <>
              Comparativo filtrado por cargo <span className="font-medium text-text-secondary">{cargoFiltro}</span> — cenário{' '}
              {cenarioLabel}.
            </>
          ) : (
            <>Comparativo do potencial de votos por município — cenário {cenarioLabel}.</>
          )
        }
        action={
          <div className="flex items-center gap-2">
            {cargoFiltro && onClearCargoFiltro ? (
              <TerritorioTextButton onClick={onClearCargoFiltro}>Limpar filtro</TerritorioTextButton>
            ) : null}
            <TerritorioTextButton onClick={() => setView((v) => (v === 'mapa' ? 'tabela' : 'mapa'))}>
              <MapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              {view === 'mapa' ? 'Ver tabela' : 'Ver mapa'}
            </TerritorioTextButton>
          </div>
        }
      />

      {view === 'mapa' ? (
        <div className="p-3 pt-0 pb-3">
          <div
            ref={mapContainerRef}
            className={cn(
              'relative h-[18rem] min-w-0 overflow-hidden rounded-md border border-[rgb(var(--color-border-secondary)/0.55)]',
              '[&:fullscreen]:flex [&:fullscreen]:h-screen [&:fullscreen]:w-full [&:fullscreen]:flex-col [&:fullscreen]:min-h-0 [&:fullscreen]:bg-bg-surface'
            )}
          >
            <MapaExpectativaVs2022
              comparativoLista={rowsFiltradas}
              labelExpectativa2026={cenarioLabel}
              onFullscreen={() => {
                const container = mapContainerRef.current
                if (!container) return
                if (document.fullscreenElement) {
                  void document.exitFullscreen()
                } else {
                  void container.requestFullscreen()
                }
              }}
            />
          </div>
        </div>
      ) : (
        <TerritorioPanoramaTableSection
          footer={
            rowsFiltradas.length > 0 ? (
              <div className={territorioPanoramaTableTotalClass}>
                <table className="w-full min-w-[18rem] border-collapse">
                  <tbody>
                    <tr>
                      <td className={cn(territorioTdClass, 'border-b-0 py-1.5')}>
                        <p className={cn('font-semibold text-text-primary', typographyBodyMediumClass)}>Total</p>
                        <p className={cn('mt-0.5 text-[10px] text-text-muted', typographyBodyMutedClass)}>
                          {totais.municipios} municípios · {totais.cresceu} com avanço
                        </p>
                      </td>
                      <td className={cn(territorioTdClass, 'w-14 border-b-0 py-1.5 text-right tabular-nums font-semibold text-text-primary', typographyBodyClass)}>
                        {formatVotos(totais.totalVotos2022)}
                      </td>
                      <td className={cn(territorioTdClass, 'w-20 border-b-0 px-1 py-1.5')}>
                        <ComparativoBarraCell
                          row={{
                            cidade: 'Total',
                            votos2022: totais.totalVotos2022,
                            expectativa2026: totais.totalExpectativa2026,
                            delta: totais.delta,
                            deltaPercentual: totais.deltaPercentual,
                            tendencia: totais.delta > 0 ? 'cresceu' : totais.delta < 0 ? 'caiu' : 'manteve',
                            liderancas: 0,
                          }}
                        />
                      </td>
                      <td
                        className={cn(
                          territorioTdClass,
                          'w-14 border-b-0 py-1.5 text-right tabular-nums font-bold',
                          totais.delta > 0 ? 'text-emerald-700' : totais.delta < 0 ? 'text-red-700' : 'text-text-primary'
                        )}
                      >
                        {formatVotos(totais.totalExpectativa2026)}
                      </td>
                      <td className={cn(territorioTdClass, 'w-24 border-b-0 py-1.5 text-right')}>
                        <span
                          className={cn(
                            'inline-flex items-center justify-end gap-0.5 tabular-nums text-[11px] font-bold',
                            totais.delta > 0 ? 'text-emerald-600' : totais.delta < 0 ? 'text-red-600' : 'text-text-muted'
                          )}
                        >
                          {totais.delta > 0 ? (
                            <TrendingUp className="h-3 w-3" aria-hidden />
                          ) : totais.delta < 0 ? (
                            <TrendingDown className="h-3 w-3" aria-hidden />
                          ) : null}
                          {totais.delta >= 0 ? '+' : ''}
                          {formatVotos(totais.delta)}
                          {totais.deltaPercentual != null ? (
                            <span className="ml-0.5 font-semibold">{formatPct(totais.deltaPercentual)}</span>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null
          }
          expandAction={
            rowsOrdenadas.length > PREVIEW_ROWS ? (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="shrink-0 text-left text-[12px] font-medium text-[rgb(var(--color-primary))] hover:underline"
              >
                {showAll
                  ? 'Mostrar menos municípios'
                  : `Ver todos os municípios (${rowsOrdenadas.length}) ›`}
              </button>
            ) : null
          }
        >
          <table className="w-full min-w-[18rem] border-collapse">
            <thead className="sticky top-0 z-10 bg-bg-surface">
              <tr>
                <th className={cn(territorioThClass, 'text-left')}>Município</th>
                <th className={cn(territorioThClass, 'w-14 text-right')}>2022</th>
                <th className={cn(territorioThClass, 'w-20 text-center')}> </th>
                <th className={cn(territorioThClass, 'w-14 text-right')}>2026</th>
                <th className={cn(territorioThClass, 'w-24 text-right')}>Variação</th>
              </tr>
            </thead>
            <tbody>
              {rowsVisiveis.length === 0 ? (
                <tr>
                  <td colSpan={5} className={cn('px-4 py-8 text-center', typographyBodyMutedClass)}>
                    Nenhum município neste filtro.
                  </td>
                </tr>
              ) : (
                rowsVisiveis.map((row) => {
                  const cresceu = row.expectativa2026 > row.votos2022
                  const caiu = row.expectativa2026 < row.votos2022
                  return (
                    <tr key={row.cidade} className="border-t border-[rgb(var(--color-border-secondary)/0.25)] hover:bg-bg-app/40">
                      <td className={cn(territorioTdClass, 'min-h-[2rem]', typographyBodyMediumClass)}>
                        <span className="truncate">{row.cidade}</span>
                      </td>
                      <td className={cn(territorioTdClass, 'text-right tabular-nums text-text-secondary', typographyBodyClass)}>
                        {formatVotos(row.votos2022)}
                      </td>
                      <td className={cn(territorioTdClass, 'px-1')}>
                        <ComparativoBarraCell row={row} />
                      </td>
                      <td
                        className={cn(
                          territorioTdClass,
                          'text-right tabular-nums font-medium',
                          cresceu ? 'text-emerald-700' : caiu ? 'text-red-700' : 'text-text-secondary'
                        )}
                      >
                        {formatVotos(row.expectativa2026)}
                      </td>
                      <td className={cn(territorioTdClass, 'text-right')}>
                        <span
                          className={cn(
                            'inline-flex items-center justify-end gap-0.5 tabular-nums text-[11px] font-semibold',
                            cresceu ? 'text-emerald-600' : caiu ? 'text-red-600' : 'text-text-muted'
                          )}
                        >
                          {cresceu ? (
                            <TrendingUp className="h-3 w-3" aria-hidden />
                          ) : caiu ? (
                            <TrendingDown className="h-3 w-3" aria-hidden />
                          ) : null}
                          {row.delta >= 0 ? '+' : ''}
                          {formatVotos(row.delta)}
                          {row.deltaPercentual != null ? (
                            <span className="ml-0.5 font-medium">{formatPct(row.deltaPercentual)}</span>
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </TerritorioPanoramaTableSection>
      )}
    </TerritorioDataPanel>
  )
}
