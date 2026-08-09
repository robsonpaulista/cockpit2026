'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CandidatosEngajamentoChartModel } from '@/lib/war-room/instagram-candidatos-engajamento'
import { contrastingTextColor, mixHexColors } from '@/lib/monitoramento-heatmap-colors'
import { cn } from '@/lib/utils'

type Props = {
  model: CandidatosEngajamentoChartModel
  className?: string
}

/** Alinha ao breakpoint do layout split das Redes (`wr-copiloto-redes`). */
const COMPACT_MEDIA = '(max-width: 1100px)'
const COMPACT_PAGE_SIZE = 6
const SEG_EMPTY = '#F3F3F1'
const SEG_FILLED = '#20201E'

type SortMode = { type: 'day'; date: string } | { type: 'period' }

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')}k`
  return formatInt(n)
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase()
}

function CandidateAvatar({
  name,
  avatarUrl,
}: {
  name: string
  avatarUrl: string | null
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="wr-copiloto-redes-candidatos__avatar"
      />
    )
  }
  return (
    <span
      className="wr-copiloto-redes-candidatos__avatar wr-copiloto-redes-candidatos__avatar--fallback"
      aria-hidden
    >
      {initialsFromName(name)}
    </span>
  )
}

/** Intensidade 0–1 → alpha do segmento (vazio fica track). */
function segmentIntensity(value: number, dayMax: number): number {
  if (value <= 0 || dayMax <= 0) return 0
  const ratio = value / dayMax
  return Math.min(1, 0.18 + ratio * 0.82)
}

function segmentColors(value: number, dayMax: number): {
  backgroundColor: string
  color: string
} | null {
  if (value <= 0) return null
  const intensity = segmentIntensity(value, dayMax)
  const backgroundColor = mixHexColors(SEG_EMPTY, SEG_FILLED, intensity)
  return {
    backgroundColor,
    color: contrastingTextColor(backgroundColor),
  }
}

function engagementOnDate(
  model: CandidatosEngajamentoChartModel,
  slug: string,
  date: string,
): number {
  const day = model.chartData.find((d) => d.date === date)
  return Number(day?.[slug] ?? 0) || 0
}

export function WarRoomCopilotoCandidatosEngajamentoChart({ model, className }: Props) {
  const [page, setPage] = useState(0)
  const [compact, setCompact] = useState(false)
  const lastDate = model.chartData[model.chartData.length - 1]?.date ?? null
  const [sortMode, setSortMode] = useState<SortMode>(
    lastDate ? { type: 'day', date: lastDate } : { type: 'period' },
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(COMPACT_MEDIA)
    const sync = () => setCompact(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    setPage(0)
  }, [model.lines.length, compact, sortMode])

  useEffect(() => {
    if (model.chartData.length === 0) {
      setSortMode({ type: 'period' })
      return
    }
    setSortMode((prev) => {
      if (prev.type === 'period') return prev
      if (model.chartData.some((d) => d.date === prev.date)) return prev
      const fallback = model.chartData[model.chartData.length - 1]?.date
      return fallback ? { type: 'day', date: fallback } : { type: 'period' }
    })
  }, [model.chartData])

  const sortedLines = useMemo(() => {
    if (sortMode.type === 'period') {
      return [...model.lines].sort(
        (a, b) => b.periodEngagement - a.periodEngagement || b.todayEngagement - a.todayEngagement,
      )
    }
    return [...model.lines].sort((a, b) => {
      const engA = engagementOnDate(model, a.slug, sortMode.date)
      const engB = engagementOnDate(model, b.slug, sortMode.date)
      return engB - engA || b.periodEngagement - a.periodEngagement
    })
  }, [model, sortMode])

  const sortHint =
    sortMode.type === 'period'
      ? 'período'
      : (model.chartData.find((d) => d.date === sortMode.date)?.label ?? null)

  const pageSize = compact ? COMPACT_PAGE_SIZE : Math.max(sortedLines.length, 1)
  const pageCount = Math.max(1, Math.ceil(sortedLines.length / pageSize))
  const pageSafe = Math.min(page, pageCount - 1)
  const rowsPage = useMemo(
    () => sortedLines.slice(pageSafe * pageSize, pageSafe * pageSize + pageSize),
    [sortedLines, pageSafe, pageSize],
  )
  const showPager = compact && pageCount > 1
  const dayMax = Math.max(model.dayMax, 1)
  const showSegValues = model.chartData.length <= 10
  const isPeriodSort = sortMode.type === 'period'
  const selectedDate = sortMode.type === 'day' ? sortMode.date : null

  if (model.empty || model.lines.length === 0) {
    return (
      <p className="wr-copiloto-redes__empty">
        Sem candidatos ativos no comparativo.
      </p>
    )
  }

  return (
    <div className={cn('wr-copiloto-redes-candidatos', className)}>
      <div className="wr-copiloto-redes-candidatos__list" role="list">
        <div className="wr-copiloto-redes-candidatos__row wr-copiloto-redes-candidatos__row--head">
          <span className="wr-copiloto-redes-candidatos__avatar-spacer" />
          <div className="wr-copiloto-redes-candidatos__identity">
            <button
              type="button"
              className={cn(
                'wr-copiloto-redes-candidatos__head-label wr-copiloto-redes-candidatos__period-btn',
                isPeriodSort && 'wr-copiloto-redes-candidatos__period-btn--selected',
              )}
              title="Ordenar pelo engajamento total do período"
              aria-pressed={isPeriodSort}
              onClick={() => setSortMode({ type: 'period' })}
            >
              Período
            </button>
          </div>
          <div className="wr-copiloto-redes-candidatos__metric">
            <div
              className="wr-copiloto-redes-candidatos__timeline wr-copiloto-redes-candidatos__timeline--head"
              role="toolbar"
              aria-label="Ordenar por engajamento do dia"
            >
              {model.chartData.map((day) => {
                const isSelected = day.date === selectedDate
                return (
                  <button
                    key={`head-${day.date}`}
                    type="button"
                    className={cn(
                      'wr-copiloto-redes-candidatos__seg-head',
                      isSelected && 'wr-copiloto-redes-candidatos__seg-head--selected',
                    )}
                    title={`Ordenar por engajamento em ${day.label}`}
                    aria-pressed={isSelected}
                    onClick={() => setSortMode({ type: 'day', date: day.date })}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        {rowsPage.map((line) => (
          <div
            key={line.slug}
            className="wr-copiloto-redes-candidatos__row"
            role="listitem"
          >
            <CandidateAvatar name={line.name} avatarUrl={line.avatarUrl} />
            <div
              className="wr-copiloto-redes-candidatos__identity"
              title={
                line.username
                  ? `@${line.username} · ${formatInt(line.periodEngagement)} no período`
                  : `${line.actorTypeLabel} · ${formatInt(line.periodEngagement)} no período`
              }
            >
              <p className="wr-copiloto-redes-candidatos__name">{line.name}</p>
              {isPeriodSort ? (
                <span className="wr-copiloto-redes-candidatos__period-total tabular-nums">
                  {formatCompact(line.periodEngagement)}
                </span>
              ) : selectedDate ? (
                <span className="wr-copiloto-redes-candidatos__period-total tabular-nums">
                  {formatCompact(engagementOnDate(model, line.slug, selectedDate))}
                </span>
              ) : null}
            </div>
            <div className="wr-copiloto-redes-candidatos__metric">
              <div
                className="wr-copiloto-redes-candidatos__timeline"
                role="img"
                aria-label={`Linha do tempo de engajamento diário de ${line.name}`}
              >
                {model.chartData.map((day) => {
                  const value = Number(day[line.slug] ?? 0) || 0
                  const colors = segmentColors(value, dayMax)
                  const isSelected = day.date === selectedDate
                  return (
                    <div
                      key={day.date}
                      className={cn(
                        'wr-copiloto-redes-candidatos__seg',
                        value <= 0 && 'wr-copiloto-redes-candidatos__seg--empty',
                        isSelected && 'wr-copiloto-redes-candidatos__seg--selected',
                      )}
                      title={`${day.label}: ${formatInt(value)}`}
                      style={colors ? { backgroundColor: colors.backgroundColor } : undefined}
                    >
                      {showSegValues && value > 0 && colors ? (
                        <span
                          className={cn(
                            'wr-copiloto-redes-candidatos__seg-val tabular-nums',
                            colors.color === '#ffffff'
                              ? 'wr-copiloto-redes-candidatos__seg-val--on-dark'
                              : 'wr-copiloto-redes-candidatos__seg-val--on-light',
                          )}
                        >
                          {formatCompact(value)}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showPager ? (
        <div
          className="wr-copiloto-redes__pager"
          role="navigation"
          aria-label="Páginas de candidatos"
        >
          <button
            type="button"
            className="wr-copiloto-redes__pager-btn"
            disabled={pageSafe <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </button>
          <span className="wr-copiloto-redes__pager-status tabular-nums">
            {pageSafe + 1} / {pageCount}
            <span className="wr-copiloto-redes__pager-count">
              · {sortedLines.length} candidatos
            </span>
          </span>
          <button
            type="button"
            className="wr-copiloto-redes__pager-btn"
            disabled={pageSafe >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Próxima
          </button>
        </div>
      ) : null}
    </div>
  )
}
