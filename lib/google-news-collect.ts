import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchGoogleNewsRss } from '@/lib/google-news-rss'
import { resolveGoogleNewsSearchQueryForActor } from '@/lib/google-news-search-term'
import type {
  GoogleNewsCollectResult,
  GoogleNewsRssItem,
} from '@/lib/google-news-types'
import type { PoliticalActor } from '@/lib/youtube-radar-types'

const PAUSE_BETWEEN_ACTORS_MS = 2_500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadActiveActors(supabase: SupabaseClient): Promise<PoliticalActor[]> {
  const { data, error } = await supabase
    .from('political_actors')
    .select('id, name, slug, actor_type, active, notes, instagram_username, created_at, updated_at')
    .eq('active', true)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as PoliticalActor[]
}

async function upsertArticles(
  supabase: SupabaseClient,
  politicoId: string,
  searchTerm: string,
  items: GoogleNewsRssItem[]
): Promise<{ inserted: number; updated: number }> {
  if (items.length === 0) return { inserted: 0, updated: 0 }

  const articleIds = items.map((i) => i.articleId)
  const { data: existing } = await supabase
    .from('google_news_mentions')
    .select('article_id')
    .eq('politico_id', politicoId)
    .in('article_id', articleIds)

  const existingSet = new Set((existing ?? []).map((r) => r.article_id as string))
  const collectedAt = new Date().toISOString()

  const rows = items.map((item) => ({
    politico_id: politicoId,
    search_term: searchTerm,
    article_id: item.articleId,
    title: item.title,
    source_name: item.sourceName,
    url: item.url,
    summary: item.summary,
    published_at: item.publishedAt,
    collected_at: collectedAt,
  }))

  const { error } = await supabase.from('google_news_mentions').upsert(rows, {
    onConflict: 'politico_id,article_id',
  })
  if (error) throw new Error(error.message)

  const { error: purgeError } = await supabase
    .from('google_news_mentions')
    .delete()
    .eq('politico_id', politicoId)
    .neq('search_term', searchTerm)
  if (purgeError) throw new Error(purgeError.message)

  let inserted = 0
  let updated = 0
  for (const item of items) {
    if (existingSet.has(item.articleId)) updated += 1
    else inserted += 1
  }
  return { inserted, updated }
}

export async function collectGoogleNewsForActor(
  supabase: SupabaseClient,
  actor: PoliticalActor
): Promise<GoogleNewsCollectResult> {
  const result: GoogleNewsCollectResult = {
    politicoId: actor.id,
    politicoName: actor.name,
    articlesFound: 0,
    articlesInserted: 0,
    articlesUpdated: 0,
    errors: [],
  }

  try {
    const searchQuery = resolveGoogleNewsSearchQueryForActor(actor)
    const items = await fetchGoogleNewsRss(searchQuery)
    result.articlesFound = items.length
    const { inserted, updated } = await upsertArticles(supabase, actor.id, searchQuery, items)
    result.articlesInserted = inserted
    result.articlesUpdated = updated
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    if (msg.includes('does not exist') || msg.includes('42P01')) {
      throw new Error(
        'Tabela google_news_mentions ausente. Execute database/create-google-news-radar-tables.sql no Supabase.'
      )
    }
    result.errors.push(msg)
  }

  return result
}

export async function collectGoogleNewsRadar(
  supabase: SupabaseClient,
  options?: { politicoSlug?: string }
): Promise<GoogleNewsCollectResult[]> {
  let actors = await loadActiveActors(supabase)
  if (options?.politicoSlug) {
    actors = actors.filter((a) => a.slug === options.politicoSlug)
  }

  const results: GoogleNewsCollectResult[] = []
  for (let i = 0; i < actors.length; i++) {
    results.push(await collectGoogleNewsForActor(supabase, actors[i]))
    if (i < actors.length - 1) await sleep(PAUSE_BETWEEN_ACTORS_MS)
  }
  return results
}
