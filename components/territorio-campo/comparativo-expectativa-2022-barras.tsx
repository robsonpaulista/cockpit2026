'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileSpreadsheet,
  FileText,
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
  exportPotencialEleitoralToPdf,
  exportPotencialEleitoralToXlsx,
} from '@/lib/potencial-eleitoral-export'
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

type SortColumn = 'cidade' | 'votos2022' | 'barra' | 'expectativa2026' | 'delta'

const SORT_LABELS: Record<SortColumn, string> = {
  cidade: 'Município',
  votos2022: '2022',
  barra: 'Comparativo',
  expectativa2026: '2026',
  delta: 'Variação',
}

function compareRows(a: ComparativoExpectativa2022Row, b: ComparativoExpectativa2022Row, column: SortColumn): number {
  switch (column) {
    case 'cidade':
      return a.cidade.localeCompare(b.cidade, 'pt-BR')
    case 'votos2022':
      return a.votos2022 - b.votos2022
    case 'expectativa2026':
      return a.expectativa2026 - b.expectativa2026
    case 'delta':
      return a.delta - b.delta
    case 'barra': {
      const pctA = a.deltaPercentual ?? (a.delta === 0 ? 0 : a.delta > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY)
      const pctB = b.deltaPercentual ?? (b.delta === 0 ? 0 : b.delta > 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY)
      if (pctA !== pctB) return pctA - pctB
      return a.delta - b.delta
    }
    default:
      return 0
  }
}

function SortableTh({
  column,
  sortColumn,
  sortAsc,
  onSort,
  className,
  children,
}: {
  column: SortColumn
  sortColumn: SortColumn
  sortAsc: boolean
  onSort: (column: SortColumn) => void
  className?: string
  children: ReactNode
}) {
  const active = sortColumn === column
  const nextDirection = active && sortAsc ? 'Z→A' : 'A→Z'

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex w-full items-center gap-0.5 hover:text-text-primary',
          column === 'barra' ? 'justify-center' : column === 'cidade' ? 'justify-start' : 'justify-end'
        )}
        title={`Ordenar ${SORT_LABELS[column]} (${nextDirection})`}
        aria-label={`Ordenar ${SORT_LABELS[column]} (${nextDirection})`}
      >
        <span>{children}</span>
        {active ? (
          sortAsc ? (
            <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 shrink-0 opacity-45" aria-hidden />
        )}
      </button>
    </th>
  )
}

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
  const [sortColumn, setSortColumn] = useState<SortColumn>('expectativa2026')
  const [sortAsc, setSortAsc] = useState(false)
  const [exportBusy, setExportBusy] = useState<'idle' | 'xlsx' | 'pdf'>('idle')

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortAsc((value) => !value)
      return
    }
    setSortColumn(column)
    setSortAsc(column === 'cidade')
  }

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

  const rowsOrdenadas = useMemo(() => {
    return [...rowsFiltradas].sort((a, b) => {
      const cmp = compareRows(a, b, sortColumn)
      return sortAsc ? cmp : -cmp
    })
  }, [rowsFiltradas, sortColumn, sortAsc])

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

  const exportOptions = useMemo(
    () => ({
      rows: rowsOrdenadas,
      totais,
      cenarioLabel,
      cargoFiltro,
    }),
    [rowsOrdenadas, totais, cenarioLabel, cargoFiltro],
  )

  const handleExportXlsx = () => {
    if (rowsOrdenadas.length === 0 || exportBusy !== 'idle') return
    setExportBusy('xlsx')
    try {
      exportPotencialEleitoralToXlsx(exportOptions)
    } finally {
      setExportBusy('idle')
    }
  }

  const handleExportPdf = () => {
    if (rowsOrdenadas.length === 0 || exportBusy !== 'idle') return
    setExportBusy('pdf')
    try {
      exportPotencialEleitoralToPdf(exportOptions)
    } finally {
      setExportBusy('idle')
    }
  }

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
          <div className="flex flex-wrap items-center justify-end gap-2">
            {cargoFiltro && onClearCargoFiltro ? (
              <TerritorioTextButton onClick={onClearCargoFiltro}>Limpar filtro</TerritorioTextButton>
            ) : null}
            {view === 'tabela' ? (
              <>
                <button
                  type="button"
                  onClick={handleExportXlsx}
                  disabled={rowsOrdenadas.length === 0 || exportBusy !== 'idle'}
                  title="Exportar tabela completa para Excel"
                  className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--color-border-secondary)/0.7)] bg-bg-app px-2 py-1 text-[11px] font-medium text-text-primary transition-colors hover:bg-bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportBusy === 'xlsx' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
                  )}
                  Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={rowsOrdenadas.length === 0 || exportBusy !== 'idle'}
                  title="Exportar tabela completa para PDF"
                  className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--color-border-secondary)/0.7)] bg-bg-app px-2 py-1 text-[11px] font-medium text-text-primary transition-colors hover:bg-bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {exportBusy === 'pdf' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <FileText className="h-3.5 w-3.5" aria-hidden />
                  )}
                  PDF
                </button>
              </>
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
                <SortableTh
                  column="cidade"
                  sortColumn={sortColumn}
                  sortAsc={sortAsc}
                  onSort={toggleSort}
                  className={cn(territorioThClass, 'text-left')}
                >
                  Município
                </SortableTh>
                <SortableTh
                  column="votos2022"
                  sortColumn={sortColumn}
                  sortAsc={sortAsc}
                  onSort={toggleSort}
                  className={cn(territorioThClass, 'w-14 text-right')}
                >
                  2022
                </SortableTh>
                <SortableTh
                  column="barra"
                  sortColumn={sortColumn}
                  sortAsc={sortAsc}
                  onSort={toggleSort}
                  className={cn(territorioThClass, 'w-20 text-center')}
                >
                  Δ%
                </SortableTh>
                <SortableTh
                  column="expectativa2026"
                  sortColumn={sortColumn}
                  sortAsc={sortAsc}
                  onSort={toggleSort}
                  className={cn(territorioThClass, 'w-14 text-right')}
                >
                  2026
                </SortableTh>
                <SortableTh
                  column="delta"
                  sortColumn={sortColumn}
                  sortAsc={sortAsc}
                  onSort={toggleSort}
                  className={cn(territorioThClass, 'w-24 text-right')}
                >
                  Variação
                </SortableTh>
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
