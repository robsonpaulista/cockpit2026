import { stripHtml } from '@/lib/strip-html'
import { parseDateOnlyLocal } from '@/lib/utils'
import type { NewsItem } from '@/types'

export type FiltroDestaque = 'all' | 'painel' | 'monitor'

export function sanitizeNewsItem(item: NewsItem): NewsItem {
  return {
    ...item,
    title: stripHtml(item.title),
    source: stripHtml(item.source),
    content: item.content ? stripHtml(item.content) : item.content,
    theme: item.theme ? stripHtml(item.theme) : item.theme,
  }
}

export function newsItemDate(item: NewsItem): Date | null {
  return parseDateOnlyLocal(item.published_at || item.collected_at || new Date().toISOString())
}

export function dateKeyForItem(item: NewsItem): string {
  const d = newsItemDate(item)
  if (!d) return 'unknown'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatNewsMetaDate(date: Date | string): string {
  const d = parseDateOnlyLocal(date)
  if (!d) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
    .format(d)
    .replace(/\./g, '')
}

export function dateGroupLabel(dateKey: string): string {
  if (dateKey === 'unknown') return 'Sem data'
  const d = parseDateOnlyLocal(dateKey)
  if (!d) return dateKey
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  const formatted = formatNewsMetaDate(d)
  return isToday ? `Hoje · ${formatted}` : formatted
}

export function isTodayNews(item: NewsItem): boolean {
  const d = newsItemDate(item)
  if (!d) return false
  return d.toDateString() === new Date().toDateString()
}

export function filterNewsClientSide(
  items: NewsItem[],
  opts: {
    filterSentiment: string
    filterRisk: string
    filterDestaque: FiltroDestaque
    searchDebounced: string
    ocultarLixo: boolean
    lixoIds: Set<string>
    selectedFeedKeys: string[]
    allFeedKeysCount: number
  }
): NewsItem[] {
  let result = items

  if (opts.filterSentiment !== 'all') {
    result = result.filter((n) => n.sentiment === opts.filterSentiment)
  }
  if (opts.filterRisk !== 'all') {
    result = result.filter((n) => n.risk_level === opts.filterRisk)
  }
  if (opts.filterDestaque === 'painel') {
    result = result.filter((n) => n.dashboard_highlight === true)
  }
  if (opts.filterDestaque === 'monitor') {
    result = result.filter((n) => n.dashboard_highlight === true)
  }
  if (opts.searchDebounced) {
    const q = opts.searchDebounced.toLowerCase()
    result = result.filter((n) => {
      const hay = [n.title, n.source, n.theme ?? ''].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }
  if (opts.selectedFeedKeys.length > 0 && opts.selectedFeedKeys.length < opts.allFeedKeysCount) {
    result = result.filter((n) => {
      const feedKey = n.adversary_id ? `adversary_feed-${n.adversary_id}` : null
      if (feedKey) return opts.selectedFeedKeys.includes(feedKey)
      return true
    })
  }
  if (opts.ocultarLixo) {
    result = result.filter((n) => !opts.lixoIds.has(n.id))
  }

  return result
}

export function sortNewsForDisplay(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const aHigh = a.risk_level === 'high' ? 1 : 0
    const bHigh = b.risk_level === 'high' ? 1 : 0
    if (aHigh !== bHigh) return bHigh - aHigh

    const da = newsItemDate(a)?.getTime() ?? 0
    const db = newsItemDate(b)?.getTime() ?? 0
    return db - da
  })
}

export interface NewsListSection {
  type: 'risk-divider' | 'date-divider' | 'card'
  item?: NewsItem
  dateKey?: string
}

export function buildNewsListSections(items: NewsItem[]): NewsListSection[] {
  const highRisk = items.filter((n) => n.risk_level === 'high')
  const rest = items.filter((n) => n.risk_level !== 'high')

  const sections: NewsListSection[] = []

  if (highRisk.length > 0) {
    sections.push({ type: 'risk-divider' })
    highRisk.forEach((item) => sections.push({ type: 'card', item }))
  }

  const byDate = new Map<string, NewsItem[]>()
  rest.forEach((item) => {
    const key = dateKeyForItem(item)
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(item)
  })

  const sortedDateKeys = [...byDate.keys()].sort((a, b) => {
    const da = parseDateOnlyLocal(a)?.getTime() ?? 0
    const db = parseDateOnlyLocal(b)?.getTime() ?? 0
    return db - da
  })

  sortedDateKeys.forEach((dateKey) => {
    sections.push({ type: 'date-divider', dateKey })
    byDate.get(dateKey)!.forEach((item) => sections.push({ type: 'card', item }))
  })

  return sections
}

export const SENTIMENT_TAG_CLASS: Record<string, string> = {
  neutral: 'border-[#D3D1C7] bg-[#F1EFE8] text-[#5F5E5A]',
  positive: 'border-[#C0DD97] bg-[#EAF3DE] text-[#3B6D11]',
  negative: 'border-[#F7C1C1] bg-[#FCEBEB] text-[#A32D2D]',
}

export const RISK_TAG_CLASS: Record<string, string> = {
  low: 'border-[#D3D1C7] bg-[#F1EFE8] text-[#5F5E5A]',
  medium: 'border-[#FAC775] bg-[#FAEEDA] text-[#854F0B]',
  high: 'border-[#F09595] bg-[#FCEBEB] text-[#A32D2D]',
}

export const THEME_TAG_CLASS = 'border-[#B5D4F4] bg-[#E6F1FB] text-[#185FA5]'

export function sentimentLabel(s: NewsItem['sentiment']): string {
  if (s === 'positive') return 'Positivo'
  if (s === 'negative') return 'Negativo'
  return 'Neutro'
}

export function riskLabel(r: NewsItem['risk_level']): string {
  if (r === 'high') return 'Alto'
  if (r === 'medium') return 'Médio'
  return 'Baixo'
}
