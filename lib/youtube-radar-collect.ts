import {
  fetchYoutubeVideoMetrics,
  searchYoutubeVideosByTerm,
  youtubeWatchUrl,
} from '@/lib/youtube-data-api'
import type { PoliticalActor, YoutubeSearchTerm } from '@/lib/youtube-radar-types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type CollectYoutubeRadarResult = {
  politicoId: string
  politicoName: string
  lookbackDays: number
  termsProcessed: number
  videosFound: number
  videosInserted: number
  videosUpdated: number
  quotaEstimate: number
  errors: string[]
}

type ActorWithTerms = PoliticalActor & { youtube_search_terms: YoutubeSearchTerm[] }

export async function loadActiveActorsWithTerms(
  supabase: SupabaseClient
): Promise<ActorWithTerms[]> {
  const { data, error } = await supabase
    .from('political_actors')
    .select(
      `
      id,
      name,
      slug,
      actor_type,
      active,
      notes,
      instagram_username,
      created_at,
      updated_at,
      youtube_search_terms (
        id,
        politico_id,
        term,
        active,
        priority,
        created_at,
        updated_at
      )
    `
    )
    .eq('active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const terms = (row.youtube_search_terms as YoutubeSearchTerm[] | null) ?? []
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      actor_type: row.actor_type as PoliticalActor['actor_type'],
      active: Boolean(row.active),
      notes: (row.notes as string | null) ?? null,
      instagram_username: (row.instagram_username as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      youtube_search_terms: terms.filter((t) => t.active).sort((a, b) => a.priority - b.priority),
    }
  })
}

export async function collectYoutubeRadarForActor(
  supabase: SupabaseClient,
  actor: ActorWithTerms,
  lookbackDays: number
): Promise<CollectYoutubeRadarResult> {
  const result: CollectYoutubeRadarResult = {
    politicoId: actor.id,
    politicoName: actor.name,
    lookbackDays,
    termsProcessed: 0,
    videosFound: 0,
    videosInserted: 0,
    videosUpdated: 0,
    quotaEstimate: 0,
    errors: [],
  }

  const terms = actor.youtube_search_terms
  if (terms.length === 0) {
    result.errors.push('Nenhum termo de busca ativo configurado.')
    return result
  }

  const videoById = new Map<
    string,
    { searchTerm: string; hit: Awaited<ReturnType<typeof searchYoutubeVideosByTerm>>[number] }
  >()

  for (const { term } of terms) {
    try {
      result.quotaEstimate += 100
      const hits = await searchYoutubeVideosByTerm(term, lookbackDays)
      result.termsProcessed += 1
      for (const hit of hits) {
        if (!videoById.has(hit.videoId)) {
          videoById.set(hit.videoId, { searchTerm: term, hit })
        }
      }
    } catch (e) {
      result.errors.push(`${term}: ${e instanceof Error ? e.message : 'erro na busca'}`)
    }
  }

  result.videosFound = videoById.size
  if (videoById.size === 0) return result

  result.quotaEstimate += Math.ceil(videoById.size / 50)

  let metrics: Awaited<ReturnType<typeof fetchYoutubeVideoMetrics>> = []
  try {
    metrics = await fetchYoutubeVideoMetrics([...videoById.keys()])
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : 'Erro ao buscar métricas dos vídeos')
    return result
  }

  const metricsById = new Map(metrics.map((m) => [m.videoId, m]))
  const now = new Date().toISOString()

  for (const [videoId, { searchTerm, hit }] of videoById) {
    const m = metricsById.get(videoId)
    const row = {
      politico_id: actor.id,
      search_term: searchTerm,
      video_id: videoId,
      channel_id: m?.channelId ?? hit.channelId,
      channel_title: m?.channelTitle ?? hit.channelTitle,
      video_title: m?.title ?? hit.title,
      description: m?.description ?? hit.description,
      published_at: m?.publishedAt ?? hit.publishedAt,
      views: m?.views ?? 0,
      likes: m?.likes ?? 0,
      comments: m?.comments ?? 0,
      url: youtubeWatchUrl(videoId),
      thumbnail_url: m?.thumbnailUrl ?? hit.thumbnailUrl,
      collected_at: now,
      updated_at: now,
    }

    const { data: existing } = await supabase
      .from('youtube_mentions')
      .select('id')
      .eq('politico_id', actor.id)
      .eq('video_id', videoId)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabase.from('youtube_mentions').update(row).eq('id', existing.id)
      if (error) result.errors.push(`${videoId}: ${error.message}`)
      else result.videosUpdated += 1
    } else {
      const { error } = await supabase.from('youtube_mentions').insert(row)
      if (error) result.errors.push(`${videoId}: ${error.message}`)
      else result.videosInserted += 1
    }
  }

  return result
}

export async function collectYoutubeRadar(
  supabase: SupabaseClient,
  options: { lookbackDays?: number; politicoSlug?: string } = {}
): Promise<CollectYoutubeRadarResult[]> {
  const lookbackDays = options.lookbackDays ?? 7
  const actors = await loadActiveActorsWithTerms(supabase)
  const filtered = options.politicoSlug
    ? actors.filter((a) => a.slug === options.politicoSlug)
    : actors

  if (filtered.length === 0) {
    throw new Error(
      options.politicoSlug
        ? `Ator político "${options.politicoSlug}" não encontrado ou inativo.`
        : 'Nenhum ator político ativo. Execute database/create-youtube-radar-tables.sql no Supabase.'
    )
  }

  const results: CollectYoutubeRadarResult[] = []
  for (const actor of filtered) {
    results.push(await collectYoutubeRadarForActor(supabase, actor, lookbackDays))
  }
  return results
}
