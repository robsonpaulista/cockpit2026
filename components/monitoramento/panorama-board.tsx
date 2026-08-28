'use client'

import { PanoramaBoardSkeleton } from '@/components/monitoramento/panorama-board-skeleton'
import { PanoramaIntelligenceSection } from '@/components/monitoramento/panorama-intelligence-section'
import { PanoramaPlatformChart } from '@/components/monitoramento/panorama-platform-chart'
import { PanoramaPlatformKpiStrip } from '@/components/monitoramento/panorama-platform-kpi-strip'
import type { PanoramaModel } from '@/lib/monitoramento-panorama'
import type { PanoramaPlatformChart as PanoramaChartModel } from '@/lib/monitoramento-panorama-charts'
import { typographySectionLabelClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

function chartsByTier(charts: PanoramaChartModel[], tier: 'detail' | 'simple'): PanoramaChartModel[] {
  return charts.filter((chart) => chart.layoutTier === tier)
}

interface PanoramaBoardProps {
  panorama: PanoramaModel
  loading?: boolean
  refreshing?: boolean
  animationEpoch?: number
  /** Cor base do heatmap “Todos” (ex.: azul WR no Copiloto). */
  heatmapComparativeBase?: string
  /** WR Copiloto: cards de inteligência competitiva em vez de line charts. */
  intelligenceMode?: boolean
}

export function PanoramaBoard({
  panorama,
  loading = false,
  refreshing = false,
  animationEpoch = 0,
  heatmapComparativeBase,
  intelligenceMode = false,
}: PanoramaBoardProps) {
  if (loading) {
    return <PanoramaBoardSkeleton />
  }

  if (panorama.columns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-6 py-14 text-center text-sm text-text-muted">
        Cadastre candidatos ativos e colete dados nas abas YouTube, Google News, Instagram, Meta Ads e
        Trends.
      </div>
    )
  }

  const detailCharts = chartsByTier(panorama.charts, 'detail')
  const simpleCharts = chartsByTier(panorama.charts, 'simple')

  return (
    <div
      className={cn(
        'flex flex-col gap-4 transition-opacity duration-300',
        refreshing && 'opacity-80'
      )}
    >
      <PanoramaPlatformKpiStrip cards={panorama.platformKpis} animationEpoch={animationEpoch} />

      {detailCharts.length > 0 ? (
        <section>
          <h3 className={cn('mb-3', typographySectionLabelClass)}>
            Imprensa e Instagram · detalhe comparativo
          </h3>
          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            {detailCharts.map((chart, chartIndex) => (
              <PanoramaPlatformChart
                key={`${chart.id}-${animationEpoch}`}
                chart={chart}
                staggerIndex={chartIndex}
                animationEpoch={animationEpoch}
                heatmapComparativeBase={heatmapComparativeBase}
              />
            ))}
          </div>
        </section>
      ) : null}

      {simpleCharts.length > 0 ? (
        <section>
          <h3 className={cn('mb-3', typographySectionLabelClass)}>
            {intelligenceMode
              ? 'YouTube, Trends e Meta Ads · inteligência competitiva'
              : 'YouTube, Trends e Meta Ads · séries diárias'}
          </h3>
          {intelligenceMode ? (
            <PanoramaIntelligenceSection
              charts={simpleCharts}
              columns={panorama.columns}
              animationEpoch={animationEpoch}
            />
          ) : (
            <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {simpleCharts.map((chart, chartIndex) => (
                <PanoramaPlatformChart
                  key={`${chart.id}-${animationEpoch}`}
                  chart={chart}
                  staggerIndex={detailCharts.length + chartIndex}
                  animationEpoch={animationEpoch}
                  heatmapComparativeBase={heatmapComparativeBase}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
