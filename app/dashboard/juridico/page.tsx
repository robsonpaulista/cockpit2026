'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Scale,
  Search,
  Loader2,
  RefreshCw,
  Eye,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import {
  JURIDICO_TABLE_SORT_COLUMNS,
  JURIDICO_TABLE_COLUMN_LABELS,
  JURIDICO_EXTRA_SORT_COLUMNS,
  JURIDICO_COLUMN_LABELS,
  sortProcessosDimensao,
  getJuridicoSortLabel,
  isJuridicoTableSortColumn,
  type JuridicoAnySortColumn,
  type JuridicoSortColumn,
} from '@/lib/juridico-processos-sort'
import { JuridicoLinksAcoes } from '@/components/juridico-links-acoes'
import { JuridicoMovimentacoesPanel } from '@/components/juridico-movimentacoes-panel'
import { formatUltimaMovimentacaoExibicao } from '@/lib/juridico-movimentacoes'
import { fetchJuridicoProcessos } from '@/lib/services/juridico-processos'
import type { JuridicoProcessosResponse } from '@/lib/services/juridico-processos'
import type { ProcessoDimensao } from '@/lib/juridico-processos-dimensao'
import { DIMENSAO_PARTY_LABEL } from '@/lib/juridico-processos-dimensao'
import { cn, formatDateShort } from '@/lib/utils'

function formatMoeda(val: number | null): string {
  if (val == null || !Number.isFinite(val)) return '—'
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function statusBadgeClass(status: string | null): string {
  switch (status) {
    case 'Prazo/Intimação':
      return 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200'
    case 'Acompanhar':
      return 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
    case 'Concluso':
      return 'border-blue-500/40 bg-blue-500/10 text-blue-900 dark:text-blue-200'
    case 'Encerrado/Arquivado':
      return 'border-border-card bg-bg-app text-text-secondary'
    case 'Recurso':
      return 'border-purple-500/40 bg-purple-500/10 text-purple-900 dark:text-purple-200'
    default:
      return 'border-border-card bg-bg-app text-text-secondary'
  }
}

function prioridadeBadgeClass(prioridade: string | null): string {
  if (prioridade === 'Alta') {
    return 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200'
  }
  if (prioridade === 'Média') {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
  }
  return 'border-border-card bg-bg-app text-text-secondary'
}

function poloLabel(polo: ProcessoDimensao['poloDimensao']): string {
  if (polo === 'autor') return 'Autor'
  if (polo === 'requerido') return 'Requerido'
  return 'Autor e requerido'
}

export default function JuridicoPage() {
  const [data, setData] = useState<JuridicoProcessosResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterArea, setFilterArea] = useState('all')
  const [filterPrioridade, setFilterPrioridade] = useState('all')
  const [filterAtualizado, setFilterAtualizado] = useState(false)
  const [detalhe, setDetalhe] = useState<ProcessoDimensao | null>(null)
  const [sortColumn, setSortColumn] = useState<JuridicoAnySortColumn>('processo')
  const [sortAsc, setSortAsc] = useState(true)

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchJuridicoProcessos({
        q: searchDebounced || undefined,
        status: filterStatus,
        area: filterArea,
        prioridade: filterPrioridade,
      })
      setData(res)
      return res
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
      setData(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [searchDebounced, filterStatus, filterArea, filterPrioridade])

  const handleMovimentacaoSalva = useCallback(async () => {
    const res = await carregar()
    if (!res) return
    setDetalhe((prev) => {
      if (!prev) return null
      return res.processos.find((x) => x.id === prev.id) ?? prev
    })
  }, [carregar])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const processos = useMemo(() => {
    const lista = data?.processos ?? []
    if (!filterAtualizado) return lista
    return lista.filter((p) => p.movimentacaoAtualizadaEquipe)
  }, [data?.processos, filterAtualizado])
  const kpis = data?.kpis
  const totalAtualizados = kpis?.atualizadosEquipe ?? 0

  const toggleSort = useCallback((col: JuridicoAnySortColumn) => {
    setSortColumn((prev) => {
      if (prev === col) {
        setSortAsc((a) => !a)
        return prev
      }
      setSortAsc(true)
      return col
    })
  }, [])

  const processosOrdenados = useMemo(
    () => sortProcessosDimensao(processos, sortColumn, sortAsc),
    [processos, sortColumn, sortAsc]
  )

  const temFiltrosAtivos = useMemo(
    () =>
      searchDebounced.length > 0 ||
      filterStatus !== 'all' ||
      filterArea !== 'all' ||
      filterPrioridade !== 'all' ||
      filterAtualizado,
    [searchDebounced, filterStatus, filterArea, filterPrioridade, filterAtualizado]
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-6 lg:px-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <Scale className="h-5 w-5 text-accent-gold" aria-hidden />
              Jurídico — Processos
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-text-secondary">
              Processos em que <strong className="text-text-primary">{DIMENSAO_PARTY_LABEL}</strong> figura
              como autor ou requerido (base: planilha Base Organizada). Ao expandir a linha, o andamento é
              Use os links <strong className="text-text-primary">DJEN</strong> e <strong className="text-text-primary">Tribunal</strong> na coluna Consultas.
              Processos com movimentação registrada pela equipe exibem um indicador discreto ao lado do número.
              Detalhes no ícone do olho.
            </p>
            {data?.geradoEm ? (
              <p className="mt-1 text-xs text-text-secondary">
                Dados atualizados em {formatDateShort(data.geradoEm)}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={loading}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-border-card px-3 py-2 text-sm text-text-secondary transition hover:text-text-primary disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
            {error.includes('processos-dimensao') || data?.total === 0 ? (
              <p className="mt-2 text-xs">
                Execute na raiz do projeto:{' '}
                <code className="rounded bg-black/10 px-1">npm run processos-dimensao:json</code>
              </p>
            ) : null}
          </div>
        ) : null}

        {kpis ? (
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
            <KpiCard label="Total" value={kpis.total} />
            <KpiCard label="Acompanhar" value={kpis.acompanhar} tone="amber" />
            <KpiCard label="Prazo / intimação" value={kpis.prazoIntimacao} tone="red" />
            <KpiCard label="Prioridade alta" value={kpis.prioridadeAlta} tone="red" />
            <KpiCard label="Conclusos" value={kpis.conclusos} tone="blue" />
            <KpiCard label="Encerrados" value={kpis.encerrados} />
            <KpiCard label="Atualizados equipe" value={kpis.atualizadosEquipe} />
          </div>
        ) : null}

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border-card bg-bg-surface p-4">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
              Buscar
            </span>
            <span className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Processo, parte, município, movimentação…"
                className="w-full rounded-lg border border-border-card bg-bg-app py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              />
            </span>
          </label>

          <FilterSelect
            label="Status"
            value={filterStatus}
            onChange={setFilterStatus}
            options={data?.filtros.status ?? []}
          />
          <FilterSelect
            label="Área"
            value={filterArea}
            onChange={setFilterArea}
            options={data?.filtros.areas ?? []}
          />
          <FilterSelect
            label="Prioridade"
            value={filterPrioridade}
            onChange={setFilterPrioridade}
            options={data?.filtros.prioridades ?? []}
          />

          <button
            type="button"
            onClick={() => setFilterAtualizado((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 self-end rounded-lg border px-3 py-2 text-xs transition',
              filterAtualizado
                ? 'border-accent-gold/40 bg-accent-gold/5 text-text-primary'
                : 'border-border-card text-text-secondary hover:text-text-primary'
            )}
            title="Mostrar só processos com movimentação registrada pela equipe no Cockpit"
          >
            Só atualizados
            {totalAtualizados > 0 ? (
              <span className="tabular-nums text-[10px] text-text-secondary">({totalAtualizados})</span>
            ) : null}
          </button>

          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
              Ordenar por (outros campos)
            </span>
            <select
              value={isJuridicoTableSortColumn(sortColumn) ? '' : sortColumn}
              onChange={(e) => {
                const col = e.target.value as JuridicoSortColumn | ''
                if (col) {
                  setSortColumn(col)
                  setSortAsc(true)
                } else {
                  setSortColumn('processo')
                  setSortAsc(true)
                }
              }}
              className="min-w-[11rem] rounded-lg border border-border-card bg-bg-app px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            >
              <option value="">— Coluna da tabela —</option>
              {JURIDICO_EXTRA_SORT_COLUMNS.map((col) => (
                <option key={col} value={col}>
                  {JURIDICO_COLUMN_LABELS[col]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setSortAsc((a) => !a)}
            className="inline-flex items-center gap-1.5 self-end rounded-lg border border-border-card px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
            title={sortAsc ? 'Ordem crescente (A→Z)' : 'Ordem decrescente (Z→A)'}
          >
            {sortAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            {sortAsc ? 'A→Z' : 'Z→A'}
          </button>

          {temFiltrosAtivos ? (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setFilterStatus('all')
                setFilterArea('all')
                setFilterPrioridade('all')
                setFilterAtualizado(false)
              }}
              className="rounded-lg border border-border-card px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border-card bg-bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-card px-4 py-3">
            <p className="text-sm text-text-secondary">
              {loading ? 'Carregando…' : `${processos.length} processo(s) na lista`}
            </p>
            {!loading && processos.length > 0 ? (
              <p className="text-xs text-text-secondary">
                Ordenado por <strong className="text-text-primary">{getJuridicoSortLabel(sortColumn)}</strong>
                {' '}
                ({sortAsc ? 'A→Z' : 'Z→A'})
                {totalAtualizados > 0 ? (
                  <span className="text-text-secondary/80">
                    {' '}
                    · <span className="text-emerald-600 dark:text-emerald-400">●</span> = atualizado pela equipe
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>

          {loading && !data ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />
            </div>
          ) : processos.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-text-secondary">
              Nenhum processo encontrado com os filtros atuais.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border-card bg-bg-app/60 text-xs uppercase tracking-wide text-text-secondary">
                    {JURIDICO_TABLE_SORT_COLUMNS.map((col) => (
                      <SortableTh
                        key={col}
                        label={JURIDICO_TABLE_COLUMN_LABELS[col]}
                        active={sortColumn === col}
                        asc={sortAsc}
                        alignRight={col === 'valorExibido'}
                        onClick={() => toggleSort(col)}
                      />
                    ))}
                    <th className="px-3 py-3 font-medium min-w-[8.5rem]">Consultas</th>
                    <th className="px-3 py-3 font-medium w-12" />
                  </tr>
                </thead>
                <tbody>
                  {processosOrdenados.map((p) => (
                    <ProcessoRow key={p.id} processo={p} onDetalhe={() => setDetalhe(p)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {detalhe ? (
        <DetalheModal
          processo={detalhe}
          onClose={() => setDetalhe(null)}
          onMovimentacaoSalva={handleMovimentacaoSalva}
          statusOptions={data?.filtros.status ?? []}
        />
      ) : null}
    </div>
  )
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'amber' | 'red' | 'blue'
}) {
  const valueClass =
    tone === 'red'
      ? 'text-red-700 dark:text-red-300'
      : tone === 'amber'
        ? 'text-amber-800 dark:text-amber-200'
        : tone === 'blue'
          ? 'text-blue-800 dark:text-blue-300'
          : 'text-text-primary'

  return (
    <div className="rounded-2xl border border-border-card bg-bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums', valueClass)}>{value}</p>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[9rem] rounded-lg border border-border-card bg-bg-app px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
      >
        <option value="all">Todos</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  )
}

function SortableTh({
  label,
  active,
  asc,
  alignRight,
  onClick,
}: {
  label: string
  active: boolean
  asc: boolean
  alignRight?: boolean
  onClick: () => void
}) {
  return (
    <th className={cn('whitespace-nowrap px-3 py-3 font-medium', alignRight && 'text-right')}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-text-primary',
          alignRight && 'ml-auto',
          active ? 'text-text-primary' : ''
        )}
        title={`Ordenar ${label} (${active && !asc ? 'A→Z' : 'Z→A'})`}
      >
        {label}
        {active ? (
          asc ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        )}
      </button>
    </th>
  )
}

function ProcessoRow({
  processo: p,
  onDetalhe,
}: {
  processo: ProcessoDimensao
  onDetalhe: () => void
}) {
  const atualizado = Boolean(p.movimentacaoAtualizadaEquipe)
  const atualizadoLabel = p.movimentacaoAtualizadaEm
    ? `Atualizado pela equipe em ${formatDateShort(p.movimentacaoAtualizadaEm.slice(0, 10))}`
    : 'Atualizado pela equipe no Cockpit'

  return (
      <tr className="border-b border-border-card/80 hover:bg-bg-app/40">
        <td className="px-3 py-3">
          <div className="flex items-start gap-2">
            {atualizado ? (
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                title={atualizadoLabel}
                aria-label={atualizadoLabel}
              />
            ) : (
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0" aria-hidden />
            )}
            <div className="min-w-0">
              <div className="font-medium text-text-primary">{p.processo}</div>
              {p.acao ? <div className="text-xs text-text-secondary">{p.acao}</div> : null}
            </div>
          </div>
        </td>
        <td className="px-3 py-3">
          <span
            className={cn(
              'inline-block rounded-md border px-2 py-0.5 text-xs font-medium',
              statusBadgeClass(p.status)
            )}
          >
            {p.status ?? '—'}
          </span>
        </td>
        <td className="px-3 py-3">
          <span
            className={cn(
              'inline-block rounded-md border px-2 py-0.5 text-xs font-medium',
              prioridadeBadgeClass(p.prioridade)
            )}
          >
            {p.prioridade ?? '—'}
          </span>
        </td>
        <td className="px-3 py-3 text-text-secondary">{p.area ?? '—'}</td>
        <td className="max-w-[10rem] px-3 py-3 text-xs text-text-secondary">
          <span className="block truncate" title={p.orgaoJulgador ?? undefined}>
            {p.orgaoJulgador ?? '—'}
          </span>
          {p.varaOrigem ? (
            <span className="block truncate text-[10px] text-text-secondary/80" title={p.varaOrigem}>
              {p.varaOrigem}
            </span>
          ) : null}
        </td>
        <td className="px-3 py-3 text-xs text-text-secondary">{poloLabel(p.poloDimensao)}</td>
        <td className="px-3 py-3 text-text-secondary">{p.municipioOrigem ?? '—'}</td>
        <td className="max-w-[12rem] px-3 py-3 text-xs">
          <span
            className={cn(
              atualizado
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-text-secondary'
            )}
          >
            {formatUltimaMovimentacaoExibicao(p.ultimaMovimentacao, p.dataConsulta)}
          </span>
        </td>
        <td className="px-3 py-3 text-right tabular-nums text-text-primary">
          {formatMoeda(p.valorAtualizado ?? p.valorRisco)}
        </td>
        <td className="px-3 py-2">
          <JuridicoLinksAcoes processo={p} />
        </td>
        <td className="px-2 py-3">
          <button
            type="button"
            onClick={onDetalhe}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-app hover:text-accent-gold"
            title="Ver detalhes da planilha"
          >
            <Eye className="h-4 w-4" />
          </button>
        </td>
      </tr>
  )
}

function Campo({
  label,
  value,
  multiline,
}: {
  label: string
  value: string | null | undefined
  multiline?: boolean
}) {
  if (!value) return null
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={cn('mt-0.5 text-text-primary', multiline && 'whitespace-pre-wrap')}>{value}</p>
    </div>
  )
}

function DetalheModal({
  processo: p,
  onClose,
  onMovimentacaoSalva,
  statusOptions,
}: {
  processo: ProcessoDimensao
  onClose: () => void
  onMovimentacaoSalva: () => void | Promise<void>
  statusOptions: string[]
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border-card bg-bg-surface shadow-xl">
        <div className="flex items-start justify-between border-b border-border-card px-5 py-4">
          <div className="min-w-0 pr-4">
            <h2 className="text-lg font-semibold text-text-primary">{p.processo}</h2>
            <p className="mt-1 text-sm text-text-secondary">{p.acao}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={cn('rounded-md border px-2 py-0.5 text-xs', statusBadgeClass(p.status))}>
                {p.status}
              </span>
              <span
                className={cn('rounded-md border px-2 py-0.5 text-xs', prioridadeBadgeClass(p.prioridade))}
              >
                {p.prioridade}
              </span>
              <span className="rounded-md border border-border-card px-2 py-0.5 text-xs text-text-secondary">
                {poloLabel(p.poloDimensao)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary hover:bg-bg-app hover:text-text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
          <div className="rounded-xl border border-border-card bg-bg-app/40 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              Consultas externas
            </p>
            <JuridicoLinksAcoes processo={p} buscarUltimaDjen className="justify-start" />
            <p className="mt-2 text-[10px] text-text-secondary">
              DJEN abre a certidão PDF da publicação mais recente. Tribunal abre a consulta pública (Themis, TRF1,
              etc.).
            </p>
          </div>
          <JuridicoMovimentacoesPanel
            processo={p}
            statusOptions={statusOptions}
            onAtualizado={() => void onMovimentacaoSalva()}
          />
          <SecaoDetalhe titulo="Partes">
            <Campo label="Autor" value={p.autor} />
            <Campo label="Requerido" value={p.requerido} />
          </SecaoDetalhe>
          <SecaoDetalhe titulo="Tramitação">
            <Campo label="Área" value={p.area} />
            <Campo label="Órgão julgador" value={p.orgaoJulgador} />
            <Campo label="Vara / origem" value={p.varaOrigem} />
            <Campo label="Município" value={p.municipioOrigem} />
            <Campo
              label="Última movimentação (atual)"
              value={formatUltimaMovimentacaoExibicao(p.ultimaMovimentacao, p.dataConsulta)}
            />
          </SecaoDetalhe>
          <SecaoDetalhe titulo="Riscos e valores">
            <Campo label="Valor atualizado" value={formatMoeda(p.valorAtualizado)} />
            <Campo label="Valor / risco" value={formatMoeda(p.valorRisco)} />
            <Campo label="Risco financeiro" value={p.riscoFinanceiro} />
            <Campo label="Risco patrimonial" value={p.riscoPatrimonial} />
            <Campo label="Risco jurídico" value={p.riscoJuridico} />
            <Campo label="Ranking estratégico" value={p.rankingEstrategico?.toString() ?? null} />
          </SecaoDetalhe>
          {(p.proximaAcao || p.prazoInterno || p.responsavel) && (
            <SecaoDetalhe titulo="Gestão">
              <Campo label="Próxima ação" value={p.proximaAcao} />
              <Campo label="Prazo interno" value={p.prazoInterno} />
              <Campo label="Responsável" value={p.responsavel} />
            </SecaoDetalhe>
          )}
          {(p.tituloEstrategico || p.porQueCritico || p.acaoRecomendada) && (
            <SecaoDetalhe titulo="Análise estratégica">
              <Campo label="Título" value={p.tituloEstrategico} />
              <Campo label="Por que é crítico" value={p.porQueCritico} multiline />
              <Campo label="Ação recomendada" value={p.acaoRecomendada} multiline />
            </SecaoDetalhe>
          )}
          {p.observacoes ? (
            <SecaoDetalhe titulo="Observações">
              <p className="whitespace-pre-wrap text-text-primary">{p.observacoes}</p>
            </SecaoDetalhe>
          ) : null}
        </div>

        <div className="border-t border-border-card px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-border-card py-2 text-sm font-medium text-text-primary hover:bg-bg-app"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

function SecaoDetalhe({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {titulo}
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  )
}
