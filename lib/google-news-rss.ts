import Parser from 'rss-parser'
import type { GoogleNewsRssItem } from '@/lib/google-news-types'

const RSS_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/rss+xml, application/xml, text/xml',
}

export type GoogleNewsRssOptions = {
  hl?: string
  gl?: string
  ceid?: string
}

/** Monta URL do feed RSS do Google Notícias para um termo de busca. */
export function buildGoogleNewsRssUrl(query: string, options: GoogleNewsRssOptions = {}): string {
  const params = new URLSearchParams({
    q: query,
    hl: options.hl ?? 'pt-BR',
    gl: options.gl ?? 'BR',
    ceid: options.ceid ?? 'BR:pt-419',
  })
  return `https://news.google.com/rss/search?${params.toString()}`
}

function extractSourceFromTitle(title: string): string | null {
  const idx = title.lastIndexOf(' - ')
  if (idx <= 0) return null
  const source = title.slice(idx + 3).trim()
  return source || null
}

function cleanTitle(title: string): string {
  const idx = title.lastIndexOf(' - ')
  if (idx <= 0) return title.trim()
  return title.slice(0, idx).trim()
}

function articleIdFromItem(link: string | undefined, guid: string | undefined, title: string): string {
  const raw = (guid ?? link ?? title).trim()
  try {
    const u = new URL(raw)
    return `${u.hostname}${u.pathname}`.slice(0, 500)
  } catch {
    return raw.slice(0, 500)
  }
}

/** Busca e parseia o RSS do Google Notícias para um termo. */
export async function fetchGoogleNewsRss(
  searchTerm: string,
  options: GoogleNewsRssOptions = {}
): Promise<GoogleNewsRssItem[]> {
  const rssUrl = buildGoogleNewsRssUrl(searchTerm, options)
  const parser = new Parser({
    customFields: {
      item: ['media:content', 'dc:creator', 'dc:date', 'source'],
    },
    headers: RSS_HEADERS,
  })

  const feed = await parser.parseURL(rssUrl)
  if (!feed.items?.length) return []

  return feed.items
    .filter((item) => item.title || item.link)
    .map((item) => {
      const rawTitle = item.title ?? 'Sem título'
      const sourceFromTitle = extractSourceFromTitle(rawTitle)
      const sourceField = typeof item.source === 'string' ? item.source : undefined
      const link = item.link?.trim() ?? ''

      return {
        articleId: articleIdFromItem(link, item.guid, rawTitle),
        title: cleanTitle(rawTitle),
        sourceName: sourceFromTitle ?? sourceField ?? null,
        url: link,
        summary: item.contentSnippet ?? item.content ?? null,
        publishedAt: item.isoDate ?? item.pubDate ?? null,
      }
    })
}
