import { inferGoogleNewsPlatform } from '@/lib/google-news-platform'
import type { GoogleNewsCollectItem } from '@/lib/google-news-types'

const CSE_ENDPOINT = 'https://www.googleapis.com/customsearch/v1'

export type GoogleWebSearchOptions = {
  /** Resultados por página (máx. 10). */
  num?: number
  /** Restrição de data: d[days], w[weeks], m[months] — ex.: m1 = último mês. */
  dateRestrict?: string
  /** País (gl). */
  gl?: string
  /** Idioma (lr). */
  lr?: string
}

type CseItem = {
  title?: string
  link?: string
  snippet?: string
  displayLink?: string
  pagemap?: {
    metatags?: Array<Record<string, string>>
  }
}

type CseResponse = {
  items?: CseItem[]
  error?: { message?: string; code?: number }
}

function getGoogleCseApiKey(): string | undefined {
  return process.env.GOOGLE_CSE_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || undefined
}

function getGoogleCseId(): string | undefined {
  return (
    process.env.GOOGLE_CSE_ID?.trim() ||
    process.env.GOOGLE_PROGRAMMABLE_SEARCH_CX?.trim() ||
    undefined
  )
}

export function isGoogleWebSearchConfigured(): boolean {
  return Boolean(getGoogleCseApiKey() && getGoogleCseId())
}

function articleIdFromUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.hostname}${u.pathname}`.slice(0, 500)
  } catch {
    return url.slice(0, 500)
  }
}

function extractPublishedAt(item: CseItem): string | null {
  const meta = item.pagemap?.metatags?.[0]
  if (!meta) return null

  const raw =
    meta['article:published_time'] ??
    meta['og:updated_time'] ??
    meta['datePublished'] ??
    meta['pubdate']

  if (!raw) return null
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function mapCseItem(item: CseItem): GoogleNewsCollectItem | null {
  const url = item.link?.trim()
  const title = item.title?.trim()
  if (!url || !title) return null

  const platform = inferGoogleNewsPlatform(url)
  const sourceName =
    item.displayLink?.trim() ||
    (platform === 'instagram'
      ? 'Instagram'
      : platform === 'facebook'
        ? 'Facebook'
        : platform === 'youtube'
          ? 'YouTube'
          : null)

  return {
    articleId: articleIdFromUrl(url),
    title,
    sourceName,
    url,
    summary: item.snippet?.trim() ?? null,
    publishedAt: extractPublishedAt(item),
    platform,
  }
}

/** Busca na web via Google Programmable Search (Custom Search JSON API). */
export async function fetchGoogleWebSearch(
  query: string,
  options: GoogleWebSearchOptions = {}
): Promise<GoogleNewsCollectItem[]> {
  const apiKey = getGoogleCseApiKey()
  const cx = getGoogleCseId()

  if (!apiKey || !cx) {
    throw new Error(
      'Busca web não configurada. Defina GOOGLE_CSE_API_KEY (ou GOOGLE_API_KEY) e GOOGLE_CSE_ID no ambiente.'
    )
  }

  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: query,
    num: String(Math.min(10, Math.max(1, options.num ?? 10))),
    gl: options.gl ?? 'br',
    lr: options.lr ?? 'lang_pt',
    dateRestrict: options.dateRestrict ?? 'm1',
  })

  const res = await fetch(`${CSE_ENDPOINT}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  const data = (await res.json()) as CseResponse

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Google Custom Search HTTP ${res.status}`)
  }

  return (data.items ?? [])
    .map(mapCseItem)
    .filter((item): item is GoogleNewsCollectItem => Boolean(item))
}
