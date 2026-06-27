'use client'

import { IconInfoCircle, IconRocket, IconSwords, IconTrophy } from '@tabler/icons-react'
import { formatInt, formatPct } from '@/lib/mapa-exercito-digital-aggregator'
import {
  buildCityInsights,
  getHeatmapLabels,
  heatCellStyle,
} from '@/lib/mapa-exercito-digital-gamification'
import type { ExercitoDigitalCityRow } from '@/lib/mapa-exercito-digital-types'
import type { ExercitoDigitalAudience } from '@/lib/mandatos-instagram-piaui'
import {
  exercitoDualPanelItemClass,
  exercitoSectionCardClass,
  exercitoSectionSubtitleClass,
  exercitoSectionTitleClass,
} from '@/lib/mapa-exercito-digital-layout'
import { cn } from '@/lib/utils'

interface ExercitoDigitalCityPanelProps {
  cities: ExercitoDigitalCityRow[]
  organicTail: { comentarios: number; perfis: number }
  audience: ExercitoDigitalAudience
  referenceMonth: string
  referenceMonthLabel: string
}

const HEATMAP_ROWS = 4
const TOP_CARD_ICONS = [IconTrophy, IconSwords, IconRocket] as const
const TOP_CARD_LABELS = ['Líder', 'Disputa', 'Eficiência'] as const

export function ExercitoDigitalCityPanel({
  cities,
  organicTail,
  audience,
  referenceMonth,
  referenceMonthLabel,
}: ExercitoDigitalCityPanelProps) {
  const active = cities.filter((c) => c.comentarios > 0)
  const topThree = active.slice(0, 3)
  const heatmapCities = active.slice(0, HEATMAP_ROWS)
  const weekLabels = getHeatmapLabels(referenceMonth)
  const insights = buildCityInsights(cities, referenceMonth)
  const heatMax = Math.max(...heatmapCities.flatMap((c) => c.monthlyCounts.slice(0, 4)), 1)

  return (
    <div className={cn(exercitoSectionCardClass, exercitoDualPanelItemClass, 'border-[rgb(var(--color-primary)/0.15)]')}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className={exercitoSectionTitleClass}>🏙 Disputa de municípios</h2>
          <p className={exercitoSectionSubtitleClass}>
            Quem domina o território · mês: {referenceMonthLabel}
          </p>
        </div>
        <span className="rounded-[99px] border border-[rgb(var(--color-primary)/0.35)] bg-[#E6F1FB] px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--color-primary))]">
          top {Math.min(8, cities.length)}
        </span>
      </div>

      {topThree.length > 0 ? (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {topThree.map((city, idx) => {
            const Icon = TOP_CARD_ICONS[idx] ?? IconTrophy
            const label = TOP_CARD_LABELS[idx] ?? 'Top'
            return (
              <div
                key={city.municipio}
                className={cn(
                  'rounded-[10px] border px-2 py-2 text-center',
                  idx === 0
                    ? 'border-[#C8900A]/50 bg-gradient-to-b from-[#FAEEDA] to-[#FFF8ED]'
                    : 'border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-app'
                )}
              >
                <Icon
                  className={cn(
                    'mx-auto mb-1 h-4 w-4',
                    idx === 0 ? 'text-[#854F0B]' : idx === 1 ? 'text-[rgb(var(--color-primary))]' : 'text-[#3B6D11]'
                  )}
                  stroke={1.5}
                  aria-hidden
                />
                <p className="truncate text-[10px] font-semibold text-text-primary" title={city.municipio}>
                  {city.municipio}
                </p>
                <p className="text-[9px] text-text-muted">{label}</p>
                <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-[rgb(var(--color-primary))]">
                  {formatInt(city.comentarios)} com.
                </p>
                <p className="text-[9px] tabular-nums text-text-muted">{formatPct(city.ativacaoPct)} activ.</p>
              </div>
            )
          })}
        </div>
      ) : null}

      {heatmapCities.length > 0 ? (
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-muted">
            Calor de ativação
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[240px] border-collapse text-center">
              <thead>
                <tr>
                  <th className="px-1 py-1 text-left text-[9px] font-medium text-text-muted">Cidade</th>
                  {weekLabels.map((label) => (
                    <th key={label} className="px-1 py-1 text-[9px] font-medium text-text-muted">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapCities.map((city) => (
                  <tr key={city.municipio}>
                    <td
                      className="max-w-[72px] truncate px-1 py-1 text-left text-[10px] font-medium text-text-secondary"
                      title={city.municipio}
                    >
                      {city.municipio}
                    </td>
                    {city.monthlyCounts.slice(0, 4).map((value, wi) => {
                      const style = heatCellStyle(value, heatMax)
                      return (
                        <td key={`${city.municipio}-${wi}`} className="px-0.5 py-0.5">
                          <div
                            className="rounded-[4px] px-1 py-1 text-[10px] font-semibold tabular-nums"
                            style={{ background: style.background, color: style.color }}
                          >
                            {value > 0 ? value : '·'}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {insights.length > 0 ? (
        <ul className="mb-2 space-y-1.5">
          {insights.map((item) => (
            <li key={item.text} className="flex items-start justify-between gap-2 text-[10.5px] text-text-secondary">
              <span>
                <span className="mr-1" aria-hidden>
                  {item.emoji}
                </span>
                {item.text}
              </span>
              <span className={cn('shrink-0 rounded-[99px] px-1.5 py-0 text-[9px] font-semibold', item.badgeClass)}>
                {item.badge}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto shrink-0 border-t border-[rgb(var(--color-border-tertiary)/0.85)] pt-2 text-[10px] text-text-muted">
        <div className="flex items-start gap-1.5">
          <IconInfoCircle className="mt-0.5 h-3 w-3 shrink-0 opacity-70" stroke={1.5} aria-hidden />
          <p>
            {formatInt(organicTail.comentarios)} comentários de {formatInt(organicTail.perfis)} perfis sem match com{' '}
            {audience === 'unificado'
              ? 'perfis da base eleitoral'
              : audience === 'mandatos'
                ? 'mandatários da planilha'
                : 'líderes cadastrados'}{' '}
            (cauda orgânica)
          </p>
        </div>
      </div>
    </div>
  )
}
