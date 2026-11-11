'use client'

import { PanoramaKpiStripTse } from '@/components/monitoramento/panorama-kpi-strip-tse'
import { PanoramaPlatformChart } from '@/components/monitoramento/panorama-platform-chart'
import { TseCarregando, TseVazio } from '@/components/tse/tse-ui'
import type { PanoramaModel } from '@/lib/monitoramento-panorama'
import type { PanoramaPlatformChart as PanoramaChartModel } from '@/lib/monitoramento-panorama-charts'
import { cn } from '@/lib/utils'

function chartsByTier(charts: PanoramaChartModel[], tier: 'detail' | 'simple'): PanoramaChartModel[] {
  return charts.filter((chart) => chart.layoutTier === tier)
}

type Props = {
  panorama: PanoramaModel
  loading?: boolean
  refreshing?: boolean
  animationEpoch?: number
}

export function PanoramaBoardTse({
  panorama,
  loading = false,
  refreshing = false,
  animationEpoch = 0,
}: Props) {
  if (loading && panorama.columns.length === 0) {
    return <TseCarregando texto="Carregando panorama…" />
  }

  if (panorama.columns.length === 0) {
    return (
      <TseVazio>
        Cadastre candidatos ativos e colete dados nas abas YouTube, Google News, Instagram, Meta Ads e Buscas.
      </TseVazio>
    )
  }

  const detailCharts = chartsByTier(panorama.charts, 'detail')
  const simpleCharts = chartsByTier(panorama.charts, 'simple')

  return (
    <div className={cn('flex flex-col gap-5 transition-opacity duration-300', refreshing && 'opacity-80')}>
      <PanoramaKpiStripTse cards={panorama.platformKpis} />

      {detailCharts.length > 0 ? (
        <section>
          <div className="mb-3">
            <p className="text-xl font-bold uppercase">Imprensa e Instagram</p>
            <p className="mt-1 text-[15px] text-[var(--tse-muted)]">Detalhe comparativo · heatmap e tabela</p>
          </div>
          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            {detailCharts.map((chart) => (
              <PanoramaPlatformChart
                key={`${chart.id}-${animationEpoch}`}
                chart={chart}
                animationEpoch={animationEpoch}
              />
            ))}
          </div>
        </section>
      ) : null}

      {simpleCharts.length > 0 ? (
        <section>
          <div className="mb-3">
            <p className="text-xl font-bold uppercase">YouTube, Trends e Meta Ads</p>
            <p className="mt-1 text-[15px] text-[var(--tse-muted)]">Séries diárias · evolução no período</p>
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {simpleCharts.map((chart) => (
              <PanoramaPlatformChart
                key={`${chart.id}-${animationEpoch}`}
                chart={chart}
                animationEpoch={animationEpoch}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
