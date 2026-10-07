import { stripHtml } from '@/lib/strip-html'
import { parseDateOnlyLocal } from '@/lib/utils'
import type { NewsItem } from '@/types'

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
