'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'
import {
  filterLeadersByTab,
  formatInt,
  formatPct,
  leaderTabCounts,
} from '@/lib/mapa-exercito-digital-aggregator'
import { PERIOD_BAR_LABELS } from '@/lib/mapa-exercito-digital-gamification'
import type { ExercitoDigitalAccumulatedLeaderRow, ExercitoDigitalLeaderRow, LeaderFilterTab, LeaderStatusDot } from '@/lib/mapa-exercito-digital-types'
import type { ExercitoDigitalAudience } from '@/lib/mandatos-instagram-piaui'
import type { LideradoIgEngajamentoLinha } from '@/lib/mobilizacao-lideres-desempenho-ig-por-td-client'
import {
  exercitoDualPanelItemClass,
  exercitoSectionCardClass,
  exercitoSectionSubtitleClass,
  exercitoSectionTitleClass,
} from '@/lib/mapa-exercito-digital-layout'
import { cn } from '@/lib/utils'

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatHandle(h: string): string {
  const t = h.trim()
  if (!t) return ''
  return t.startsWith('@') ? t : `@${t}`
}

function formatarUltimaPub(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return fmtDataHora.format(d)
}

function buildLideradosLinhas(leader: ExercitoDigitalLeaderRow): LideradoIgEngajamentoLinha[] {
  const handles = leader.lideradosInstagram ?? []
  const porHandle = new Map((leader.lideradosEngajamento ?? []).map((r) => [r.handle, r]))
  return handles
    .map((handle) => {
      const row = porHandle.get(handle)
      return (
        row ?? {
          handle,
          nome: null,
          comentarios: 0,
          publicacoesComComentario: 0,
          ultimaPublicacaoComentadaEm: null,
        }
      )
    })
    .sort((a, b) => b.comentarios - a.comentarios || a.handle.localeCompare(b.handle, 'pt-BR', { sensitivity: 'base' }))
}

function isMandatoRow(leader: ExercitoDigitalLeaderRow, audience: ExercitoDigitalAudience): boolean {
  return audience === 'mandatos' || (audience === 'unificado' && leader.tipo === 'mandato')
}

function isLiderRow(leader: ExercitoDigitalLeaderRow, audience: ExercitoDigitalAudience): boolean {
  return audience === 'liderados' || (audience === 'unificado' && leader.tipo === 'lider')
}

function profileColumnLabel(audience: ExercitoDigitalAudience): string {
  if (audience === 'unificado') return 'Perfil'
  if (audience === 'mandatos') return 'Mandatário'
  return 'Líder'
}

const GRID = 'grid grid-cols-[28px_minmax(0,1fr)_48px_72px] items-center gap-2'
const ACCUM_GRID = 'grid grid-cols-[22px_minmax(0,1fr)_36px] items-center gap-1.5'
const MONTH_LABELS = PERIOD_BAR_LABELS

const blueRamp = ['#E6F1FB', '#B5D4F4', '#85B7EB', '#378ADD', '#185FA5']
const amberRamp = ['#FAEEDA', '#FAC775', '#EF9F27', '#BA7517', '#854F0B']

function activationColor(pct: number): string {
  if (pct > 30) return '#185FA5'
  if (pct >= 5) return '#854F0B'
  return '#A32D2D'
}

function trendBadgeClass(kind: ExercitoDigitalLeaderRow['trendKind']): string {
  switch (kind) {
    case 'growing':
      return 'text-[#3B6D11]'
    case 'falling':
    case 'inactive':
      return 'text-[#A32D2D]'
    case 'accelerating':
      return 'text-[rgb(var(--color-primary))]'
    default:
      return 'text-text-muted'
  }
}

function barRamp(status: LeaderStatusDot, trend: ExercitoDigitalLeaderRow['trendKind']): string[] {
  if (status === 'red' || trend === 'falling' || trend === 'inactive') {
    return ['#FCEBEB', '#F09595', '#E24B4A', '#E24B4A', '#E24B4A']
  }
  if (status === 'amber') return amberRamp
  return blueRamp
}

interface ExercitoDigitalLeaderRankingProps {
  leaders: ExercitoDigitalLeaderRow[]
  accumulatedLeaders: ExercitoDigitalAccumulatedLeaderRow[]
  accumulatedWindowDays: number
  audience: ExercitoDigitalAudience
  referenceMonthLabel: string
}

function PeriodBars({
  leaderId,
  counts,
  status,
  trend,
}: {
  leaderId: string
  counts: number[]
  status: LeaderStatusDot
  trend: ExercitoDigitalLeaderRow['trendKind']
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const max = Math.max(...counts, 1)
  const ramp = barRamp(status, trend)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || wrap.dataset.built === '1') return
    wrap.dataset.built = '1'
    wrap.innerHTML = ''
    counts.forEach((value, i) => {
      const col = document.createElement('div')
      col.className = 'flex flex-1 flex-col items-center gap-0.5'
      const val = document.createElement('span')
      val.className = 'text-[9px] font-medium text-text-secondary'
      val.textContent = String(value)
      const barWrap = document.createElement('div')
      barWrap.className = 'flex h-8 w-full items-end'
      const bar = document.createElement('div')
      bar.className = 'w-full min-h-[2px] rounded-t-[2px]'
      bar.style.height = `${Math.max(8, (value / max) * 100)}%`
      bar.style.background = ramp[i] ?? ramp[ramp.length - 1]!
      const label = document.createElement('span')
      label.className = 'text-[9px] text-text-muted'
      label.textContent = MONTH_LABELS[i] ?? ''
      barWrap.appendChild(bar)
      col.appendChild(val)
      col.appendChild(barWrap)
      col.appendChild(label)
      wrap.appendChild(col)
    })
  }, [counts, leaderId, max, ramp])

  return (
    <div
      ref={wrapRef}
      id={`week-bars-${leaderId}`}
      className="period-bars flex h-12 items-end gap-1"
    />
  )
}

export function ExercitoDigitalLeaderRanking({
  leaders,
  accumulatedLeaders,
  accumulatedWindowDays,
  audience,
  referenceMonthLabel,
}: ExercitoDigitalLeaderRankingProps) {
  const [tab, setTab] = useState<LeaderFilterTab>('todos')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const counts = useMemo(() => leaderTabCounts(leaders), [leaders])
  const filtered = useMemo(() => filterLeadersByTab(leaders, tab), [leaders, tab])
  const accumulatedTop = useMemo(() => accumulatedLeaders.slice(0, 20), [accumulatedLeaders])

  const toggleRow = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const tabs: { id: LeaderFilterTab; label: string }[] = [
    { id: 'todos', label: `Todos (${counts.todos})` },
    { id: 'ativos', label: `Ativos (${counts.ativos})` },
    { id: 'em-queda', label: 'Em queda' },
    { id: 'inativos', label: `Inativos (${counts.inativos})` },
  ]

  const entityLabel =
    audience === 'unificado' ? 'perfil' : audience === 'mandatos' ? 'mandatário' : 'líder'

  const listRows = filtered.slice(0, 20)

  return (
    <div className={cn(exercitoSectionCardClass, exercitoDualPanelItemClass)}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={exercitoSectionTitleClass}>Ranking de líderes</h2>
          <p className={exercitoSectionSubtitleClass}>
            Comentários em {referenceMonthLabel} · clique na linha para ver liderados
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-[99px] border px-2.5 py-0.5 text-[11px] transition-colors',
                tab === t.id
                  ? 'border-[#C8900A]/50 bg-[#FAEEDA] font-medium text-[#854F0B]'
                  : 'border-[rgb(var(--color-border-secondary)/0.85)] text-text-secondary hover:bg-bg-app'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            Mês atual · {referenceMonthLabel}
          </h3>

          <div
            className={cn(
              GRID,
              'border-b border-[rgb(var(--color-border-tertiary)/0.85)] pb-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-text-muted'
            )}
          >
        <span className="text-center">#</span>
        <span>{profileColumnLabel(audience)}</span>
        <span className="text-right" title={`Comentários da rede no mês de referência (${referenceMonthLabel})`}>
          Com. mês
        </span>
        <span className="text-center" title="Tendência vs. mês anterior (volume de comentários)">
          Tendência
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {listRows.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-text-muted">Nenhum {entityLabel} neste filtro.</p>
        ) : (
          listRows.map((leader, idx) => {
            const expanded = expandedId === leader.id
            const isLast = idx === listRows.length - 1
            const mandato = isMandatoRow(leader, audience)
            const liderRede = isLiderRow(leader, audience)
            const lideradosLinhas = liderRede ? buildLideradosLinhas(leader) : []
            const score = leader.mesAtual

            return (
              <Fragment key={leader.id}>
                <button
                  type="button"
                  onClick={() => toggleRow(leader.id)}
                  className={cn(
                    'leader-row w-full px-1 py-2 text-left transition-colors',
                    !isLast && !expanded && 'border-b border-[rgb(var(--color-border-tertiary)/0.85)]',
                    expanded
                      ? 'expanded rounded-[10px] rounded-b-none bg-bg-app'
                      : 'hover:rounded-[10px] hover:bg-bg-app'
                  )}
                >
                  <div className={GRID}>
                    <span
                      className={cn(
                        'text-center text-[12px] font-bold tabular-nums',
                        leader.rank <= 3 ? 'text-[#854F0B]' : 'text-text-muted'
                      )}
                    >
                      {leader.rank}
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <p className="truncate text-xs font-semibold text-text-primary">{leader.nome}</p>
                        {liderRede ? (
                          <span className="shrink-0 rounded-[99px] border border-[#C8900A]/45 bg-[#FAEEDA] px-1.5 py-0 text-[8.5px] font-semibold uppercase tracking-wide text-[#854F0B]">
                            Rede
                          </span>
                        ) : audience === 'unificado' ? (
                          <span className="shrink-0 rounded-[99px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-1.5 py-0 text-[8.5px] font-medium uppercase tracking-wide text-text-muted">
                            Mandato
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[10px] text-text-muted">
                        {formatInt(leader.publicacoes)}/{formatInt(leader.postsNoPeriodo)} posts ·{' '}
                        {formatPct(leader.ativacaoPct)} ativ.
                      </p>
                    </div>
                    <span className="text-right text-[14px] font-bold tabular-nums text-[rgb(var(--color-primary))]">
                      {score}
                    </span>
                    <span className={cn('inline-flex items-center justify-center gap-0.5 whitespace-nowrap text-[10px] font-medium', trendBadgeClass(leader.trendKind))}>
                      {leader.trendKind === 'growing' || leader.trendKind === 'accelerating' ? (
                        <IconTrendingUp className="h-3 w-3 shrink-0" stroke={1.5} aria-hidden />
                      ) : null}
                      {leader.trendKind === 'falling' ? (
                        <IconTrendingDown className="h-3 w-3 shrink-0" stroke={1.5} aria-hidden />
                      ) : null}
                      {leader.trendLabel}
                    </span>
                  </div>
                </button>
                {expanded ? (
                  <div className="leader-detail mb-1 block rounded-b-[10px] border border-t-0 border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app px-4 py-3">
                    <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {[
                        ...(mandato || liderRede
                          ? [
                              {
                                label: 'Posts comentados',
                                value: `${formatInt(leader.publicacoes)}/${formatInt(leader.postsNoPeriodo)}`,
                                color: activationColor(leader.ativacaoPct),
                              },
                              {
                                label: 'Cobertura',
                                value: formatPct(leader.ativacaoPct),
                                color: activationColor(leader.ativacaoPct),
                              },
                              ...(liderRede
                                ? [
                                    {
                                      label: 'Liderados ativos',
                                      value: `${formatInt(leader.lideradosQueComentaram)}/${formatInt(leader.lideradosComRede)}`,
                                      color: undefined,
                                    },
                                  ]
                                : []),
                            ]
                          : []),
                        { label: 'Mês ref.', value: formatInt(leader.mesAtual), color: undefined },
                        { label: 'Mês anterior', value: formatInt(leader.mesAnterior), color: undefined },
                        {
                          label: 'Variação',
                          value:
                            leader.mesAnterior <= 0 && leader.mesAtual > 0
                              ? `0 → ${formatInt(leader.mesAtual)} com.`
                              : leader.variacaoPct == null
                                ? '—'
                                : formatPct(leader.variacaoPct),
                          color:
                            leader.mesAnterior <= 0 && leader.mesAtual > 0
                              ? '#3B6D11'
                              : leader.variacaoPct == null
                                ? undefined
                                : leader.variacaoPct >= 0
                                  ? '#3B6D11'
                                  : '#A32D2D',
                        },
                        { label: 'Consistência', value: leader.consistencia, color: undefined },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-[10px] border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-2.5 py-2"
                        >
                          <p className="text-[10px] text-text-muted">{item.label}</p>
                          <p
                            className="text-[15px] font-medium tabular-nums text-text-primary"
                            style={item.color ? { color: item.color } : undefined}
                          >
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="mb-1.5 text-[10.5px] text-text-muted">Comentários por mês (últimos 5 meses)</p>
                    <PeriodBars
                      leaderId={leader.id}
                      counts={leader.monthlyCounts}
                      status={leader.statusDot}
                      trend={leader.trendKind}
                    />
                    {liderRede ? (
                      <div className="mt-4 border-t border-[rgb(var(--color-border-tertiary)/0.85)] pt-3">
                        <p className="mb-0.5 text-[10.5px] font-medium text-text-secondary">
                          Liderados · engajamento no Instagram
                        </p>
                        <p className="mb-2 text-[10px] text-text-muted">
                          Mesmos números do placar: comentários contados em {referenceMonthLabel}. A soma dos
                          liderados deve bater com o total do líder no mês.
                        </p>
                        {lideradosLinhas.length === 0 ? (
                          <p className="text-[11px] text-text-muted">
                            Nenhum @ de liderado ativo vinculado a este líder no recorte atual.
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[28rem] border-collapse text-left">
                              <thead>
                                <tr className="border-b border-[rgb(var(--color-border-tertiary)/0.85)]">
                                  <th className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                    Nome
                                  </th>
                                  <th className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                    Perfil
                                  </th>
                                  <th
                                    className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-muted"
                                    title={`Comentários deste @ em ${referenceMonthLabel}`}
                                  >
                                    Com. mês ref.
                                  </th>
                                  <th
                                    className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-muted"
                                    title={`Publicações distintas em que comentou em ${referenceMonthLabel}`}
                                  >
                                    Posts c/ com.
                                  </th>
                                  <th
                                    className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted"
                                    title="Data da publicação do comentário mais recente"
                                  >
                                    Última pub.
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {lideradosLinhas.map((row) => (
                                  <tr
                                    key={row.handle}
                                    className="border-b border-dashed border-[rgb(var(--color-border-tertiary)/0.55)] last:border-0"
                                  >
                                    <td className="px-2 py-1.5 text-[11px] text-text-primary">
                                      {(row.nome ?? '').trim() || '—'}
                                    </td>
                                    <td className="px-2 py-1.5 font-mono text-[11px] text-text-primary">
                                      {formatHandle(row.handle)}
                                    </td>
                                    <td className="px-2 py-1.5 text-right text-[11px] tabular-nums text-text-primary">
                                      {row.comentarios}
                                    </td>
                                    <td className="px-2 py-1.5 text-right text-[11px] tabular-nums text-text-primary">
                                      {row.publicacoesComComentario}
                                    </td>
                                    <td className="whitespace-nowrap px-2 py-1.5 text-[11px] tabular-nums text-text-secondary">
                                      {formatarUltimaPub(row.ultimaPublicacaoComentadaEm)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </Fragment>
            )
          })
        )}
      </div>

      <p className="mt-2 text-[10px] text-text-muted">
        {filtered.length} {entityLabel}s no filtro · tendência vs. mês anterior
      </p>
        </div>

        <aside className="w-full shrink-0 rounded-[10px] border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app p-3 lg:w-[min(100%,280px)] lg:max-w-[280px]">
          <div className="mb-2.5 border-b border-[rgb(var(--color-border-tertiary)/0.55)] pb-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#854F0B]">Acumulado</h3>
            <p className="mt-0.5 text-[10px] text-text-muted">Últimos {accumulatedWindowDays} dias</p>
          </div>

          <div
            className={cn(
              ACCUM_GRID,
              'border-b border-[rgb(var(--color-border-tertiary)/0.55)] pb-1 text-[9px] font-semibold uppercase tracking-[0.04em] text-text-muted'
            )}
          >
            <span className="text-center">#</span>
            <span>Perfil</span>
            <span className="text-right">Com.</span>
          </div>

          <div className="max-h-[min(60vh,520px)] overflow-y-auto">
            {accumulatedTop.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-text-muted">Sem dados no período.</p>
            ) : (
              accumulatedTop.map((leader, idx) => {
                const isLast = idx === accumulatedTop.length - 1
                return (
                  <div
                    key={leader.id}
                    className={cn(
                      'py-1.5',
                      !isLast && 'border-b border-[rgb(var(--color-border-tertiary)/0.45)]'
                    )}
                  >
                    <div className={ACCUM_GRID}>
                      <span
                        className={cn(
                          'text-center text-[11px] font-bold tabular-nums',
                          leader.rank <= 3 ? 'text-[#854F0B]' : 'text-text-muted'
                        )}
                      >
                        {leader.rank}
                      </span>
                      <p className="truncate text-[11px] font-medium text-text-primary" title={leader.nome}>
                        {leader.nome}
                      </p>
                      <span className="text-right text-[12px] font-semibold tabular-nums text-[#854F0B]">
                        {formatInt(leader.comentarios)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <p className="mt-2 border-t border-[rgb(var(--color-border-tertiary)/0.55)] pt-2 text-[9px] text-text-muted">
            Top {Math.min(20, accumulatedLeaders.length)} no período
          </p>
        </aside>
      </div>
    </div>
  )
}
