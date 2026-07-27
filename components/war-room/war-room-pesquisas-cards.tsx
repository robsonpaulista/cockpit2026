'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IconChevronRight, IconLoader2 } from '@tabler/icons-react'
import {
  WAR_ROOM_PESQUISAS_ANDAMENTO,
  type WarRoomPesquisaAndamento,
  type WarRoomPesquisaAndamentoStatus,
} from '@/lib/war-room/mock-data'
import {
  buildWarRoomPesquisasConsolidadas,
  type WarRoomPesquisaConsolidadaReal,
} from '@/lib/war-room/pesquisas-consolidadas'
import { resolveCandidatoIpt, type PollIptRow } from '@/lib/ipt-pesquisa'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import { WarRoomPesquisaRankingModal } from '@/components/war-room/war-room-pesquisa-ranking-modal'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { cn } from '@/lib/utils'

const HIGHLIGHTS_COUNT = 3
const LIST_VISIBLE = 8

type PesquisaFiltro = 'finalizadas' | 'andamento'

const FILTRO_OPCOES: Array<{ id: PesquisaFiltro; label: string }> = [
  { id: 'finalizadas', label: 'Finalizadas' },
  { id: 'andamento', label: 'Em andamento' },
]

const ANDAMENTO_STATUS_LABEL: Record<WarRoomPesquisaAndamentoStatus, string> = {
  planejada: 'Planejada',
  em_campo: 'Em campo',
  processando: 'Processando',
  entregue: 'Entregue',
  atrasada: 'Atrasada',
}

const KPI_TONES = ['gold', 'slate', 'mist'] as const

function formatPct0(value: number): string {
  return `${Math.round(value)}%`
}

function formatPosicao(value: number | null | undefined): string {
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

function andamentoAtivos(rows: WarRoomPesquisaAndamento[]): WarRoomPesquisaAndamento[] {
  return rows.filter((r) => r.status !== 'entregue')
}

/** Pesquisas consolidadas — filtros clean + finalizadas / em andamento. */
export function WarRoomPesquisasConsolidadasCard({ className }: { className?: string }) {
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('pesquisas')
  const [rows, setRows] = useState<WarRoomPesquisaConsolidadaReal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<PesquisaFiltro>('finalizadas')
  const [rankingModal, setRankingModal] = useState<WarRoomPesquisaConsolidadaReal | null>(null)

  const andamentoRows = useMemo(
    () => andamentoAtivos(WAR_ROOM_PESQUISAS_ANDAMENTO),
    [],
  )

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const foco = resolveCandidatoIpt()
      const res = await fetch('/api/pesquisa?limit=5000', { cache: 'no-store' })
      if (!res.ok) throw new Error('pesquisa')
      const data = (await res.json()) as PollIptRow[]
      const built = buildWarRoomPesquisasConsolidadas(
        Array.isArray(data) ? data : [],
        foco,
        200,
      )
      setRows(built)
    } catch {
      if (!silent) {
        setRows([])
        setError('Não foi possível carregar as pesquisas.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load({ silent: false })
  }, [load])

  useEffect(() => {
    return register('pesquisas', async ({ silent }) => {
      await load({ silent })
    })
  }, [register, load])

  const snapshotLines = useMemo(
    () =>
      rows.map(
        (r) =>
          `${r.id}\t${r.cidade}\t${r.jadyelPosicao ?? ''}\t${r.jadyelPct ?? ''}\t${r.liderPct}\t${r.diferencaPp ?? ''}`,
      ),
    [rows],
  )

  const { changedKeys } = useWarRoomSnapshot({
    cardId: 'pesquisas',
    lines: loading && rows.length === 0 ? null : snapshotLines,
    noun: 'pesquisa',
    ready: !loading || rows.length > 0,
  })
  const changedSet = useMemo(() => new Set(changedKeys), [changedKeys])

  const highlights = useMemo(() => rows.slice(0, HIGHLIGHTS_COUNT), [rows])

  const finalizadasList = useMemo(() => rows.slice(0, LIST_VISIBLE), [rows])
  const andamentoList = useMemo(
    () => andamentoRows.slice(0, LIST_VISIBLE),
    [andamentoRows],
  )

  const showFinalizadas = filtro === 'finalizadas'
  const showAndamento = filtro === 'andamento'
  const showKpis = filtro === 'finalizadas'

  const emptyFinalizadas = !loading && rows.length === 0
  const emptyAndamento = andamentoList.length === 0

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
            <p className="wr-pesquisas-clean__sub">Resultados e campo</p>
          </div>
          {change ? <WarRoomChangeBadge change={change} /> : null}
        </div>
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
              onClick={() => setFiltro(opcao.id)}
            >
              {opcao.label}
            </button>
          ))}
        </div>
      </header>

      {loading && rows.length === 0 && filtro !== 'andamento' ? (
        <div className="wr-pesquisas-clean__state">
          <IconLoader2 className="h-5 w-5 animate-spin text-[var(--wr-muted)]" stroke={1.5} />
        </div>
      ) : emptyFinalizadas && filtro === 'finalizadas' ? (
        <p className="wr-pesquisas-clean__state">
          {error ?? 'Nenhuma pesquisa finalizada no momento.'}
        </p>
      ) : emptyAndamento && filtro === 'andamento' ? (
        <p className="wr-pesquisas-clean__state">Nenhuma pesquisa em andamento.</p>
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
                    title={`${row.cidade} · ${formatPosicao(row.jadyelPosicao)} · ${row.instituto} · ${row.dataLabel}`}
                  >
                    <span className="wr-pesquisas-clean__kpi-value tabular-nums">
                      {row.jadyelPct != null ? formatPct0(row.jadyelPct) : '—'}
                    </span>
                    <span className="wr-pesquisas-clean__kpi-label">
                      {formatPosicao(row.jadyelPosicao)} · {shortCityLabel(row.cidade)}
                    </span>
                  </div>
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
                <li className="wr-pesquisas-clean__row wr-pesquisas-clean__row--head wr-pesquisas-clean__row--andamento" aria-hidden>
                  <span>Município</span>
                  <span className="wr-col-hide-sm">Instituto</span>
                  <span>Entrega</span>
                  <span className="text-right">Status</span>
                </li>
                {andamentoList.map((row) => {
                  const status = row.status ?? 'planejada'
                  return (
                    <li
                      key={`${row.cidade}-${row.instituto}-${row.termino}`}
                      className="wr-pesquisas-clean__row wr-pesquisas-clean__row--andamento"
                      title={`${row.cidade} · ${row.instituto} · ${ANDAMENTO_STATUS_LABEL[status]}`}
                    >
                      <span className="wr-pesquisas-clean__city truncate">{row.cidade}</span>
                      <span className="wr-pesquisas-clean__meta truncate wr-col-hide-sm">
                        {row.instituto}
                      </span>
                      <span className="wr-pesquisas-clean__meta tabular-nums">
                        {row.entrega}
                      </span>
                      <span
                        className={cn(
                          'wr-pesquisas-clean__status',
                          `wr-pesquisas-clean__status--${status}`,
                        )}
                      >
                        {ANDAMENTO_STATUS_LABEL[status]}
                      </span>
                    </li>
                  )
                })}
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
                    title={`${row.cidade} · ${formatPosicao(row.jadyelPosicao)} · ${row.instituto} · ${row.dataLabel} · ${row.cenario} · duplo clique para ver ranking`}
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
                      {formatPosicao(row.jadyelPosicao)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}

      <Link href="/dashboard/pesquisa" className="wr-pesquisas-clean__footer">
        <span>Ver todas as pesquisas</span>
        <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
      </Link>

      {rankingModal ? (
        <WarRoomPesquisaRankingModal
          pesquisa={rankingModal}
          onClose={() => setRankingModal(null)}
        />
      ) : null}
    </section>
  )
}
