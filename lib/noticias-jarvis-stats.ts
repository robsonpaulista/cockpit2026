import { isTodayNews } from '@/lib/noticias-page-utils'
import type { NewsItem } from '@/types'

export interface NoticiasJarvisStats {
  hoje: number
  riscoAlto: number
  destacadas: number
  riscoMedio: number
  riscoBaixo: number
  negativas: number
  positivas: number
  neutras: number
  totalVisivel: number
}

export function computeNoticiasJarvisStats(items: NewsItem[]): NoticiasJarvisStats {
  return {
    hoje: items.filter(isTodayNews).length,
    riscoAlto: items.filter((n) => n.risk_level === 'high').length,
    destacadas: items.filter((n) => n.dashboard_highlight === true).length,
    riscoMedio: items.filter((n) => n.risk_level === 'medium').length,
    riscoBaixo: items.filter((n) => n.risk_level === 'low').length,
    negativas: items.filter((n) => n.sentiment === 'negative').length,
    positivas: items.filter((n) => n.sentiment === 'positive').length,
    neutras: items.filter((n) => n.sentiment === 'neutral' || !n.sentiment).length,
    totalVisivel: items.length,
  }
}

export function buildNoticiasApiPath(args: {
  sentiment?: string
  risco?: string
  destaque?: boolean
  termo?: string
  limite?: number
}): string {
  const params = new URLSearchParams()
  const limit = args.limite ?? 10
  params.set('limit', String(limit))

  if (args.sentiment) params.set('sentiment', args.sentiment)
  if (args.risco) params.set('risk_level', args.risco)
  if (args.destaque) params.set('dashboard_highlight', 'true')
  if (args.termo?.trim()) params.set('q', args.termo.trim().slice(0, 120))

  return `/api/noticias?${params.toString()}`
}

export function mapApiRowsToNewsItems(data: unknown[]): NewsItem[] {
  return data
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map((row) => ({
      id: String(row.id ?? ''),
      title: String(row.title ?? 'Sem título'),
      source: String(row.source ?? 'Fonte'),
      url: typeof row.url === 'string' ? row.url : undefined,
      sentiment: row.sentiment as NewsItem['sentiment'],
      risk_level: row.risk_level as NewsItem['risk_level'],
      theme: typeof row.theme === 'string' ? row.theme : undefined,
      published_at: typeof row.published_at === 'string' ? row.published_at : undefined,
      collected_at: typeof row.collected_at === 'string' ? row.collected_at : undefined,
      dashboard_highlight: row.dashboard_highlight === true,
    }))
    .filter((row) => row.id.length > 0)
}
