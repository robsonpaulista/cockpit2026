import type { SupabaseClient } from '@supabase/supabase-js'
import { inferGoogleNewsPlatform, type GoogleNewsCollectChannel } from '@/lib/google-news-platform'
import { fetchGoogleNewsRss } from '@/lib/google-news-rss'
import {
  resolveGoogleNewsSearchQueriesForActor,
  resolveGoogleWebSearchQueriesForActor,
} from '@/lib/google-news-search-term'
import type {
  GoogleNewsCollectItem,
  GoogleNewsCollectResult,
  GoogleNewsRssItem,
} from '@/lib/google-news-types'
import { fetchGoogleWebSearch, isGoogleWebSearchConfigured } from '@/lib/google-web-search'
import { isGoogleVideosRunnerAvailable } from '@/lib/serverless-runtime'
import type { PoliticalActor } from '@/lib/youtube-radar-types'

const PAUSE_BETWEEN_ACTORS_MS = 2_500
const PAUSE_BETWEEN_QUERIES_MS = 1_200

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function rssItemToCollectItem(item: GoogleNewsRssItem): GoogleNewsCollectItem {
  return {
    articleId: item.articleId,
    title: item.title,
    sourceName: item.sourceName,
    url: item.url,
    summary: item.summary,
    publishedAt: item.publishedAt,
    platform: inferGoogleNewsPlatform(item.url),
  }
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
  collectChannel: GoogleNewsCollectChannel,
  items: GoogleNewsCollectItem[]
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
    collect_channel: collectChannel,
    platform: item.platform,
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

  let inserted = 0
  let updated = 0
  for (const item of items) {
    if (existingSet.has(item.articleId)) updated += 1
    else inserted += 1
  }
  return { inserted, updated }
}

async function purgeMentionsOutsideSearchTerms(
  supabase: SupabaseClient,
  politicoId: string,
  searchTerms: readonly string[],
  collectChannel: GoogleNewsCollectChannel
): Promise<void> {
  if (searchTerms.length === 0) return

  if (searchTerms.length === 1) {
    const { error } = await supabase
      .from('google_news_mentions')
      .delete()
      .eq('politico_id', politicoId)
      .eq('collect_channel', collectChannel)
      .neq('search_term', searchTerms[0])
    if (error) throw new Error(error.message)
    return
  }

  const inList = `(${searchTerms.map((t) => `"${t.replace(/"/g, '""')}"`).join(',')})`
  const { error } = await supabase
    .from('google_news_mentions')
    .delete()
    .eq('politico_id', politicoId)
    .eq('collect_channel', collectChannel)
    .not('search_term', 'in', inList)
  if (error) throw new Error(error.message)
}

async function collectChannelForActor(
  supabase: SupabaseClient,
  actor: PoliticalActor,
  collectChannel: GoogleNewsCollectChannel,
  searchQueries: readonly string[],
  fetchItems: (query: string) => Promise<GoogleNewsCollectItem[]>
): Promise<{ articlesFound: number; articlesInserted: number; articlesUpdated: number; errors: string[] }> {
  const stats = { articlesFound: 0, articlesInserted: 0, articlesUpdated: 0, errors: [] as string[] }
  const seenArticleIds = new Set<string>()

  for (let qi = 0; qi < searchQueries.length; qi++) {
    const searchQuery = searchQueries[qi]
    try {
      const items = await fetchItems(searchQuery)
      stats.articlesFound += items.length

      const uniqueItems = items.filter((item) => {
        if (seenArticleIds.has(item.articleId)) return false
        seenArticleIds.add(item.articleId)
        return true
      })

      const { inserted, updated } = await upsertArticles(
        supabase,
        actor.id,
        searchQuery,
        collectChannel,
        uniqueItems
      )
      stats.articlesInserted += inserted
      stats.articlesUpdated += updated
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido'
      stats.errors.push(`${searchQuery}: ${msg}`)
    }

    if (qi < searchQueries.length - 1) await sleep(PAUSE_BETWEEN_QUERIES_MS)
  }

  await purgeMentionsOutsideSearchTerms(supabase, actor.id, searchQueries, collectChannel)
  return stats
}

function emptyCollectResult(actor: PoliticalActor): GoogleNewsCollectResult {
  return {
    politicoId: actor.id,
    politicoName: actor.name,
    articlesFound: 0,
    articlesInserted: 0,
    articlesUpdated: 0,
    webArticlesFound: 0,
    videoArticlesFound: 0,
    videoCollectSkipped: false,
    webSearchEnabled: isGoogleWebSearchConfigured(),
    videoSearchEnabled: isGoogleVideosRunnerAvailable(),
    errors: [],
  }
}

export async function collectGoogleNewsForActor(
  supabase: SupabaseClient,
  actor: PoliticalActor
): Promise<GoogleNewsCollectResult> {
  const result = emptyCollectResult(actor)

  try {
    const rssQueries = resolveGoogleNewsSearchQueriesForActor(actor)
    const rssStats = await collectChannelForActor(
      supabase,
      actor,
      'google_news_rss',
      rssQueries,
      async (query) => {
        const items = await fetchGoogleNewsRss(query)
        return items.map(rssItemToCollectItem)
      }
    )

    result.articlesFound = rssStats.articlesFound
    result.articlesInserted = rssStats.articlesInserted
    result.articlesUpdated = rssStats.articlesUpdated
    result.errors.push(...rssStats.errors)

    if (result.webSearchEnabled) {
      const webQueries = resolveGoogleWebSearchQueriesForActor(actor)
      const webStats = await collectChannelForActor(
        supabase,
        actor,
        'google_web',
        webQueries,
        (query) => fetchGoogleWebSearch(query)
      )

      result.webArticlesFound = webStats.articlesFound
      result.articlesInserted += webStats.articlesInserted
      result.articlesUpdated += webStats.articlesUpdated
      result.errors.push(...webStats.errors)
    }
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

export { isGoogleWebSearchConfigured } from '@/lib/google-web-search'
export { getGoogleVideosCollectStatus } from '@/lib/google-videos-collect'
