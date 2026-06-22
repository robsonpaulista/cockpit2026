'use client'

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Instagram, LineChart as LineChartIcon, Megaphone, Newspaper, X, Youtube } from 'lucide-react'
import type { DotProps } from 'recharts'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PanoramaInstagramTable } from '@/components/monitoramento/panorama-instagram-table'
import { PanoramaMentionHeatmap } from '@/components/monitoramento/panorama-mention-heatmap'
import { TrendsSearchContextList } from '@/components/trends-radar/trends-search-context-block'
import type { PanoramaMetaAdsPeriodTotal, PanoramaPlatformChart, PanoramaPlatformId } from '@/lib/monitoramento-panorama-charts'
import { cn } from '@/lib/utils'

const PLATFORM_ICONS: Record<PanoramaPlatformId, LucideIcon> = {
  youtube: Youtube,
  'google-news': Newspaper,
  instagram: Instagram,
  'google-trends': LineChartIcon,
  'meta-ads': Megaphone,
}

const PLATFORM_ICON_BG: Record<PanoramaPlatformId, string> = {
  youtube: 'bg-[#FEE2E2] text-[#DC2626]',
  'google-news': 'bg-[#DBEAFE] text-[#2563EB]',
  instagram: 'bg-[#FCE7F3] text-[#DB2777]',
  'google-trends': 'bg-[#E0E7FF] text-[#4338CA]',
  'meta-ads': 'bg-[#FFEDD5] text-[#EA580C]',
}

function formatDateLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

function formatCompactBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatValue(value: number, metricLabel: string, platformId?: PanoramaPlatformId): [string, string] {
  if (platformId === 'meta-ads') {
    return [
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      }).format(value),
      metricLabel,
    ]
  }
  return [new Intl.NumberFormat('pt-BR').format(value), metricLabel]
}

type MetaAdsPointSelection = {
  slug: string
  date: string
  value: number
}

function MetaAdsPointDetail({
  selection,
  periodTotals,
  lines,
  onClose,
  className,
}: {
  selection: MetaAdsPointSelection
  periodTotals?: PanoramaMetaAdsPeriodTotal[]
  lines: PanoramaPlatformChart['lines']
  onClose?: () => void
  className?: string
}) {
  const line = lines.find((l) => l.slug === selection.slug)
  const lineTotal = periodTotals?.find((t) => t.slug === selection.slug)
  const displayName = line?.name ?? selection.slug
  const displayColor = line?.color ?? '#EA580C'

  return (
    <div
      className={cn(
        'rounded-lg border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app px-3 py-2.5 text-xs',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-text-primary">{formatDateLabel(selection.date)}</p>
          <p className="mt-1 font-medium" style={{ color: displayColor }}>
            {displayName}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-0.5 text-text-muted hover:bg-bg-surface hover:text-text-primary"
            aria-label="Fechar detalhe"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-text-secondary">
        Gasto no dia:{' '}
        <span className="font-medium text-text-primary">
          {Number.isFinite(selection.value) && selection.value > 0
            ? new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 0,
              }).format(selection.value)
            : '—'}
        </span>
      </p>
      {lineTotal ? (
        <div className="mt-2 border-t border-[rgb(var(--color-border-tertiary)/0.45)] pt-2 text-[11px] text-text-muted">
          <p className="font-medium uppercase tracking-wide text-text-secondary">Total no período</p>
          <p className="mt-1">
            Investido: <span className="text-text-primary">{lineTotal.spendLabel}</span>
          </p>
          {lineTotal.impressionsLabel ? (
            <p className="mt-0.5">
              Imp.: <span className="text-text-primary">{lineTotal.impressionsLabel}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

type MetaAdsDotProps = DotProps & {
  payload?: { date?: string }
  value?: number
}

function metaAdsDotRenderer(
  line: PanoramaPlatformChart['lines'][number],
  onSelect: (selection: MetaAdsPointSelection) => void,
  selected: MetaAdsPointSelection | null
) {
  return (props: MetaAdsDotProps) => {
    const { cx, cy, payload, value } = props
    if (cx == null || cy == null || payload == null) {
      return <circle cx={0} cy={0} r={0} fill="none" />
    }

    const num = Number(value)
    if (!Number.isFinite(num) || num <= 0) {
      return <circle cx={0} cy={0} r={0} fill="none" />
    }

    const date = String((payload as { date?: string }).date ?? '')
    const isSelected = selected?.slug === line.slug && selected.date === date

    return (
      <circle
        cx={cx}
        cy={cy}
        r={isSelected ? 6 : 3}
        fill={line.color}
        stroke={isSelected ? '#ffffff' : 'none'}
        strokeWidth={isSelected ? 1.5 : 0}
        style={{ cursor: 'pointer' }}
        onClick={(event) => {
          event.stopPropagation()
          onSelect({ slug: line.slug, date, value: num })
        }}
      />
    )
  }
}

function MetaAdsPanoramaLineChart({ chart }: { chart: PanoramaPlatformChart }) {
  const [selection, setSelection] = useState<MetaAdsPointSelection | null>(null)

  return (
    <div className="flex flex-col">
      <div className="mb-2 h-[112px] shrink-0 overflow-y-auto rounded-lg border border-transparent">
        {selection ? (
          <MetaAdsPointDetail
            selection={selection}
            lines={chart.lines}
            periodTotals={chart.periodTotals}
            onClose={() => setSelection(null)}
          />
        ) : (
          <p className="flex h-full items-center px-1 text-[10px] leading-snug text-text-muted">
            Clique em um ponto para ver gasto do dia e total no período.
          </p>
        )}
      </div>

      <div className="h-[220px] w-full shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chart.chartData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            onClick={() => setSelection(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border-tertiary)/0.45)" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 10, fill: 'rgb(var(--color-text-muted))' }}
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'rgb(var(--color-text-muted))' }}
              width={52}
              tickFormatter={(v) => formatCompactBrl(v)}
            />
            {chart.lines.map((line) => (
              <Line
                key={line.slug}
                type="monotone"
                dataKey={line.slug}
                name={line.name}
                stroke={line.color}
                strokeWidth={2.5}
                dot={metaAdsDotRenderer(line, setSelection, selection)}
                activeDot={false}
                connectNulls
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
              className="inline-flex max-w-full items-center gap-1.5 text-[10px] text-text-secondary"
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
    </div>
  )
}

interface PanoramaPlatformChartProps {
  chart: PanoramaPlatformChart
  className?: string
}

export function PanoramaPlatformChart({ chart, className }: PanoramaPlatformChartProps) {
  const Icon = PLATFORM_ICONS[chart.id]
  const isMetaAds = chart.id === 'meta-ads'
  const isDetail = chart.layoutTier === 'detail'
  const isHeatmap = chart.chartType === 'heatmap'
  const isTable = chart.chartType === 'table'
  const expandChart = !isHeatmap && !isTable && !chart.empty
  const useExternalLegend = expandChart && chart.lines.length > 0

  return (
    <div
      className={cn(
        'flex h-full flex-col rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-4',
        isDetail ? 'min-h-[440px]' : 'min-h-[360px]',
        className
      )}
    >
      <div className="mb-3 flex shrink-0 items-start gap-3">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            PLATFORM_ICON_BG[chart.id]
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">{chart.title}</h3>
          <p className="text-xs text-text-muted">{chart.subtitle}</p>
        </div>
      </div>

      {chart.empty ? (
        <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--color-border-tertiary)/0.6)] text-xs text-text-muted">
          {chart.id === 'instagram'
            ? 'Sem posts no período — cadastre @ e rode a coleta na aba Instagram.'
            : 'Sem série histórica — rode a coleta nesta plataforma.'}
        </div>
      ) : isTable && chart.instagramTable ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <PanoramaInstagramTable rows={chart.instagramTable} className="min-h-0 flex-1" />
        </div>
      ) : isHeatmap && chart.heatmapDates && chart.heatmapRows ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <PanoramaMentionHeatmap
            dates={chart.heatmapDates}
            rows={chart.heatmapRows}
            metricLabel={chart.metricLabel}
            enableNewsModal={chart.id === 'google-news'}
            className="min-h-0 flex-1"
          />
        </div>
      ) : isMetaAds ? (
        <MetaAdsPanoramaLineChart chart={chart} />
      ) : (
        <div className={cn('flex min-h-0 flex-col', expandChart && 'flex-1')}>
          <div
            className={cn(
              'w-full',
              expandChart ? 'min-h-0 flex-1 min-h-[200px]' : 'h-[220px]'
            )}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chart.chartData}
                margin={{ top: 4, right: 8, left: chart.id === 'youtube' ? 4 : 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border-tertiary)/0.45)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateLabel}
                  tick={{ fontSize: 10, fill: 'rgb(var(--color-text-muted))' }}
                  minTickGap={expandChart ? 20 : 28}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'rgb(var(--color-text-muted))' }}
                  width={chart.id === 'youtube' ? 44 : 36}
                  allowDecimals={chart.id === 'google-trends' ? false : true}
                  domain={chart.id === 'google-trends' ? [0, 100] : [0, 'auto']}
                  tickFormatter={
                    chart.id === 'youtube' ? (v) => formatCompactNumber(v) : undefined
                  }
                />
                <Tooltip
                  labelFormatter={(v) => formatDateLabel(String(v))}
                  formatter={(value: number, _name, item) => {
                    const line = chart.lines.find((l) => l.slug === item.dataKey)
                    return formatValue(value, line?.name ?? chart.metricLabel, chart.id)
                  }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
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
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {useExternalLegend ? (
            <div className="mt-2 shrink-0 border-t border-[rgb(var(--color-border-tertiary)/0.45)] pt-2">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {chart.lines.map((line) => (
                  <span
                    key={line.slug}
                    className="inline-flex max-w-full items-center gap-1.5 text-[10px] text-text-secondary"
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
          ) : null}
          {chart.id === 'google-trends' && chart.searchContexts && chart.searchContexts.length > 0 ? (
            <TrendsSearchContextList contexts={chart.searchContexts} className="mt-3 shrink-0" />
          ) : null}
        </div>
      )}
    </div>
  )
}
