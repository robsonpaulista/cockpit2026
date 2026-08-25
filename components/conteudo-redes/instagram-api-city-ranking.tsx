'use client'

import { IconMapPin, IconUsers } from '@tabler/icons-react'
import { InstagramCityTrendChart } from '@/components/conteudo-redes/instagram-city-trend-chart'
import { PremiumMetricCard } from '@/components/premium/metric-card'
import type { CityDemographicsSeriesPoint } from '@/lib/instagram-city-demographics-history'
import type { CityTrendPoint } from '@/lib/instagram-city-trend'
import { cn } from '@/lib/utils'
import { conteudoRedesAmberTextClass } from '@/lib/conteudo-redes-styles'

type Props = {
  mode: 'followers' | 'engaged'
  locationMap: Record<string, number> | undefined
  totalFollowers: number
  seriesByCity: Record<string, CityDemographicsSeriesPoint[]>
  cardClassName: string
}

function seriesForCity(
  city: string,
  mode: 'followers' | 'engaged',
  seriesByCity: Record<string, CityDemographicsSeriesPoint[]>,
): CityTrendPoint[] {
  const rows = seriesByCity[city] ?? []
  return rows.map((row) => ({
    date: row.date,
    value: mode === 'engaged' ? row.engaged : row.followers,
  }))
}

export function InstagramApiCityRanking({
  mode,
  locationMap,
  totalFollowers,
  seriesByCity,
  cardClassName,
}: Props) {
  const isEngaged = mode === 'engaged'
  const entries = Object.entries(locationMap || {}).sort(([, a], [, b]) => b - a)
  const mappedTotal = entries.reduce((sum, [, count]) => sum + count, 0)
  const maxCount = Math.max(...entries.map(([, count]) => count), 0)
  const unitLabel = isEngaged ? 'contas engajadas' : 'seguidores'
  const metricLabel = isEngaged ? 'Engajamento mapeado' : 'Seguidores mapeados'
  const pctBase = isEngaged ? mappedTotal : totalFollowers
  const pctSuffix = isEngaged ? 'do engajamento mapeado' : 'do total de seguidores'
  const valueLabel = isEngaged ? 'Engajados' : 'Seguidores'

  if (entries.length === 0) {
    return (
      <div className="py-12 text-center">
        <IconMapPin
          className={cn('mx-auto mb-4 h-12 w-12 opacity-70', conteudoRedesAmberTextClass)}
          stroke={1.5}
        />
        <p className="mb-2 font-medium">
          {isEngaged
            ? 'Engajamento por cidade não disponível'
            : 'Dados de localização não disponíveis'}
        </p>
        <p className="mx-auto max-w-lg text-sm">
          {isEngaged
            ? 'A API exige pelo menos 100 engajamentos no período (this_month) e pode atrasar até 48h. Use Atualizar para forçar nova coleta.'
            : 'A API exige conta profissional com 100+ seguidores e pode atrasar até 48h. Use Atualizar para forçar nova coleta.'}{' '}
          A Meta devolve só o top de cidades (não o histórico por postagem nem os 224 municípios).
        </p>
      </div>
    )
  }

  return (
    <>
      <p className="mb-3 text-[12px] text-black/60">
        {isEngaged
          ? 'Quem interagiu com publicações no período (engaged_audience_demographics · this_month).'
          : 'Base atual de seguidores (follower_demographics · last_30_days).'}{' '}
        A Meta não entrega série por post — o gráfico usa snapshots diários salvos a cada atualização.
      </p>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-lg">
        <PremiumMetricCard label="Total de cidades" value={entries.length} icon={IconMapPin} />
        <PremiumMetricCard
          label={metricLabel}
          value={mappedTotal.toLocaleString('pt-BR')}
          icon={IconUsers}
        />
      </div>

      <div className="space-y-2">
        {entries.map(([city, count], index) => {
          const percentage = pctBase > 0 ? ((count / pctBase) * 100).toFixed(1) : '0.0'
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0
          const points = seriesForCity(city, mode, seriesByCity)

          return (
            <div key={`${mode}-${city}`} className={cn(cardClassName, 'p-4')}>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-medium',
                      index === 0
                        ? 'bg-[var(--palette-accent)] text-white'
                        : 'bg-[var(--palette-inst-soft)] text-[var(--palette-inst)]',
                    )}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{city}</p>
                    <p className="text-[11px]">
                      {percentage}% {pctSuffix}
                    </p>
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-base font-medium tabular-nums text-[var(--palette-inst)]">
                    {count.toLocaleString('pt-BR')}
                  </p>
                  <p className="text-[11px]">{unitLabel}</p>
                </div>
              </div>
              <InstagramCityTrendChart
                points={points}
                valueLabel={valueLabel}
                emptyHint="Ainda sem histórico diário. Clique em Atualizar em dias diferentes para formar a linha do tempo."
              />
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-app">
                <div
                  className="h-full rounded-full bg-[var(--palette-inst)] transition-all duration-500"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
