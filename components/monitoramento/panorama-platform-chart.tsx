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
import {
  PanoramaHeatmapScaleToggle,
  PanoramaMentionHeatmap,
} from '@/components/monitoramento/panorama-mention-heatmap'
import { PanoramaYoutubeChart } from '@/components/monitoramento/panorama-youtube-chart'
import { TrendsSearchContextList } from '@/components/trends-radar/trends-search-context-block'
import { PANORAMA_TSE_CHART } from '@/components/monitoramento/panorama-tse-chrome'
import { TseCard } from '@/components/tse/tse-ui'
import type { HeatmapScaleMode } from '@/lib/monitoramento-heatmap-colors'
import type { PanoramaMetaAdsPeriodTotal, PanoramaPlatformChart, PanoramaPlatformId } from '@/lib/monitoramento-panorama-charts'
import { cn } from '@/lib/utils'

const PLATFORM_ICONS: Record<PanoramaPlatformId, LucideIcon> = {
  youtube: Youtube,
  'google-news': Newspaper,
  instagram: Instagram,
  'google-trends': LineChartIcon,
  'meta-ads': Megaphone,
}

/** Altura fixa para cards com gráfico de linha (YouTube, Trends, Meta). */
const PANORAMA_CHART_CARD_HEIGHT_SIMPLE = 'h-[440px]'

const LINE_ANIMATION_DURATION = 680
const LINE_ANIMATION_STAGGER_MS = 90

function panoramaLineAnimationProps(lineIndex: number) {
  return {
    isAnimationActive: true as const,
    animationDuration: LINE_ANIMATION_DURATION,
    animationBegin: lineIndex * LINE_ANIMATION_STAGGER_MS,
    animationEasing: 'ease-out' as const,
  }
}

function formatDateLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  })
}

function formatCompactCount(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value)
}

function formatValue(value: number, metricLabel: string, platformId?: PanoramaPlatformId): [string, string] {
  if (platformId === 'meta-ads') {
    return [formatCompactCount(value), metricLabel]
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
  const displayColor = line?.color ?? 'var(--tse-olive)'

  return (
    <div className={cn('rounded-lg border border-[var(--tse-border)] bg-[var(--tse-bar)] px-3 py-2.5 text-[13px]', className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--tse-text)]">{formatDateLabel(selection.date)}</p>
          <p className="mt-1 font-medium" style={{ color: displayColor }}>
            {displayName}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-0.5 text-[var(--tse-muted)] hover:bg-white hover:text-[var(--tse-text)]"
            aria-label="Fechar detalhe"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-[var(--tse-muted)]">
        Anúncios iniciados no dia:{' '}
        <span className="font-medium text-[var(--tse-text)]">
          {Number.isFinite(selection.value) && selection.value > 0
            ? formatCompactCount(selection.value)
            : '—'}
        </span>
      </p>
      {lineTotal ? (
        <div className="mt-2 border-t border-[var(--tse-border)] pt-2 text-[12px] text-[var(--tse-muted)]">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">Total no período</p>
          <p className="mt-1">
            Ativos: <span className="font-medium text-[var(--tse-text)]">{formatCompactCount(lineTotal.activeCount)}</span>
          </p>
          {lineTotal.spendLabel !== '—' ? (
            <p className="mt-0.5">
              Investido: <span className="font-medium text-[var(--tse-text)]">{lineTotal.spendLabel}</span>
            </p>
          ) : null}
          {lineTotal.impressionsLabel ? (
            <p className="mt-0.5">
              Imp.: <span className="font-medium text-[var(--tse-text)]">{lineTotal.impressionsLabel}</span>
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
  index?: number
}

function metaAdsDotRenderer(
  line: PanoramaPlatformChart['lines'][number],
  lineIndex: number,
  onSelect: (selection: MetaAdsPointSelection) => void,
  selected: MetaAdsPointSelection | null
) {
  return (props: MetaAdsDotProps) => {
    const { cx, cy, payload, value, index } = props
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
        className="animate-panorama-chart-dot"
        style={{
          cursor: 'pointer',
          animationDelay: `${
            lineIndex * LINE_ANIMATION_STAGGER_MS + LINE_ANIMATION_DURATION * 0.5 + (index ?? 0) * 22
          }ms`,
        }}
        onClick={(event) => {
          event.stopPropagation()
          onSelect({ slug: line.slug, date, value: num })
        }}
      />
    )
  }
}

export function PanoramaTrendsLegacyLineChart({ chart }: { chart: PanoramaPlatformChart }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[180px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chart.chartData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={PANORAMA_TSE_CHART.grade} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 11, fill: PANORAMA_TSE_CHART.tick }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: PANORAMA_TSE_CHART.tick }}
              width={36}
              allowDecimals={false}
              domain={[0, 100]}
            />
            <Tooltip
              labelFormatter={(v) => formatDateLabel(String(v))}
              formatter={(value: number, _name, item) => {
                const line = chart.lines.find((l) => l.slug === item.dataKey)
                return formatValue(value, line?.name ?? chart.metricLabel, chart.id)
              }}
              contentStyle={PANORAMA_TSE_CHART.tooltip}
            />
            {chart.lines.map((line, lineIndex) => (
              <Line
                key={line.slug}
                type="monotone"
                dataKey={line.slug}
                name={line.name}
                stroke={line.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
                {...panoramaLineAnimationProps(lineIndex)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        {chart.lines.map((line) => (
          <li key={line.slug} className="flex items-center gap-1.5" title={line.name}>
            <span className="h-3 w-3 shrink-0" style={{ backgroundColor: line.color }} aria-hidden />
            {line.name}
          </li>
        ))}
      </ul>
      {chart.searchContexts && chart.searchContexts.length > 0 ? (
        <div className="mt-2 max-h-[120px] shrink-0 overflow-y-auto">
          <TrendsSearchContextList contexts={chart.searchContexts} />
        </div>
      ) : null}
    </div>
  )
}

export function MetaAdsPanoramaLineChart({ chart }: { chart: PanoramaPlatformChart }) {
  const [selection, setSelection] = useState<MetaAdsPointSelection | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 h-[80px] shrink-0 overflow-y-auto">
        {selection ? (
          <MetaAdsPointDetail
            selection={selection}
            lines={chart.lines}
            periodTotals={chart.periodTotals}
            onClose={() => setSelection(null)}
          />
        ) : (
          <p className="flex h-full items-center text-[13px] leading-snug text-[var(--tse-muted)]">
            Clique em um ponto para ver anúncios do dia e total no período.
          </p>
        )}
      </div>

      <div className="min-h-[140px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chart.chartData}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            onClick={() => setSelection(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={PANORAMA_TSE_CHART.grade} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fontSize: 11, fill: PANORAMA_TSE_CHART.tick }}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: PANORAMA_TSE_CHART.tick }}
              width={40}
              allowDecimals={false}
              tickFormatter={(v) => formatCompactCount(v)}
            />
            {chart.lines.map((line, lineIndex) => (
              <Line
                key={line.slug}
                type="monotone"
                dataKey={line.slug}
                name={line.name}
                stroke={line.color}
                strokeWidth={2}
                dot={metaAdsDotRenderer(line, lineIndex, setSelection, selection)}
                activeDot={false}
                connectNulls
                {...panoramaLineAnimationProps(lineIndex)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        {chart.lines.map((line) => (
          <li key={line.slug} className="flex items-center gap-1.5" title={line.name}>
            <span className="h-3 w-3 shrink-0" style={{ backgroundColor: line.color }} aria-hidden />
            {line.name}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface PanoramaPlatformChartProps {
  chart: PanoramaPlatformChart
  className?: string
  staggerIndex?: number
  animationEpoch?: number
  /** Cor base do heatmap comparativo (opcional). */
  heatmapComparativeBase?: string
}

export function PanoramaPlatformChart({
  chart,
  className,
  animationEpoch = 0,
  heatmapComparativeBase,
}: PanoramaPlatformChartProps) {
  const Icon = PLATFORM_ICONS[chart.id]
  const isMetaAds = chart.id === 'meta-ads'
  const isYoutube = chart.id === 'youtube'
  const isHeatmap = chart.chartType === 'heatmap'
  const isTable = chart.chartType === 'table'
  const isDetailLayout = chart.layoutTier === 'detail'
  const [heatmapScaleMode, setHeatmapScaleMode] = useState<HeatmapScaleMode>('comparative')

  return (
    <TseCard
      className={cn(
        'flex flex-col overflow-hidden',
        isDetailLayout ? 'h-full min-h-0' : PANORAMA_CHART_CARD_HEIGHT_SIMPLE,
        className,
      )}
      titulo={
        <span className="inline-flex items-center gap-2">
          <Icon className="h-5 w-5 fill-[var(--tse-yellow)] text-[var(--tse-yellow)]" aria-hidden />
          {chart.title}
        </span>
      }
      subtitulo={isYoutube ? undefined : chart.subtitle}
      acao={
        isHeatmap && !chart.empty ? (
          <PanoramaHeatmapScaleToggle
            scaleMode={heatmapScaleMode}
            onScaleModeChange={setHeatmapScaleMode}
          />
        ) : undefined
      }
    >
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {chart.empty ? (
          <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-xl border-2 border-dashed border-[var(--tse-border)] text-[14px] text-[var(--tse-muted)]">
            {chart.id === 'instagram'
              ? 'Sem posts no período — cadastre @ e rode a coleta na aba Instagram.'
              : 'Sem série histórica — rode a coleta nesta plataforma.'}
          </div>
        ) : isTable && chart.instagramTable ? (
          <PanoramaInstagramTable
            rows={chart.instagramTable}
            animationEpoch={animationEpoch}
            className="min-h-0 flex-1"
          />
        ) : isHeatmap && chart.heatmapDates && chart.heatmapRows ? (
          <PanoramaMentionHeatmap
            dates={chart.heatmapDates}
            rows={chart.heatmapRows}
            metricLabel={chart.metricLabel}
            enableNewsModal={chart.id === 'google-news'}
            scaleMode={heatmapScaleMode}
            onScaleModeChange={setHeatmapScaleMode}
            hideScaleControls
            fillAvailableHeight={isDetailLayout}
            comparativeBaseColor={heatmapComparativeBase}
            className="min-h-0 flex-1"
          />
        ) : isMetaAds ? (
          <MetaAdsPanoramaLineChart chart={chart} />
        ) : isYoutube ? (
          <PanoramaYoutubeChart chart={chart} className="min-h-0 flex-1" />
        ) : (
          <PanoramaTrendsLegacyLineChart chart={chart} />
        )}
      </div>
    </TseCard>
  )
}
