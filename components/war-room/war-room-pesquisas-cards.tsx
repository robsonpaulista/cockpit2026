'use client'

import { ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  andamentoAtivos,
  type WarRoomPesquisaAndamento,
} from '@/lib/war-room/pesquisas-andamento'
import {
  deletePesquisaAndamento,
  fetchPesquisasAndamento,
} from '@/lib/war-room/pesquisas-andamento-client'
import {
  buildWarRoomPesquisasConsolidadas,
  type WarRoomPesquisaConsolidadaReal,
} from '@/lib/war-room/pesquisas-consolidadas'
import { resolveCandidatoIpt, type PollIptRow } from '@/lib/ipt-pesquisa'
import {
  buildPesquisasDesempenhoKpis,
  calcPesquisasDesempenho,
} from '@/lib/war-room/pesquisas-desempenho'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import { WarRoomPesquisaAndamentoModal } from '@/components/war-room/war-room-pesquisa-andamento-modal'
import { WarRoomPesquisaRankingModal } from '@/components/war-room/war-room-pesquisa-ranking-modal'
import { WarRoomPesquisasDesempenhoView } from '@/components/war-room/war-room-pesquisas-desempenho-view'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomViewMode } from '@/components/war-room/war-room-view-mode-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { cn } from '@/lib/utils'

const HIGHLIGHTS_COUNT = 3
const LIST_VISIBLE = 8

type PesquisaFiltro = 'finalizadas' | 'andamento' | 'desempenho'

const FILTRO_OPCOES: Array<{ id: PesquisaFiltro; label: string }> = [
  { id: 'finalizadas', label: 'Finalizadas' },
  { id: 'andamento', label: 'Em andamento' },
  { id: 'desempenho', label: 'Desempenho' },
]

const KPI_TONES = ['gold', 'slate', 'mist'] as const

function formatPct0(value: number): string {
  return `${Math.round(value)}%`
}

function formatPosicao(
  value: number | null | undefined,
  naoPontuou?: boolean,
): string {
  if (naoPontuou) return 'NP'
  if (value == null || !Number.isFinite(value) || value < 1) return '—'
  return `${Math.round(value)}º`
}

function shortCityLabel(cidade: string): string {
  const upper = cidade.trim().toUpperCase()
  if (upper.length <= 14) return upper
  const parts = upper.split(/\s+/)
  if (parts.length >= 2) {
    const first = parts[0].length > 4 ? `${parts[0].slice(0, 3)}.` : parts[0]
    return `${first} ${parts.slice(1).join(' ')}`.slice(0, 16)
  }
  return upper.slice(0, 14)
}

function SinalAndamento({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={cn(
        'wr-pesquisas-clean__live',
        compact && 'wr-pesquisas-clean__live--compact',
      )}
      title="Pesquisa em andamento"
    >
      <span className="wr-pesquisas-clean__live-dot" aria-hidden />
      {compact ? null : <span className="wr-pesquisas-clean__live-text">Em campo</span>}
    </span>
  )
}

/** Pesquisas consolidadas — filtros clean + finalizadas / em andamento / desempenho. */
export function WarRoomPesquisasConsolidadasCard({ className }: { className?: string }) {
  const { register, reportChange } = useWarRoomRefresh()
  const change = useWarRoomCardChange('pesquisas')
  const { isDesempenho, setViewMode } = useWarRoomViewMode()
  const [rows, setRows] = useState<WarRoomPesquisaConsolidadaReal[]>([])
  const [pollsRaw, setPollsRaw] = useState<PollIptRow[]>([])
  const [candidatoFoco, setCandidatoFoco] = useState(() => resolveCandidatoIpt())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [andamentoAll, setAndamentoAll] = useState<WarRoomPesquisaAndamento[]>([])
  const [andamentoLoading, setAndamentoLoading] = useState(true)
  const [andamentoError, setAndamentoError] = useState<string | null>(null)
  const [localFiltro, setLocalFiltro] = useState<PesquisaFiltro>('finalizadas')
  const filtro: PesquisaFiltro = isDesempenho ? 'desempenho' : localFiltro
  const [rankingModal, setRankingModal] = useState<WarRoomPesquisaConsolidadaReal | null>(null)
  const [andamentoModal, setAndamentoModal] = useState<WarRoomPesquisaAndamento | null | undefined>(
    undefined,
  )
  const [removingId, setRemovingId] = useState<string | null>(null)

  const selectFiltro = useCallback(
    (id: PesquisaFiltro) => {
      if (id === 'desempenho') {
        setViewMode('desempenho')
        return
      }
      setViewMode('padrao')
      setLocalFiltro(id)
    },
    [setViewMode],
  )

  const andamentoRows = useMemo(() => andamentoAtivos(andamentoAll), [andamentoAll])

  const loadAndamento = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setAndamentoLoading(true)
    const result = await fetchPesquisasAndamento()
    setAndamentoAll(result.items)
    setAndamentoError(result.error ?? null)
    if (!silent) setAndamentoLoading(false)
  }, [])

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const foco = resolveCandidatoIpt()
      setCandidatoFoco(foco)
      const res = await fetch('/api/pesquisa?limit=5000', { cache: 'no-store' })
      if (!res.ok) throw new Error('pesquisa')
      const data = (await res.json()) as PollIptRow[]
      const polls = Array.isArray(data) ? data : []
      setPollsRaw(polls)
      const built = buildWarRoomPesquisasConsolidadas(polls, foco, 200)
      setRows(built)
    } catch {
      if (!silent) {
        setRows([])
        setPollsRaw([])
        setError('Não foi possível carregar as pesquisas.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load({ silent: false })
    void loadAndamento({ silent: false })
  }, [load, loadAndamento])

  useEffect(() => {
    return register('pesquisas', async ({ silent }) => {
      await Promise.all([load({ silent }), loadAndamento({ silent })])
    })
  }, [register, load, loadAndamento])

  const desempenhoKpis = useMemo(() => {
    if (pollsRaw.length === 0) return []
    return buildPesquisasDesempenhoKpis(
      calcPesquisasDesempenho(pollsRaw, candidatoFoco),
    )
  }, [pollsRaw, candidatoFoco])

  const snapshotLines = useMemo(
    () => [
      ...rows.map(
        (r) =>
          `${r.id}\t${r.cidade}\t${r.jadyelPosicao ?? ''}\t${r.jadyelPct ?? ''}\t${r.liderPct}\t${r.diferencaPp ?? ''}`,
      ),
      ...andamentoRows.map(
        (r) => `and:${r.id}\t${r.cidade}\t${r.instituto}\t${r.data}\t${r.status}`,
      ),
    ],
    [rows, andamentoRows],
  )

  const { changedKeys } = useWarRoomSnapshot({
    cardId: 'pesquisas',
    lines: loading && rows.length === 0 && andamentoLoading ? null : snapshotLines,
    noun: 'pesquisa',
    ready: !loading || rows.length > 0 || !andamentoLoading,
  })

  useEffect(() => {
    reportChange('pesquisas', null)
  }, [isDesempenho, reportChange])

  const changedSet = useMemo(() => new Set(changedKeys), [changedKeys])

  const highlights = useMemo(() => rows.slice(0, HIGHLIGHTS_COUNT), [rows])
  const andamentoHighlights = useMemo(
    () => andamentoRows.slice(0, HIGHLIGHTS_COUNT),
    [andamentoRows],
  )

  const finalizadasList = useMemo(() => rows.slice(0, LIST_VISIBLE), [rows])
  const andamentoList = useMemo(
    () => andamentoRows.slice(0, LIST_VISIBLE),
    [andamentoRows],
  )

  const showFinalizadas = filtro === 'finalizadas'
  const showAndamento = filtro === 'andamento'
  const showDesempenho = filtro === 'desempenho'
  const showKpis = filtro === 'finalizadas'

  const emptyFinalizadas = !loading && rows.length === 0
  const emptyAndamento = !andamentoLoading && andamentoList.length === 0

  const openIncluir = () => {
    selectFiltro('andamento')
    setAndamentoModal(null)
  }

  const handleAndamentoSaved = (item: WarRoomPesquisaAndamento) => {
    setAndamentoAll((prev) => {
      const without = prev.filter((r) => r.id !== item.id)
      return [item, ...without]
    })
    setAndamentoModal(undefined)
    selectFiltro('andamento')
  }

  const handleRemoveAndamento = async (row: WarRoomPesquisaAndamento) => {
    setRemovingId(row.id)
    const result = await deletePesquisaAndamento(row.id)
    setRemovingId(null)
    if (result.error) {
      setAndamentoError(result.error)
      return
    }
    setAndamentoAll((prev) => prev.filter((r) => r.id !== row.id))
  }

  return (
    <section
      id="wr-pesquisas"
      className={cn('wr-pesquisas-clean', 'wr-cell--pesquisas', className)}
      aria-label="Pesquisas eleitorais"
    >
      <header className="wr-pesquisas-clean__header wr-pesquisas-clean__header--filtros">
        <div className="wr-pesquisas-clean__title-row">
          <div>
            <h2 className="wr-pesquisas-clean__heading">Pesquisas eleitorais</h2>
            <p className="wr-pesquisas-clean__sub">
              {showDesempenho
                ? 'Cobertura · top 5 · eleitorado · votos válidos'
                : showAndamento
                  ? 'Campo em aberto · data · instituto · cidade'
                  : 'Resultados e campo · Votos válidos'}
            </p>
          </div>
          {change ? <WarRoomChangeBadge change={change} /> : null}
        </div>
        <div className="wr-pesquisas-clean__toolbar">
          <div
            className="wr-pesquisas-clean__filtros"
            role="group"
            aria-label="Filtrar pesquisas"
          >
            {FILTRO_OPCOES.map((opcao) => (
              <button
                key={opcao.id}
                type="button"
                aria-pressed={filtro === opcao.id}
                className={cn(
                  'wr-pesquisas-clean__filtro',
                  filtro === opcao.id && 'wr-pesquisas-clean__filtro--ativo',
                )}
                onClick={() => selectFiltro(opcao.id)}
              >
                {opcao.id === 'andamento' && andamentoRows.length > 0 ? (
                  <SinalAndamento compact />
                ) : null}
                {opcao.label}
                {opcao.id === 'andamento' && andamentoRows.length > 0 ? (
                  <span className="wr-pesquisas-clean__filtro-count tabular-nums">
                    {andamentoRows.length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {!showDesempenho ? (
            <button
              type="button"
              className="wr-pesquisas-clean__incluir"
              onClick={openIncluir}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              Incluir
            </button>
          ) : null}
        </div>
      </header>

      {loading && rows.length === 0 && filtro !== 'andamento' ? (
        <div className="wr-pesquisas-clean__state">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--wr-muted)]" strokeWidth={1.5} />
        </div>
      ) : showDesempenho ? (
        pollsRaw.length === 0 ? (
          <p className="wr-pesquisas-clean__state">
            {error ?? 'Nenhuma pesquisa para calcular o desempenho.'}
          </p>
        ) : (
          <WarRoomPesquisasDesempenhoView kpis={desempenhoKpis} />
        )
      ) : emptyFinalizadas && filtro === 'finalizadas' ? (
        <p className="wr-pesquisas-clean__state">
          {error ?? 'Nenhuma pesquisa finalizada no momento.'}
        </p>
      ) : andamentoLoading && filtro === 'andamento' && andamentoList.length === 0 ? (
        <div className="wr-pesquisas-clean__state">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--wr-muted)]" strokeWidth={1.5} />
        </div>
      ) : emptyAndamento && filtro === 'andamento' ? (
        <div className="wr-pesquisas-clean__state wr-pesquisas-clean__state--stack">
          <p>{andamentoError ?? 'Nenhuma pesquisa em andamento.'}</p>
          <button
            type="button"
            className="wr-pesquisas-clean__incluir wr-pesquisas-clean__incluir--cta"
            onClick={openIncluir}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            Incluir pesquisa em campo
          </button>
        </div>
      ) : emptyFinalizadas && emptyAndamento ? (
        <p className="wr-pesquisas-clean__state">
          {error ?? 'Nenhuma pesquisa no momento.'}
        </p>
      ) : (
        <>
          {showKpis && highlights.length > 0 ? (
            <div className="wr-pesquisas-clean__kpis" aria-label="Pesquisas recentes">
              {highlights.map((row, index) => {
                const tone = KPI_TONES[index % KPI_TONES.length]
                return (
                  <div
                    key={row.id}
                    className={cn(
                      'wr-pesquisas-clean__kpi',
                      `wr-pesquisas-clean__kpi--${tone}`,
                      changedSet.has(row.id) && 'wr-row--changed',
                    )}
                    title={`${row.cidade} · ${formatPosicao(row.jadyelPosicao, row.jadyelNaoPontuou)} · ${row.instituto} · ${row.dataLabel}`}
                  >
                    <span className="wr-pesquisas-clean__kpi-value tabular-nums">
                      {row.jadyelPct != null ? formatPct0(row.jadyelPct) : '—'}
                    </span>
                    <span className="wr-pesquisas-clean__kpi-label">
                      {formatPosicao(row.jadyelPosicao, row.jadyelNaoPontuou)} ·{' '}
                      {shortCityLabel(row.cidade)}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : null}

          {showAndamento && andamentoHighlights.length > 0 ? (
            <div className="wr-pesquisas-clean__kpis" aria-label="Pesquisas em campo">
              {andamentoHighlights.map((row, index) => {
                const tone = KPI_TONES[index % KPI_TONES.length]
                return (
                  <button
                    key={row.id}
                    type="button"
                    className={cn(
                      'wr-pesquisas-clean__kpi',
                      'wr-pesquisas-clean__kpi--live',
                      `wr-pesquisas-clean__kpi--${tone}`,
                      changedSet.has(`and:${row.id}`) && 'wr-row--changed',
                    )}
                    title={`${row.dataLabel} · ${row.instituto} · ${row.cidade}`}
                    onClick={() => setAndamentoModal(row)}
                  >
                    <span className="wr-pesquisas-clean__kpi-live">
                      <SinalAndamento compact />
                      <span className="wr-pesquisas-clean__kpi-value tabular-nums">
                        {row.dataLabel}
                      </span>
                    </span>
                    <span className="wr-pesquisas-clean__kpi-label">
                      {row.instituto} · {shortCityLabel(row.cidade)}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}

          {showAndamento && andamentoList.length > 0 ? (
            <>
              <p className="wr-pesquisas-clean__section">
                Em andamento
                {andamentoRows.length > 0 ? ` (${andamentoRows.length})` : ''}
              </p>
              <ul className="wr-pesquisas-clean__list" aria-label="Pesquisas em andamento">
                <li
                  className="wr-pesquisas-clean__row wr-pesquisas-clean__row--head wr-pesquisas-clean__row--andamento"
                  aria-hidden
                >
                  <span>Município</span>
                  <span className="wr-col-hide-sm">Instituto</span>
                  <span>Data</span>
                  <span className="text-right">Sinal</span>
                </li>
                {andamentoList.map((row) => (
                  <li
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'wr-pesquisas-clean__row',
                      'wr-pesquisas-clean__row--andamento',
                      'wr-pesquisas-clean__row--clickable',
                      changedSet.has(`and:${row.id}`) && 'wr-row--changed',
                    )}
                    title={`${row.dataLabel} · ${row.instituto} · ${row.cidade} · em andamento`}
                    onClick={() => setAndamentoModal(row)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setAndamentoModal(row)
                    }}
                  >
                    <span className="wr-pesquisas-clean__city truncate">{row.cidade}</span>
                    <span className="wr-pesquisas-clean__meta truncate wr-col-hide-sm">
                      {row.instituto}
                    </span>
                    <span className="wr-pesquisas-clean__meta tabular-nums">{row.dataLabel}</span>
                    <span className="wr-pesquisas-clean__live-cell">
                      <SinalAndamento />
                      <button
                        type="button"
                        className="wr-pesquisas-clean__remove"
                        aria-label={`Remover ${row.cidade}`}
                        disabled={removingId === row.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleRemoveAndamento(row)
                        }}
                      >
                        {removingId === row.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                        ) : (
                          <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                        )}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {showFinalizadas && finalizadasList.length > 0 ? (
            <>
              <p className="wr-pesquisas-clean__section">Últimas pesquisas</p>
              <ul className="wr-pesquisas-clean__list" aria-label="Pesquisas finalizadas">
                <li className="wr-pesquisas-clean__row wr-pesquisas-clean__row--head" aria-hidden>
                  <span>Município</span>
                  <span className="wr-col-hide-sm">Instituto</span>
                  <span>Data</span>
                  <span className="text-right">%</span>
                  <span className="text-right">Pos.</span>
                </li>
                {finalizadasList.map((row) => (
                  <li
                    key={row.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'wr-pesquisas-clean__row wr-pesquisas-clean__row--clickable',
                      changedSet.has(row.id) && 'wr-row--changed',
                    )}
                    title={`${row.cidade} · ${formatPosicao(row.jadyelPosicao, row.jadyelNaoPontuou)} · ${row.instituto} · ${row.dataLabel} · ${row.cenario} · votos válidos · duplo clique para ver ranking`}
                    onDoubleClick={() => setRankingModal(row)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setRankingModal(row)
                    }}
                  >
                    <span className="wr-pesquisas-clean__city truncate">{row.cidade}</span>
                    <span className="wr-pesquisas-clean__meta truncate wr-col-hide-sm">
                      {row.instituto}
                    </span>
                    <span className="wr-pesquisas-clean__meta tabular-nums">{row.dataLabel}</span>
                    <span className="wr-pesquisas-clean__pct tabular-nums">
                      {row.jadyelPct != null ? formatPct0(row.jadyelPct) : '—'}
                    </span>
                    <span className="wr-pesquisas-clean__pos tabular-nums">
                      {formatPosicao(row.jadyelPosicao, row.jadyelNaoPontuou)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}

      {!showDesempenho ? (
        <Link href="/dashboard/pesquisa" className="wr-pesquisas-clean__footer">
          <span>Ver todas as pesquisas</span>
          <ChevronRight className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </Link>
      ) : null}

      {rankingModal ? (
        <WarRoomPesquisaRankingModal
          pesquisa={rankingModal}
          onClose={() => setRankingModal(null)}
        />
      ) : null}

      {andamentoModal !== undefined ? (
        <WarRoomPesquisaAndamentoModal
          initial={andamentoModal}
          onClose={() => setAndamentoModal(undefined)}
          onSaved={handleAndamentoSaved}
        />
      ) : null}
    </section>
  )
}
