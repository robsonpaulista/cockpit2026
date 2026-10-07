'use client'

import { TseCard, TsePill, tseTabela } from '@/components/tse/tse-ui'
import { COMPARISON_METRICS, formatMetricValue, getMetricRatio } from '@/lib/instagram-metric-comparison'
import { computeThemeComparison, type ThemeStatsBundle } from '@/lib/instagram-theme-comparison'
import { cn } from '@/lib/utils'

const rotuloMetrica = (key: string): string => COMPARISON_METRICS.find((m) => m.key === key)?.label ?? ''

export function InstagramThemeComparisonTable({ themeStats }: { themeStats: ThemeStatsBundle }) {
  const comparison = computeThemeComparison(themeStats)

  const temas = Object.entries(themeStats).sort(([keyA, a], [keyB, b]) => {
    const winsA = comparison.highlightsByKey[keyA]?.length ?? 0
    const winsB = comparison.highlightsByKey[keyB]?.length ?? 0
    if (winsB !== winsA) return winsB - winsA
    return b.avgEngagement - a.avgEngagement
  })

  return (
    <TseCard titulo="Comparativo por tema" subtitulo="Média por publicação em cada tema classificado">
      <div className={cn('mt-3', tseTabela.container, 'shadow-none ring-1 ring-[#EEEEEE]')}>
        <table className={tseTabela.table} data-tse-tabela>
          <thead className={tseTabela.thead}>
            <tr>
              <th className={tseTabela.th}>Tema</th>
              <th className={cn(tseTabela.th, 'text-right')}>Posts</th>
              {COMPARISON_METRICS.map((metric) => (
                <th key={metric.key} className={cn(tseTabela.th, 'text-right')}>
                  {metric.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {temas.map(([tema, stats]) => {
              const highlights = comparison.highlightsByKey[tema] ?? []
              const destaque = comparison.overallLeader === tema
              return (
                <tr key={tema} className={cn(tseTabela.tr, destaque && 'bg-[var(--tse-yellow-soft)]')}>
                  <td className={cn(tseTabela.td, 'min-w-[10rem]')}>
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase">{tema}</span>
                      {destaque ? <TsePill tom="amarelo">Destaque</TsePill> : null}
                    </div>
                    {highlights.length > 0 ? (
                      <p className="text-[11px] text-[var(--tse-muted)]">
                        Lidera em {highlights.map(rotuloMetrica).join(', ')}
                      </p>
                    ) : null}
                  </td>
                  <td className={cn(tseTabela.td, 'text-right tabular-nums')}>{stats.posts}</td>
                  {COMPARISON_METRICS.map((metric) => {
                    const valor = stats[metric.key]
                    const lider = comparison.winnersByMetric[metric.key] === tema
                    const ratio = getMetricRatio(valor, comparison.maxByMetric[metric.key])
                    return (
                      <td key={metric.key} className={cn(tseTabela.td, 'min-w-[6.5rem] text-right')}>
                        <p className={cn('tabular-nums', lider ? 'font-black' : 'font-semibold')}>
                          {formatMetricValue(metric.key, valor)}
                        </p>
                        <div className="ml-auto mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-[#EEEEEE]">
                          <div
                            className={cn('ml-auto h-full', lider ? 'bg-[var(--tse-yellow)]' : 'bg-[var(--tse-zero)]')}
                            style={{ width: `${Math.max(ratio, valor > 0 ? 6 : 0)}%` }}
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </TseCard>
  )
}
