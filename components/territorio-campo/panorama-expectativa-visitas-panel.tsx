'use client'

import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from 'lucide-react'
import type {
  ExpectativaVisitasMunicipio,
  ExpectativaVisitasPanelModel,
  FaixaCobertura,
  FiltroCobertura,
} from '@/lib/territorio-expectativa-visitas-cobertura'
import {
  FAIXA_COBERTURA_STYLES,
  FAIXAS_FILTRO,
  formatExpectativaCompact,
  formatPesoExpectativaPct,
} from '@/lib/territorio-expectativa-visitas-cobertura'
import {
  typographyBodyClass,
  typographyBodyMediumClass,
  typographyBodyMutedClass,
  typographySectionLabelClass,
} from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

type SortColumn = 'rank' | 'cidade' | 'expectativa' | 'pctPesoExpectativa' | 'visitas' | 'coberturaPct' | 'faixa'

const SORT_LABELS: Record<SortColumn, string> = {
  rank: 'Posição',
  cidade: 'Município',
  expectativa: 'Votos',
  pctPesoExpectativa: '% exp. total',
  visitas: 'Visitas',
  coberturaPct: 'Cobertura',
  faixa: 'Faixa',
}

function faixaRank(faixa: FaixaCobertura): number {
  const index = FAIXAS_FILTRO.indexOf(faixa)
  return index >= 0 ? index : FAIXAS_FILTRO.length
}

function compareMunicipioRows(a: ExpectativaVisitasMunicipio, b: ExpectativaVisitasMunicipio, column: SortColumn): number {
  switch (column) {
    case 'rank':
      return a.gapScore - b.gapScore
    case 'cidade':
      return a.cidade.localeCompare(b.cidade, 'pt-BR')
    case 'expectativa':
      return a.expectativa - b.expectativa
    case 'pctPesoExpectativa':
      return a.pctPesoExpectativa - b.pctPesoExpectativa
    case 'visitas':
      return a.visitas - b.visitas
    case 'coberturaPct':
      return a.coberturaPct - b.coberturaPct
    case 'faixa':
      return faixaRank(a.faixa) - faixaRank(b.faixa)
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
  title,
  children,
}: {
  column: SortColumn
  sortColumn: SortColumn
  sortAsc: boolean
  onSort: (column: SortColumn) => void
  className?: string
  title?: string
  children: ReactNode
}) {
  const active = sortColumn === column
  const nextDirection = active && sortAsc ? 'Z→A' : 'A→Z'
  const headerTitle = title ?? SORT_LABELS[column]

  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex w-full items-center gap-0.5 hover:text-text-primary',
          column === 'cidade' || column === 'faixa' ? 'justify-start' : 'justify-end'
        )}
        title={`Ordenar ${headerTitle} (${nextDirection})`}
        aria-label={`Ordenar ${headerTitle} (${nextDirection})`}
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

function MunicipiosTable({
  rows,
  filtro,
  total,
}: {
  rows: ExpectativaVisitasPanelModel['municipios']
  filtro: FiltroCobertura
  total: number
}) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('expectativa')
  const [sortAsc, setSortAsc] = useState(false)

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortAsc((value) => !value)
      return
    }
    setSortColumn(column)
    setSortAsc(column === 'cidade' || column === 'faixa')
  }

  const rowsOrdenadas = useMemo(() => {
    return [...rows].sort((a, b) => {
      const cmp = compareMunicipioRows(a, b, sortColumn)
      return sortAsc ? cmp : -cmp
    })
  }, [rows, sortColumn, sortAsc])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <p className={cn('mb-2 shrink-0', typographySectionLabelClass)}>
        Municípios ({rows.length}
        {filtro !== 'todos' ? ` de ${total}` : ''})
      </p>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[rgb(var(--color-border-secondary)/0.35)]">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-bg-surface">
            <tr>
              <SortableTh
                column="rank"
                sortColumn={sortColumn}
                sortAsc={sortAsc}
                onSort={toggleSort}
                className={cn('px-2 py-1.5 text-left', typographySectionLabelClass)}
                title="Prioridade (gap)"
              >
                #
              </SortableTh>
              <SortableTh
                column="cidade"
                sortColumn={sortColumn}
                sortAsc={sortAsc}
                onSort={toggleSort}
                className={cn('px-2 py-1.5 text-left', typographySectionLabelClass)}
              >
                Município
              </SortableTh>
              <SortableTh
                column="expectativa"
                sortColumn={sortColumn}
                sortAsc={sortAsc}
                onSort={toggleSort}
                className={cn('px-2 py-1.5 text-right', typographySectionLabelClass)}
              >
                Votos
              </SortableTh>
              <SortableTh
                column="pctPesoExpectativa"
                sortColumn={sortColumn}
                sortAsc={sortAsc}
                onSort={toggleSort}
                className={cn('px-2 py-1.5 text-right', typographySectionLabelClass)}
                title="Percentual da expectativa de votos do município sobre o total estadual"
              >
                % exp. total
              </SortableTh>
              <SortableTh
                column="visitas"
                sortColumn={sortColumn}
                sortAsc={sortAsc}
                onSort={toggleSort}
                className={cn('px-2 py-1.5 text-right', typographySectionLabelClass)}
              >
                Vis.
              </SortableTh>
              <SortableTh
                column="coberturaPct"
                sortColumn={sortColumn}
                sortAsc={sortAsc}
                onSort={toggleSort}
                className={cn('px-2 py-1.5 text-left', typographySectionLabelClass)}
              >
                Cob.
              </SortableTh>
              <SortableTh
                column="faixa"
                sortColumn={sortColumn}
                sortAsc={sortAsc}
                onSort={toggleSort}
                className={cn('px-2 py-1.5 text-left', typographySectionLabelClass)}
              >
                Faixa
              </SortableTh>
            </tr>
          </thead>
          <tbody>
            {rowsOrdenadas.length === 0 ? (
              <tr>
                <td colSpan={7} className={cn('px-3 py-6 text-center', typographyBodyMutedClass)}>
                  Nenhum município neste filtro
                </td>
              </tr>
            ) : (
              rowsOrdenadas.map((row, index) => {
                const st = FAIXA_COBERTURA_STYLES[row.faixa]
                return (
                  <tr key={row.cidade} className="border-t border-[rgb(var(--color-border-secondary)/0.25)]">
                    <td className={cn('px-2 py-1.5 tabular-nums text-text-muted', typographyBodyClass)}>
                      {index + 1}
                    </td>
                    <td className={cn('max-w-[7rem] truncate px-2 py-1.5 font-medium', typographyBodyMediumClass)} title={row.cidade}>
                      {row.cidade}
                    </td>
                    <td className={cn('px-2 py-1.5 text-right tabular-nums', typographyBodyClass)}>
                      {formatExpectativaCompact(row.expectativa)}
                    </td>
                    <td
                      className={cn('px-2 py-1.5 text-right tabular-nums text-text-secondary', typographyBodyClass)}
                      title={`${formatPesoExpectativaPct(row.pctPesoExpectativa)}% da expectativa total`}
                    >
                      {formatPesoExpectativaPct(row.pctPesoExpectativa)}%
                    </td>
                    <td className={cn('px-2 py-1.5 text-right tabular-nums', typographyBodyClass)}>{row.visitas}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full bg-[rgb(var(--color-border-secondary)/0.35)]">
                          <div
                            className={cn('h-full rounded-full', st.bar)}
                            style={{ width: `${Math.min(100, row.coberturaPct)}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-[10px] tabular-nums text-text-muted">{row.coberturaPct}%</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-bold', st.badge)}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CoberturaTerritorialPanel({
  faixas,
  filtro,
  total,
  onFiltroChange,
}: {
  faixas: ExpectativaVisitasPanelModel['coberturaTerritorial']
  filtro: FiltroCobertura
  total: number
  onFiltroChange: (id: FiltroCobertura) => void
}) {
  const barTone = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', gray: 'bg-gray-400', blue: 'bg-blue-500' }
  const todosActive = filtro === 'todos'

  return (
    <div className="flex min-h-0 w-full shrink-0 flex-col self-stretch lg:w-[15rem] xl:w-[17rem]">
      <p className={cn('mb-2 shrink-0', typographySectionLabelClass)}>Cobertura territorial</p>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 rounded-lg border border-[rgb(var(--color-border-secondary)/0.35)] p-3">
        <button
          type="button"
          onClick={() => onFiltroChange('todos')}
          className={cn(
            'rounded-md text-left transition-colors',
            todosActive && 'bg-bg-app ring-1 ring-[rgb(var(--color-border-secondary)/0.55)]'
          )}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn('text-[12px] font-semibold text-text-primary', typographyBodyMediumClass)}>Todos</p>
            <p className="text-sm font-bold tabular-nums text-text-primary">
              {total}{' '}
              <span className="text-[11px] font-normal text-text-muted">(100%)</span>
            </p>
          </div>
          <p className={cn('mt-0.5 text-[10px] text-text-muted', typographyBodyMutedClass)}>
            Todos os municípios monitorados
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--color-border-secondary)/0.35)]">
            <div className={cn('h-full rounded-full', barTone.blue)} style={{ width: '100%' }} />
          </div>
        </button>
        {faixas.map((faixa) => {
          const active = filtro === faixa.id
          return (
            <button
              key={faixa.id}
              type="button"
              onClick={() => onFiltroChange(faixa.id)}
              className={cn(
                'rounded-md text-left transition-colors',
                active && 'bg-bg-app ring-1 ring-[rgb(var(--color-border-secondary)/0.55)]'
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className={cn('text-[12px] font-semibold text-text-primary', typographyBodyMediumClass)}>
                  {faixa.label}
                </p>
                <p className="text-sm font-bold tabular-nums text-text-primary">
                  {faixa.count}{' '}
                  <span className="text-[11px] font-normal text-text-muted">({faixa.percentual}%)</span>
                </p>
              </div>
              <p className={cn('mt-0.5 text-[10px] text-text-muted', typographyBodyMutedClass)}>{faixa.description}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--color-border-secondary)/0.35)]">
                <div className={cn('h-full rounded-full', barTone[faixa.tone])} style={{ width: `${faixa.percentual}%` }} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PanoramaExpectativaVisitasPanel({
  model,
  className,
}: {
  model: ExpectativaVisitasPanelModel
  className?: string
}) {
  const [filtro, setFiltro] = useState<FiltroCobertura>('todos')
  const total = model.municipios.length

  const municipiosFiltrados = useMemo(() => {
    if (filtro === 'todos') return model.municipios
    return model.municipios.filter((m) => m.faixa === filtro)
  }, [model.municipios, filtro])

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
        <MunicipiosTable rows={municipiosFiltrados} filtro={filtro} total={total} />
        <CoberturaTerritorialPanel
          faixas={model.coberturaTerritorial}
          filtro={filtro}
          total={total}
          onFiltroChange={setFiltro}
        />
      </div>
    </div>
  )
}
