import { formatPct } from '@/lib/mapa-exercito-digital-aggregator'
import { getHeatmapMonthLabels, getMonthWindow } from '@/lib/mapa-exercito-digital-month'
import type { ExercitoDigitalCityRow, ExercitoDigitalLeaderRow } from '@/lib/mapa-exercito-digital-types'

export { getReferenceMonthOptions, getCurrentReferenceMonth, formatMonthLabelLong } from '@/lib/mapa-exercito-digital-month'

export function initialsFromName(nome: string): string {
  const parts = nome
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

/** Pontuação da disputa = comentários no mês de referência. */
export function leaderDisputeScore(leader: ExercitoDigitalLeaderRow): number {
  return leader.mesAtual
}

export function leaderScoreMax(leaders: ExercitoDigitalLeaderRow[]): number {
  return Math.max(...leaders.map(leaderDisputeScore), 1)
}

export function heatCellStyle(value: number, max: number): { background: string; color: string } {
  if (value <= 0) {
    return { background: '#F1EFE8', color: '#888780' }
  }
  const ratio = value / Math.max(max, 1)
  if (ratio >= 0.75) return { background: '#185FA5', color: '#FFFFFF' }
  if (ratio >= 0.5) return { background: '#378ADD', color: '#FFFFFF' }
  if (ratio >= 0.25) return { background: '#85B7EB', color: '#134E82' }
  return { background: '#B5D4F4', color: '#134E82' }
}

export type CityInsight = {
  emoji: string
  text: string
  badge: string
  badgeClass: string
}

export function buildCityInsights(cities: ExercitoDigitalCityRow[], referenceMonth: string): CityInsight[] {
  const insights: CityInsight[] = []
  const active = cities.filter((c) => c.comentarios > 0)
  if (active.length === 0) return insights

  const top = active[0]!
  const currentMonth = top.monthlyCounts[4] ?? 0
  const prevMonth = top.monthlyCounts[3] ?? 0
  const delta = prevMonth > 0 ? ((currentMonth - prevMonth) / prevMonth) * 100 : currentMonth > 0 ? 100 : 0
  const refLabel = getMonthWindow(referenceMonth, 1)[0]?.label ?? 'mês'

  if (delta >= 50) {
    insights.push({
      emoji: '🔥',
      text: `${top.municipio} acelerou ${Math.round(delta)}% vs mês anterior`,
      badge: `+${Math.round(delta)}%`,
      badgeClass: 'border border-[#C0DD97] bg-[#EAF3DE] text-[#3B6D11]',
    })
  }

  const bestEfficiency = [...active].sort((a, b) => b.ativacaoPct - a.ativacaoPct)[0]
  if (bestEfficiency && bestEfficiency.ativacaoPct >= 50) {
    insights.push({
      emoji: '⭐',
      text: `${bestEfficiency.municipio}: ${formatPct(bestEfficiency.ativacaoPct)} de eficiência em ${refLabel}`,
      badge: 'destaque',
      badgeClass: 'border border-[#B5D4F4] bg-[#E6F1FB] text-[rgb(var(--color-primary))]',
    })
  }

  const inactive = cities.find((c) => c.comentarios === 0 || (c.monthlyCounts[4] ?? 0) === 0)
  if (inactive && cities.length > 1) {
    insights.push({
      emoji: '😴',
      text: `${inactive.municipio} sem ativação em ${refLabel}`,
      badge: 'alerta',
      badgeClass: 'border border-[#F09595] bg-[#FCEBEB] text-[#A32D2D]',
    })
  }

  return insights.slice(0, 3)
}

export function buildLeaderCityCorrelation(
  topLeader: ExercitoDigitalLeaderRow | undefined,
  topCity: ExercitoDigitalCityRow | undefined
): string | null {
  if (!topLeader || !topCity) return null
  return `${topCity.municipio} lidera municípios e ${topLeader.nome.split(' ')[0] ?? topLeader.nome} está em #${topLeader.rank} no placar de líderes — concentração estratégica em evidência.`
}

export function getHeatmapLabels(referenceMonth: string): string[] {
  return getHeatmapMonthLabels(referenceMonth)
}

export const PODIUM_STYLES = [
  {
    ring: 'ring-2 ring-[#C8900A]/70',
    bg: 'bg-gradient-to-b from-[#FAEEDA] to-[#FFF8ED]',
    medal: '🥇',
    label: '#1',
  },
  {
    ring: 'ring-2 ring-[#B4B2A9]/60',
    bg: 'bg-gradient-to-b from-[#F1EFE8] to-[#FAFAF8]',
    medal: '🥈',
    label: '#2',
  },
  {
    ring: 'ring-2 ring-[#BA7517]/40',
    bg: 'bg-gradient-to-b from-[#FAEEDA]/60 to-[#FFF8ED]',
    medal: '🥉',
    label: '#3',
  },
] as const

export const PERIOD_BAR_LABELS = ['M-4', 'M-3', 'M-2', 'M-1', 'Mês ref.'] as const
