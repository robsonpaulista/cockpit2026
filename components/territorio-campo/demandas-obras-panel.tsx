'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
} from 'lucide-react'
import {
  compareTerritorioText,
  TerritorioSortableHeaderButton,
  toggleTerritorioSort,
} from '@/components/territorio-campo/territorio-sortable-header'
import { DemandasObrasExportModal } from '@/components/territorio-campo/demandas-obras-export-modal'
import {
  cidadeDaDemanda,
  filtrarDemandasObrasSheets,
  liderancaDaDemanda,
  normalizarTextoDemanda,
  type CampoDemandaObraRow,
} from '@/lib/campo-demandas-obras'
import { normalizeIptMunicipio } from '@/lib/ipt'
import { cn } from '@/lib/utils'

export type DemandaObraRow = CampoDemandaObraRow

type SortCol = 'cidade' | 'obras'

type GrupoCidade = {
  cidade: string
  cidadeKey: string
  rows: DemandaObraRow[]
}

function formatDataCurta(value?: string | null): string {
  if (!value) return '—'
  const iso = value.includes('T') ? value.slice(0, 10) : value
  const parts = iso.split('-')
  if (parts.length >= 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('pt-BR')
}

function statusBadgeClass(status: string | null | undefined): string {
  const sl = (status || '').toLowerCase().trim()
  if (sl.includes('resolvido') || sl.includes('conclu')) {
    return 'border-emerald-300 bg-emerald-50 text-emerald-900'
  }
  if (sl.includes('andamento') || sl.includes('progresso')) {
    return 'border-amber-300 bg-amber-50 text-amber-950'
  }
  if (sl.includes('encaminhad')) {
    return 'border-sky-300 bg-sky-50 text-sky-950'
  }
  return 'border-card bg-background text-text-secondary'
}

/**
 * Lista todas as obras/demandas da planilha Google Sheets,
 * agrupadas por cidade (Base Eleitoral).
 */
export function DemandasObrasPanel() {
  const [rows, setRows] = useState<DemandaObraRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [sortCol, setSortCol] = useState<SortCol>('cidade')
  const [sortAsc, setSortAsc] = useState(true)
  const [cidadesRecolhidas, setCidadesRecolhidas] = useState<Set<string>>(
    () => new Set(),
  )
  const [initializedCollapse, setInitializedCollapse] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/campo/demands', { cache: 'no-store' })
      const data = (await response.json()) as DemandaObraRow[] | { error?: string }
      if (!response.ok) {
        const msg =
          data && typeof data === 'object' && 'error' in data
            ? data.error
            : 'Erro ao carregar demandas'
        throw new Error(msg || 'Erro ao carregar demandas')
      }
      const list = Array.isArray(data) ? data : []
      setRows(filtrarDemandasObrasSheets(list))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar demandas')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const grupos = useMemo<GrupoCidade[]>(() => {
    const termo = normalizarTextoDemanda(busca)
    const map = new Map<string, GrupoCidade>()

    for (const row of rows) {
      const cidade = cidadeDaDemanda(row)
      const cidadeKey = normalizeIptMunicipio(cidade) || cidade.toLowerCase()
      if (
        termo &&
        !normalizarTextoDemanda(cidade).includes(termo) &&
        !normalizarTextoDemanda(row.title || '').includes(termo) &&
        !normalizarTextoDemanda(liderancaDaDemanda(row)).includes(termo) &&
        !normalizarTextoDemanda(row.status || '').includes(termo) &&
        !normalizarTextoDemanda(row.theme || '').includes(termo)
      ) {
        continue
      }

      const grupo = map.get(cidadeKey)
      if (grupo) grupo.rows.push(row)
      else map.set(cidadeKey, { cidade, cidadeKey, rows: [row] })
    }

    for (const grupo of map.values()) {
      grupo.rows.sort((a, b) =>
        compareTerritorioText(a.title || '', b.title || '', true),
      )
    }

    return Array.from(map.values()).sort((a, b) => {
      if (sortCol === 'obras') {
        const byCount = a.rows.length - b.rows.length
        if (byCount !== 0) return sortAsc ? byCount : -byCount
        return compareTerritorioText(a.cidade, b.cidade, true)
      }
      const byCidade = compareTerritorioText(a.cidade, b.cidade, sortAsc)
      if (byCidade !== 0) return byCidade
      return b.rows.length - a.rows.length
    })
  }, [busca, rows, sortAsc, sortCol])

  useEffect(() => {
    if (initializedCollapse || grupos.length === 0) return
    setCidadesRecolhidas(new Set(grupos.map((g) => g.cidadeKey)))
    setInitializedCollapse(true)
  }, [grupos, initializedCollapse])

  const totalObras = useMemo(
    () => grupos.reduce((sum, g) => sum + g.rows.length, 0),
    [grupos],
  )

  const rowsFiltradas = useMemo(
    () => grupos.flatMap((grupo) => grupo.rows),
    [grupos],
  )

  const todasRecolhidas =
    grupos.length > 0 &&
    grupos.every((grupo) => cidadesRecolhidas.has(grupo.cidadeKey))

  const alternarSort = (column: SortCol) => {
    const next = toggleTerritorioSort(sortCol, sortAsc, column, ['cidade'] as const)
    setSortCol(next.column)
    setSortAsc(next.asc)
  }

  const alternarCidade = (cidadeKey: string) => {
    setCidadesRecolhidas((atuais) => {
      const proximas = new Set(atuais)
      if (proximas.has(cidadeKey)) proximas.delete(cidadeKey)
      else proximas.add(cidadeKey)
      return proximas
    })
  }

  const alternarTodas = () => {
    setCidadesRecolhidas(
      todasRecolhidas ? new Set() : new Set(grupos.map((g) => g.cidadeKey)),
    )
  }

  const filtrosExportResumo = useMemo(
    () =>
      [
        busca.trim() ? `Busca: ${busca.trim()}` : null,
        `Ordenação da lista: ${sortCol === 'obras' ? 'qtd. obras' : 'cidade'} (${sortAsc ? 'A→Z' : 'Z→A'})`,
      ].filter((v): v is string => Boolean(v)),
    [busca, sortAsc, sortCol],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <ClipboardList className="h-4 w-4 text-[#f2d06b]" aria-hidden />
            Obras por cidade
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            Cadastro de Demandas (Google Sheets) · {grupos.length.toLocaleString('pt-BR')}{' '}
            {grupos.length === 1 ? 'cidade' : 'cidades'} ·{' '}
            {totalObras.toLocaleString('pt-BR')}{' '}
            {totalObras === 1 ? 'obra' : 'obras'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary"
              aria-hidden
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cidade, obra, status…"
              className="h-9 w-[220px] rounded-lg border border-[#e8e8e6] bg-[#f7f7f6] pl-8 pr-3 text-xs text-text-primary outline-none focus:border-[#f2d06b]"
            />
          </label>
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={rowsFiltradas.length === 0}
            title="Exportar seleção filtrada (CSV, Excel ou PDF)"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e8e8e6] bg-[#f7f7f6] px-3 text-xs font-medium text-text-primary disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Exportar
          </button>
          <button
            type="button"
            onClick={alternarTodas}
            disabled={grupos.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e8e8e6] bg-[#f7f7f6] px-3 text-xs font-medium text-text-primary disabled:opacity-50"
          >
            {todasRecolhidas ? 'Expandir todas' : 'Recolher todas'}
          </button>
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e8e8e6] bg-[#f7f7f6] px-3 text-xs font-medium text-text-primary disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            Atualizar
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando obras da planilha…
        </div>
      ) : grupos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card px-4 py-12 text-center text-sm text-text-secondary">
          Nenhuma obra encontrada na planilha de demandas.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 px-1">
            <TerritorioSortableHeaderButton
              label="Cidade"
              active={sortCol === 'cidade'}
              asc={sortAsc}
              onClick={() => alternarSort('cidade')}
            />
            <TerritorioSortableHeaderButton
              label="Qtd. obras"
              active={sortCol === 'obras'}
              asc={sortAsc}
              onClick={() => alternarSort('obras')}
            />
          </div>

          {grupos.map((grupo) => {
            const recolhida = cidadesRecolhidas.has(grupo.cidadeKey)
            return (
              <article
                key={grupo.cidadeKey}
                className="overflow-hidden rounded-xl border border-[#e8e8e6] bg-[#f7f7f6] shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8e8e6] bg-[#f7f7f6] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => alternarCidade(grupo.cidadeKey)}
                    className="flex min-w-0 items-center gap-2 text-left"
                    aria-expanded={!recolhida}
                  >
                    {recolhida ? (
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-text-secondary"
                        aria-hidden
                      />
                    ) : (
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-text-secondary"
                        aria-hidden
                      />
                    )}
                    <MapPin className="h-4 w-4 shrink-0 text-[#f2d06b]" aria-hidden />
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {grupo.cidade}
                    </span>
                    <span className="rounded-full border border-[#e8e8e6] bg-white px-2 py-0.5 text-[10px] text-text-secondary">
                      {grupo.rows.length}
                    </span>
                  </button>
                </div>

                {!recolhida ? (
                  <div className="overflow-x-auto bg-white">
                    <table className="w-full min-w-[720px] text-xs">
                      <thead>
                        <tr className="text-text-secondary">
                          <th className="px-4 py-2 text-left font-medium">Obra / solicitação</th>
                          <th className="px-3 py-2 text-left font-medium">Status</th>
                          <th className="px-3 py-2 text-left font-medium">Liderança</th>
                          <th className="px-3 py-2 text-left font-medium">Tema</th>
                          <th className="px-3 py-2 text-left font-medium">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.rows.map((row) => (
                          <tr
                            key={row.id || `${grupo.cidadeKey}-${row.title}`}
                            className="border-t border-card/80"
                          >
                            <td className="max-w-[280px] px-4 py-2.5">
                              <p className="font-medium text-text-primary">{row.title}</p>
                              {row.description ? (
                                <p className="mt-0.5 line-clamp-2 text-[11px] text-text-secondary">
                                  {row.description}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className={cn(
                                  'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                  statusBadgeClass(row.status),
                                )}
                              >
                                {row.status?.trim() || '—'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-text-primary">
                              {liderancaDaDemanda(row)}
                            </td>
                            <td className="px-3 py-2.5 text-text-secondary">
                              {row.theme?.trim() || '—'}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-text-secondary">
                              {formatDataCurta(row.data_demanda || row.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      <DemandasObrasExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        rows={rowsFiltradas}
        cidadesCount={grupos.length}
        filtrosResumo={filtrosExportResumo}
      />
    </div>
  )
}
