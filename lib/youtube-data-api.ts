const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

export type YoutubeSearchHit = {
  videoId: string
  channelId: string | null
  channelTitle: string | null
  title: string
  description: string
  publishedAt: string | null
  thumbnailUrl: string | null
}

export type YoutubeVideoMetrics = {
  videoId: string
  title: string
  description: string
  channelId: string | null
  channelTitle: string | null
  publishedAt: string | null
  thumbnailUrl: string | null
  views: number
  likes: number
  comments: number
}

function getApiKey(): string {
  const key = process.env.YOUTUBE_DATA_API_KEY?.trim()
  if (!key) {
    throw new Error(
      'YOUTUBE_DATA_API_KEY não configurada. Habilite YouTube Data API v3 no Google Cloud e adicione a chave em .env.local'
    )
  }
  return key
}

function publishedAfterIso(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - Math.max(1, days))
  return d.toISOString()
}

type YoutubeApiError = { error?: { message?: string; errors?: { reason?: string }[] } }

async function youtubeGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${YOUTUBE_API_BASE}/${path}`)
  url.searchParams.set('key', getApiKey())
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const raw = await res.text()
  let data: T & YoutubeApiError
  try {
    data = JSON.parse(raw) as T & YoutubeApiError
  } catch {
    throw new Error(`Resposta inválida da API YouTube (${res.status})`)
  }

  if (!res.ok) {
    const msg = data.error?.message ?? `YouTube API erro ${res.status}`
    throw new Error(msg)
  }

  return data
}

/** Busca vídeos públicos por termo (search.list — 100 unidades de quota por chamada). */
export async function searchYoutubeVideosByTerm(
  term: string,
  lookbackDays: number,
  maxResults = 25
): Promise<YoutubeSearchHit[]> {
  const capped = Math.min(Math.max(maxResults, 1), 50)
  const data = await youtubeGet<{
    items?: {
      id?: { videoId?: string }
      snippet?: {
        channelId?: string
        channelTitle?: string
        title?: string
        description?: string
        publishedAt?: string
        thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
      }
    }[]
  }>('search', {
    part: 'snippet',
    q: term,
    type: 'video',
    order: 'date',
    publishedAfter: publishedAfterIso(lookbackDays),
    maxResults: String(capped),
    relevanceLanguage: 'pt',
    regionCode: 'BR',
  })

  const out: YoutubeSearchHit[] = []
  for (const item of data.items ?? []) {
    const videoId = item.id?.videoId?.trim()
    if (!videoId) continue
    const sn = item.snippet
    out.push({
      videoId,
      channelId: sn?.channelId ?? null,
      channelTitle: sn?.channelTitle ?? null,
      title: sn?.title?.trim() || 'Sem título',
      description: sn?.description?.trim() || '',
      publishedAt: sn?.publishedAt ?? null,
      thumbnailUrl: sn?.thumbnails?.medium?.url ?? sn?.thumbnails?.default?.url ?? null,
    })
  }
  return out
}

/** Métricas em lote (videos.list — 1 unidade de quota até 50 IDs). */
export async function fetchYoutubeVideoMetrics(videoIds: string[]): Promise<YoutubeVideoMetrics[]> {
  const unique = [...new Set(videoIds.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const out: YoutubeVideoMetrics[] = []
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50)
    const data = await youtubeGet<{
      items?: {
        id?: string
        snippet?: {
          channelId?: string
          channelTitle?: string
          title?: string
          description?: string
          publishedAt?: string
          thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
        }
        statistics?: {
          viewCount?: string
          likeCount?: string
          commentCount?: string
        }
      }[]
    }>('videos', {
      part: 'snippet,statistics',
      id: chunk.join(','),
    })

    for (const item of data.items ?? []) {
      const videoId = item.id?.trim()
      if (!videoId) continue
      const sn = item.snippet
      const st = item.statistics
      out.push({
        videoId,
        title: sn?.title?.trim() || 'Sem título',
        description: sn?.description?.trim() || '',
        channelId: sn?.channelId ?? null,
        channelTitle: sn?.channelTitle ?? null,
        publishedAt: sn?.publishedAt ?? null,
        thumbnailUrl: sn?.thumbnails?.medium?.url ?? sn?.thumbnails?.default?.url ?? null,
        views: Number(st?.viewCount ?? 0) || 0,
        likes: Number(st?.likeCount ?? 0) || 0,
        comments: Number(st?.commentCount ?? 0) || 0,
      })
    }
  }
  return out
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function isYoutubeApiConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_DATA_API_KEY?.trim())
}
