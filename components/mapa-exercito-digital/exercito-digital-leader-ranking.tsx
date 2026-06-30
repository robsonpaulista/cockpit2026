'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'
import {
  filterLeadersByTab,
  formatInt,
  formatPct,
  leaderTabCounts,
} from '@/lib/mapa-exercito-digital-aggregator'
import {
  leaderDisputeScore,
  leaderScoreMax,
  PERIOD_BAR_LABELS,
  PODIUM_STYLES,
} from '@/lib/mapa-exercito-digital-gamification'
import type { ExercitoDigitalLeaderRow, LeaderFilterTab, LeaderStatusDot } from '@/lib/mapa-exercito-digital-types'
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
const MONTH_LABELS = PERIOD_BAR_LABELS

const dotColor: Record<LeaderStatusDot, string> = {
  green: '#639922',
  amber: '#BA7517',
  red: '#E24B4A',
  gray: '#B4B2A9',
}

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

export function ExercitoDigitalLeaderRanking({ leaders, audience, referenceMonthLabel }: ExercitoDigitalLeaderRankingProps) {
  const [tab, setTab] = useState<LeaderFilterTab>('todos')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const counts = useMemo(() => leaderTabCounts(leaders), [leaders])
  const filtered = useMemo(() => filterLeadersByTab(leaders, tab), [leaders, tab])

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

  const scoreMax = useMemo(() => leaderScoreMax(filtered), [filtered])
  const podium = filtered.slice(0, 3)
  const listRows = filtered.slice(0, 12)

  return (
    <div className={cn(exercitoSectionCardClass, exercitoDualPanelItemClass, 'border-[#C8900A]/20')}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className={exercitoSectionTitleClass}>⚔️ Disputa de líderes</h2>
          <p className={exercitoSectionSubtitleClass}>
            Pontuação = comentários em {referenceMonthLabel} · clique para expandir detalhes
          </p>
        </div>
        <span className="rounded-[99px] border border-[#C8900A]/45 bg-[#FAEEDA] px-2 py-0.5 text-[10px] font-semibold text-[#854F0B]">
          top {Math.min(12, filtered.length)}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-[99px] border px-3 py-1 text-[11.5px] transition-colors',
              tab === t.id
                ? 'border-[#C8900A]/60 bg-[#FAEEDA] font-semibold text-[#854F0B]'
                : 'border-[rgb(var(--color-border-secondary)/0.85)] text-text-secondary hover:bg-bg-app'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {podium.length > 0 ? (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {podium.map((leader, idx) => {
            const style = PODIUM_STYLES[idx]!
            const score = leaderDisputeScore(leader)
            const firstName = leader.nome.split(' ')[0] ?? leader.nome
            return (
              <div
                key={leader.id}
                className={cn(
                  'rounded-[10px] px-2 py-2 text-center',
                  style.bg,
                  style.ring
                )}
              >
                <span className="text-lg leading-none" aria-hidden>
                  {style.medal}
                </span>
                <p className="mt-0.5 truncate text-[10px] font-bold text-text-primary" title={leader.nome}>
                  {firstName}
                </p>
                <p className="text-[18px] font-bold tabular-nums text-[rgb(var(--color-primary))]">{score}</p>
                <p className="text-[9px] text-text-muted">pts · {referenceMonthLabel}</p>
                <span className={cn('mt-1 inline-flex text-[9px] font-medium', trendBadgeClass(leader.trendKind))}>
                  {leader.trendLabel}
                </span>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className={cn(GRID, 'border-b border-[rgb(var(--color-border-tertiary)/0.85)] pb-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-text-muted')}>
        <span className="text-center">#</span>
        <span>{profileColumnLabel(audience)}</span>
        <span className="text-right">Pts</span>
        <span className="text-center">Forma</span>
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
            const score = leaderDisputeScore(leader)
            const barPct = scoreMax > 0 ? (score / scoreMax) * 100 : 0

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
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-[99px] bg-bg-app">
                        <div
                          className="h-full rounded-[99px] bg-[rgb(var(--color-primary))] transition-all"
                          style={{ width: `${barPct}%` }}
                        />
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
                          value: leader.variacaoPct == null ? '—' : formatPct(leader.variacaoPct),
                          color:
                            leader.variacaoPct == null
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
                        <p className="mb-2 text-[10.5px] font-medium text-text-secondary">
                          Liderados · engajamento no Instagram
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
                                  <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                    Coment.
                                  </th>
                                  <th
                                    className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-text-muted"
                                    title="Publicações distintas em que comentou"
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

      <div className="mt-auto shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-[rgb(var(--color-border-tertiary)/0.85)] pt-2.5 text-[11px] text-text-muted">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-sm" aria-hidden>🥇</span>
            Pódio = mês de referência
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#639922]" aria-hidden />
            Subindo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#E24B4A]" aria-hidden />
            Em queda
          </span>
        </div>
        <span>Clique na linha para detalhes · {referenceMonthLabel}</span>
      </div>
    </div>
  )
}
