'use client'

import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { TrendsSearchContextBlock } from '@/components/trends-radar/trends-search-context-block'
import type { GoogleTrendsCompareRow } from '@/lib/google-trends-types'
import { labelActorType } from '@/lib/youtube-radar-labels'
import { cn } from '@/lib/utils'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatGrowth(pct: number | null): string {
  if (pct === null) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}%`
}

interface TrendsCompareBoardProps {
  rows: GoogleTrendsCompareRow[]
  loading?: boolean
}

function Sparkline({ points }: { points: GoogleTrendsCompareRow['points'] }) {
  if (points.length < 2) return <span className="text-xs text-text-muted">—</span>
  const w = 120
  const h = 28
  const scores = points.map((p) => p.score)
  const max = Math.max(...scores, 1)
  const min = Math.min(...scores, 0)
  const range = Math.max(max - min, 1)
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p.score - min) / range) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-[120px]" aria-hidden>
      <polyline
        fill="none"
        stroke="rgb(var(--color-primary))"
        strokeWidth="1.5"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  )
}

export function TrendsCompareBoard({ rows, loading = false }: TrendsCompareBoardProps) {
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-10 text-center text-sm text-text-muted">
        Carregando quadro comparativo…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-6 py-12 text-center text-sm text-text-muted">
        Cadastre candidatos ativos e rode a coleta do Google Trends.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface">
      <div className="border-b border-[rgb(var(--color-border-tertiary)/0.85)] px-4 py-3">
        <h2 className="text-sm font-medium text-text-primary">Comparativo de interesse</h2>
        <p className="text-xs text-text-muted">Quem cresceu, picos recentes e alertas de tendência</p>
      </div>

      <div className="max-md:overflow-x-hidden md:overflow-x-auto">
        <table className="w-full border-collapse text-left max-md:min-w-0 md:min-w-[720px]">
          <thead>
            <tr className="border-b border-[rgb(var(--color-border-tertiary)/0.85)] text-[10px] font-medium uppercase tracking-wide text-text-muted">
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="hidden w-20 px-3 py-2 text-right font-medium md:table-cell">Atual</th>
              <th className="w-24 px-3 py-2 text-right font-medium">%CRESC.</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Pico</th>
              <th className="w-32 px-3 py-2 font-medium">Quando</th>
              <th className="w-[130px] px-3 py-2 font-medium">Tendência</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const expanded = expandedTerm === row.searchTerm
              const growthUp = (row.growthPct ?? 0) > 0
              const growthDown = (row.growthPct ?? 0) < 0

              return (
                <Fragment key={row.searchTerm}>
                  <tr
                    className={cn(
                      'border-b border-[rgb(var(--color-border-tertiary)/0.5)] transition-colors',
                      expanded ? 'bg-[#E6F1FB]/40' : 'hover:bg-bg-app',
                      row.trendAlert && !expanded && 'bg-amber-50/60'
                    )}
                  >
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setExpandedTerm(expanded ? null : row.searchTerm)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left"
                        aria-expanded={expanded}
                      >
                        <span className="shrink-0 text-text-muted">
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          ) : (
                            <ChevronRight className="h-4 w-4" aria-hidden />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-text-primary">{row.name}</span>
                            {row.trendAlert ? (
                              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                                Pico recente
                              </span>
                            ) : null}
                          </span>
                          {row.actorType ? (
                            <span className="block text-[11px] text-text-muted">
                              {labelActorType(row.actorType)}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </td>
                    <td className="hidden px-3 py-2 text-right text-sm font-medium tabular-nums text-text-primary md:table-cell">
                      {row.latestScore}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={cn(
                          'inline-flex items-center justify-end gap-0.5 text-sm font-medium tabular-nums',
                          growthUp && 'text-[#3B6D11]',
                          growthDown && 'text-[#A32D2D]',
                          !growthUp && !growthDown && 'text-text-muted'
                        )}
                      >
                        {growthUp ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : null}
                        {growthDown ? <TrendingDown className="h-3.5 w-3.5" aria-hidden /> : null}
                        {formatGrowth(row.growthPct)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-text-primary">
                      {row.peakScore}
                    </td>
                    <td className="px-3 py-2 text-xs text-text-secondary">{formatDate(row.peakDate)}</td>
                    <td className="px-3 py-2">
                      <Sparkline points={row.points} />
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="border-b border-[rgb(var(--color-border-tertiary)/0.5)] bg-bg-app">
                      <td colSpan={6} className="p-0">
                        <div className="space-y-3 px-4 py-3 pl-10">
                          {row.searchContext ? (
                            <TrendsSearchContextBlock context={row.searchContext} name={row.name} compact />
                          ) : null}
                          <div>
                            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                              Série diária
                            </p>
                            <ul className="max-h-48 divide-y divide-[rgb(var(--color-border-tertiary)/0.35)] overflow-y-auto rounded-lg border border-[rgb(var(--color-border-tertiary)/0.35)]">
                              {row.points.length === 0 ? (
                                <li className="px-3 py-3 text-xs text-text-muted">Sem pontos na série.</li>
                              ) : (
                                row.points
                                  .slice()
                                  .reverse()
                                  .map((p) => (
                                    <li
                                      key={p.date}
                                      className="flex items-center justify-between px-3 py-1.5 text-xs"
                                    >
                                      <span className="text-text-secondary">{formatDate(p.date)}</span>
                                      <span className="font-medium tabular-nums text-text-primary">{p.score}</span>
                                    </li>
                                  ))
                              )}
                            </ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
