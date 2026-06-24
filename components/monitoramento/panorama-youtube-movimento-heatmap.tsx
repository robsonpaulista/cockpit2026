'use client'

import { useMemo, useState } from 'react'
import {
  PanoramaYoutubeDayModal,
  type PanoramaYoutubeDaySelection,
} from '@/components/monitoramento/panorama-youtube-day-modal'
import { heatmapCellColor } from '@/lib/monitoramento-heatmap-colors'
import type { YoutubePanoramaHeatmapRow } from '@/lib/youtube-panorama-series'
import {
  typographyBodyMediumClass,
  typographyBodyMutedClass,
} from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

type YoutubeHeatmapHover = {
  name: string
  date: string
  views: number
  percent: number
}

function formatDayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

function formatTooltipDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatViews(value: number): string {
  return `${new Intl.NumberFormat('pt-BR').format(value)} views`
}

function formatPeakPercent(value: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value)}% do pico individual`
}

function monthTicks(dates: string[]): Array<{ index: number; label: string }> {
  const ticks: Array<{ index: number; label: string }> = []
  let lastMonth = ''
  dates.forEach((date, index) => {
    const month = date.slice(0, 7)
    if (month !== lastMonth) {
      ticks.push({
        index,
        label: new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }),
      })
      lastMonth = month
    }
  })
  return ticks
}

interface PanoramaYoutubeMovimentoHeatmapProps {
  dates: string[]
  rows: YoutubePanoramaHeatmapRow[]
  className?: string
}

export function PanoramaYoutubeMovimentoHeatmap({
  dates,
  rows,
  className,
}: PanoramaYoutubeMovimentoHeatmapProps) {
  const [hover, setHover] = useState<YoutubeHeatmapHover | null>(null)
  const [selection, setSelection] = useState<PanoramaYoutubeDaySelection | null>(null)
  const ticks = useMemo(() => monthTicks(dates), [dates])

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className={cn('mb-2 min-h-[36px] shrink-0 rounded-lg border border-[rgb(var(--color-border-tertiary)/0.45)] bg-bg-app px-2.5 py-2 leading-snug', typographyBodyMutedClass)}>
        {hover ? (
          <span>
            <span className="font-medium text-text-primary">{hover.name}</span>
            {' · '}
            {formatTooltipDate(hover.date)}
            {' · '}
            <span className="font-medium text-text-primary">{formatPeakPercent(hover.percent)}</span>
            {' · '}
            <span className="text-text-secondary">{formatViews(hover.views)}</span>
          </span>
        ) : (
          'Passe o mouse sobre uma célula · clique em um dia com atividade para ver os vídeos'
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto pr-0.5">
        <div className="min-w-[520px]">
          {rows.map((row, rowIndex) => (
            <div key={row.slug} className="mb-1.5 flex items-center gap-2 last:mb-0">
              <span
                className={cn('w-[120px] shrink-0 truncate text-text-secondary', typographyBodyMediumClass)}
                title={row.name}
              >
                {row.name}
              </span>
              <div className="flex min-w-0 flex-1 gap-[3px]">
                {row.normalizedValues.map((normalized, dayIndex) => {
                  const views = row.values[dayIndex]
                  const date = dates[dayIndex]
                  const percent = normalized * 100
                  const hasActivity = views > 0
                  return (
                    <button
                      key={`${row.slug}-${date}`}
                      type="button"
                      disabled={!hasActivity}
                      className={cn(
                        'animate-panorama-heatmap-cell h-[18px] min-w-0 flex-1 rounded-[3px] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(var(--color-primary))]',
                        hasActivity ? 'cursor-pointer' : 'cursor-default'
                      )}
                      style={{
                        backgroundColor: heatmapCellColor(row.color, normalized, 1, 'individual'),
                        animationDelay: `${rowIndex * 22 + dayIndex * 5}ms`,
                      }}
                      title={`${row.name} · ${formatDayLabel(date)} · ${formatViews(views)} · ${formatPeakPercent(percent)}${
                        hasActivity ? ' · clique para ver vídeos' : ''
                      }`}
                      aria-label={`${row.name}, ${formatDayLabel(date)}: ${formatViews(views)}, ${formatPeakPercent(percent)}`}
                      onMouseEnter={() =>
                        setHover({
                          name: row.name,
                          date,
                          views,
                          percent,
                        })
                      }
                      onMouseLeave={() => setHover(null)}
                      onClick={(event) => {
                        if (!hasActivity) return
                        setSelection({
                          slug: row.slug,
                          name: row.name,
                          date,
                          count: views,
                          anchor: { x: event.clientX, y: event.clientY },
                        })
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ))}

          {ticks.length > 0 ? (
            <div className="mt-1 flex gap-2 pl-[128px]">
              <div className="relative h-3 min-w-0 flex-1">
                {ticks.map((tick) => (
                  <span
                    key={tick.index}
                    className={cn('absolute', typographyBodyMutedClass)}
                    style={{ left: `${(tick.index / Math.max(dates.length - 1, 1)) * 100}%` }}
                  >
                    {tick.label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className={cn('mt-2 flex shrink-0 flex-wrap items-center gap-2', typographyBodyMutedClass)}>
        <span>Sem atividade</span>
        <div className="flex gap-[2px]">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <div
              key={t}
              className="h-3 w-4 rounded-[2px]"
              style={{
                backgroundColor: heatmapCellColor('#374151', t, 1, 'individual'),
              }}
            />
          ))}
        </div>
        <span>Pico do candidato (escala própria)</span>
      </div>

      <PanoramaYoutubeDayModal selection={selection} onClose={() => setSelection(null)} />
    </div>
  )
}
