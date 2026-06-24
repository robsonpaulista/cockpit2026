'use client'

import { useMemo, useState } from 'react'
import type { TooltipProps } from 'recharts'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PanoramaYoutubeMovimentoHeatmap } from '@/components/monitoramento/panorama-youtube-movimento-heatmap'
import type { PanoramaPlatformChart } from '@/lib/monitoramento-panorama-charts'
import {
  buildYoutubeAbsoluteSeries,
  buildYoutubeMovimentoHeatmap,
  type YoutubePanoramaViewMode,
  youtubePanoramaSubtitle,
} from '@/lib/youtube-panorama-series'
import { chromeFilterChipClass } from '@/lib/button-chrome'
import {
  typographyBodyClass,
  typographyBodyMutedClass,
} from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

const VIEW_OPTIONS: { value: YoutubePanoramaViewMode; label: string }[] = [
  { value: 'volume', label: 'Volume' },
  { value: 'movimento', label: 'Movimento' },
]

const MOVIMENTO_HINT =
  'Cada linha usa escala própria. Use para identificar picos e atividade recente, não para comparar volume entre candidatos. Clique em um dia para ver os vídeos.'

function formatDateLabel(iso: string): string {
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

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatViews(value: number): string {
  return `${new Intl.NumberFormat('pt-BR').format(value)} views`
}

type YoutubeVolumeTooltipProps = TooltipProps<number, string> & {
  absoluteRows: ReturnType<typeof buildYoutubeAbsoluteSeries>
  lines: PanoramaPlatformChart['lines']
}

function YoutubeVolumeTooltip({ active, payload, label, absoluteRows, lines }: YoutubeVolumeTooltipProps) {
  if (!active || !payload?.length || label == null) return null

  const date = String(label)
  const absoluteRow = absoluteRows.find((row) => row.date === date)
  const entries = payload
    .map((item) => {
      const slug = String(item.dataKey ?? '')
      const line = lines.find((l) => l.slug === slug)
      const absolute = Number(absoluteRow?.[slug] ?? 0)
      if (!line || absolute <= 0) return null
      return { line, absolute }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.absolute - a.absolute)

  if (entries.length === 0) return null

  return (
    <div className={cn('max-w-[240px] rounded-lg border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-3 py-2.5 shadow-sm', typographyBodyClass)}>
      {entries.map((entry) => (
        <div
          key={entry.line.slug}
          className="border-b border-[rgb(var(--color-border-tertiary)/0.35)] py-1.5 first:pt-0 last:border-b-0 last:pb-0"
        >
          <p className="font-semibold" style={{ color: entry.line.color }}>
            {entry.line.name}
          </p>
          <p className="mt-0.5 text-text-muted">{formatTooltipDate(date)}</p>
          <p className="mt-1 font-medium text-text-primary">{formatViews(entry.absolute)}</p>
        </div>
      ))}
    </div>
  )
}

interface PanoramaYoutubeChartProps {
  chart: PanoramaPlatformChart
  className?: string
}

export function PanoramaYoutubeChart({ chart, className }: PanoramaYoutubeChartProps) {
  const [viewMode, setViewMode] = useState<YoutubePanoramaViewMode>('volume')
  const absoluteSeries = useMemo(() => buildYoutubeAbsoluteSeries(chart), [chart])
  const movimentoHeatmap = useMemo(() => buildYoutubeMovimentoHeatmap(chart), [chart])
  const subtitle = youtubePanoramaSubtitle(viewMode)
  const isMovimento = viewMode === 'movimento'

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="mb-2 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className={typographyBodyMutedClass}>{subtitle}</p>
        <div className="flex shrink-0 gap-1">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setViewMode(opt.value)}
              className={chromeFilterChipClass(viewMode === opt.value)}
              aria-pressed={viewMode === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isMovimento ? (
        <p className={cn('mb-2 shrink-0 leading-snug', typographyBodyMutedClass)}>{MOVIMENTO_HINT}</p>
      ) : null}

      {isMovimento ? (
        <PanoramaYoutubeMovimentoHeatmap
          dates={movimentoHeatmap.dates}
          rows={movimentoHeatmap.rows}
          className="min-h-0 flex-1"
        />
      ) : (
        <>
          <div className="min-h-[160px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={absoluteSeries} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border-tertiary)/0.45)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tick={{ fontSize: 13, fill: 'rgb(var(--color-text-muted))' }}
                  minTickGap={20}
                />
                <YAxis
                  tick={{ fontSize: 13, fill: 'rgb(var(--color-text-muted))' }}
                  width={44}
                  domain={[0, 'auto']}
                  tickFormatter={(value) => formatCompactNumber(Number(value))}
                />
                <Tooltip
                  content={
                    <YoutubeVolumeTooltip absoluteRows={absoluteSeries} lines={chart.lines} />
                  }
                />
                {chart.lines.map((line) => (
                  <Line
                    key={line.slug}
                    type="monotone"
                    dataKey={line.slug}
                    name={line.name}
                    stroke={line.color}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0, cursor: 'pointer' }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 shrink-0 border-t border-[rgb(var(--color-border-tertiary)/0.45)] pt-2">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {chart.lines.map((line) => (
                <span
                  key={line.slug}
                  className={cn('inline-flex max-w-full items-center gap-1.5 text-text-secondary', typographyBodyMutedClass)}
                  title={line.name}
                >
                  <span
                    className="h-0.5 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: line.color }}
                    aria-hidden
                  />
                  <span className="truncate">{line.name}</span>
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
