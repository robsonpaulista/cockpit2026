'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
} from 'chart.js'
import {
  filterLeadersByTab,
  formatInt,
  formatPct,
  leaderTabCounts,
} from '@/lib/mapa-exercito-digital-aggregator'
import type { ExercitoDigitalLeaderRow, LeaderFilterTab, LeaderStatusDot } from '@/lib/mapa-exercito-digital-types'
import type { ExercitoDigitalAudience } from '@/lib/mandatos-instagram-piaui'
import {
  exercitoDualPanelItemClass,
  exercitoSectionCardClass,
  exercitoSectionSubtitleClass,
  exercitoSectionTitleClass,
} from '@/lib/mapa-exercito-digital-layout'
import { cn } from '@/lib/utils'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale)

const GRID = 'grid grid-cols-[18px_8px_1fr_52px_90px_70px_36px] items-center gap-2'
const WEEK_LABELS = ['S-4', 'S-3', 'S-2', 'S-1', 'Atual'] as const

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
      return 'border border-[#C0DD97] bg-[#EAF3DE] text-[#3B6D11]'
    case 'falling':
    case 'inactive':
      return 'border border-[#F09595] bg-[#FCEBEB] text-[#A32D2D]'
    case 'accelerating':
      return 'border border-[#B5D4F4] bg-[#E6F1FB] text-[rgb(var(--color-primary))]'
    default:
      return 'border border-[#D3D1C7] bg-[#F1EFE8] text-[#5F5E5A]'
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
  lookbackDays: number
}

function Sparkline({ id, data, color }: { id: string; data: number[]; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    chartRef.current?.destroy()
    chartRef.current = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map((_, i) => String(i)),
        datasets: [
          {
            data,
            borderColor: color,
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, min: 0 },
        },
      },
    })
    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [color, data])

  return (
    <canvas
      ref={canvasRef}
      id={id}
      width={90}
      height={28}
      role="img"
      aria-label={`Série semanal: ${data.join(', ')} comentários`}
      className="block"
    />
  )
}

function WeekBars({
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
      label.textContent = WEEK_LABELS[i] ?? ''
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
      className="week-bars flex h-12 items-end gap-1"
    />
  )
}

export function ExercitoDigitalLeaderRanking({ leaders, audience, lookbackDays }: ExercitoDigitalLeaderRankingProps) {
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

  const entityLabel = audience === 'mandatos' ? 'mandatário' : 'líder'

  return (
    <div className={cn(exercitoSectionCardClass, exercitoDualPanelItemClass)}>
      <h2 className={exercitoSectionTitleClass}>
        {audience === 'mandatos' ? 'Ranking de mandatários · engajamento' : 'Ranking de líderes · ativação'}
      </h2>
      <p className={cn(exercitoSectionSubtitleClass, 'mb-3')}>
        Clique para ver série semanal. Tendência = variação vs semana anterior · últimos {lookbackDays} dias.
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-[99px] border px-3 py-1 text-[11.5px] transition-colors',
              tab === t.id
                ? 'border-[rgb(var(--color-primary))] bg-[#E6F1FB] font-medium text-[rgb(var(--color-primary))]'
                : 'border-[rgb(var(--color-border-secondary)/0.85)] text-text-secondary hover:bg-bg-app'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={cn(GRID, 'border-b border-[rgb(var(--color-border-tertiary)/0.85)] pb-1.5 text-[10px] font-medium uppercase tracking-[0.04em] text-text-muted')}>
        <span className="text-right">#</span>
        <span aria-hidden>•</span>
        <span>{audience === 'mandatos' ? 'Mandatário' : 'Líder'}</span>
        <span className="text-right">Total %</span>
        <span>Semanas</span>
        <span className="text-center">Tendência</span>
        <span className="text-right">Pos.</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-text-muted">Nenhum {entityLabel} neste filtro.</p>
        ) : (
          filtered.slice(0, 40).map((leader, idx) => {
            const expanded = expandedId === leader.id
            const isLast = idx === filtered.length - 1 || idx === 39
            return (
              <Fragment key={leader.id}>
                <button
                  type="button"
                  onClick={() => toggleRow(leader.id)}
                  className={cn(
                    'leader-row',
                    GRID,
                    'w-full px-1 py-1.5 text-left transition-colors',
                    !isLast && !expanded && 'border-b border-[rgb(var(--color-border-tertiary)/0.85)]',
                    expanded
                      ? 'expanded rounded-[10px] rounded-b-none bg-bg-app'
                      : 'hover:rounded-[10px] hover:bg-bg-app'
                  )}
                >
                  <span className="text-right text-[11px] text-text-muted">{leader.rank}</span>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor[leader.statusDot] }}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-text-primary">{leader.nome}</p>
                    <p className="text-[10.5px] text-text-muted">
                      {formatInt(leader.comentarios)} coment · {formatInt(leader.publicacoes)} pub
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-medium tabular-nums" style={{ color: activationColor(leader.ativacaoPct) }}>
                      {formatPct(leader.ativacaoPct)}
                    </p>
                    <p className="text-[10px] text-text-muted">ativação</p>
                  </div>
                  <Sparkline
                    id={`sp${leader.rank}`}
                    data={leader.weeklyCounts}
                    color={dotColor[leader.statusDot]}
                  />
                  <span className={cn('inline-flex items-center justify-center gap-0.5 whitespace-nowrap rounded-[99px] px-[7px] py-0.5 text-[10.5px] font-medium', trendBadgeClass(leader.trendKind))}>
                    {leader.trendKind === 'growing' || leader.trendKind === 'accelerating' ? (
                      <IconTrendingUp className="h-3 w-3 shrink-0" stroke={1.5} aria-hidden />
                    ) : null}
                    {leader.trendKind === 'falling' ? (
                      <IconTrendingDown className="h-3 w-3 shrink-0" stroke={1.5} aria-hidden />
                    ) : null}
                    {leader.trendLabel}
                  </span>
                  <span
                    className="text-right text-[11px] font-medium tabular-nums"
                    style={{ color: dotColor[leader.statusDot] }}
                  >
                    {leader.rank}
                  </span>
                </button>
                {expanded ? (
                  <div className="leader-detail mb-1 block rounded-b-[10px] border border-t-0 border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app px-4 py-3">
                    <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {[
                        { label: 'Semana atual', value: formatInt(leader.semanaAtual), color: undefined },
                        { label: 'Semana anterior', value: formatInt(leader.semanaAnterior), color: undefined },
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
                    <p className="mb-1.5 text-[10.5px] text-text-muted">Comentários por semana (últimas 5 semanas)</p>
                    <WeekBars
                      leaderId={leader.id}
                      counts={leader.weeklyCounts}
                      status={leader.statusDot}
                      trend={leader.trendKind}
                    />
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
            <span className="h-2 w-2 rounded-full bg-[#639922]" aria-hidden />
            Ativo e crescendo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#BA7517]" aria-hidden />
            Parcial / estável
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#E24B4A]" aria-hidden />
            Em queda / inativo
          </span>
        </div>
        <span>Clique para expandir série semanal</span>
      </div>
    </div>
  )
}
