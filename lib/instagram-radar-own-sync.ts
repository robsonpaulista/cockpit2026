import type { SupabaseClient } from '@supabase/supabase-js'
import { getInstagramRadarPostsLimit } from '@/lib/instagram-radar-config'
import { GRAPH_BASE, resolveInstagramBusinessAccount } from '@/lib/instagram-graph'
import { getInstagramEnvCredentials } from '@/lib/instagram-graph-server'
import { getLatestInstagramPostMetrics } from '@/lib/instagram-snapshot-server'
import { normalizeInstagramUsername } from '@/lib/instagram-radar-username'

/** Candidato padrão do cockpit — nunca usa Apify */
export const OWN_CANDIDATE_SLUG = 'jadyel-alencar'

export type OwnCandidateSyncResult = {
  slug: string
  username: string
  source: 'graph_api' | 'metrics_history'
  postsFound: number
  postsInserted: number
  postsUpdated: number
  error?: string
}

export type OwnCandidateSyncOptions = {
  politicoSlug?: string
  postsLimit?: number
  windowLabel?: string
  /** Mesmo fluxo da página Redes & Instagram (localStorage → POST /api/instagram) */
  instagramToken?: string
  instagramBusinessAccountId?: string
}
type RadarPostRow = {
  politico_id: string
  instagram_username: string
  post_id: string
  posted_at: string | null
  post_type: string | null
  caption: string | null
  likes_count: number
  comments_count: number
  post_url: string
  thumbnail_url: string | null
  collected_at: string
}

type GraphMediaItem = {
  id: string
  caption?: string
  timestamp?: string
  like_count?: number
  comments_count?: number
  media_type?: string
  permalink?: string
  thumbnail_url?: string
  media_url?: string
}

function parseWindowDays(window: string): number {
  const m = window.trim().match(/^(\d+)\s*days?$/i)
  if (m) return Number(m[1])
  return 30
}

function mapMediaType(mediaType?: string, permalink?: string): string | null {
  if (permalink?.includes('/reel/')) return 'reel'
  if (!mediaType) return null
  const t = mediaType.toLowerCase()
  if (t.includes('reel')) return 'reel'
  if (t === 'carousel_album') return 'carousel'
  if (t === 'video') return 'video'
  if (t === 'image') return 'image'
  return mediaType
}

function withinWindow(iso: string | null | undefined, cutoff: Date): boolean {
  if (!iso) return true
  return new Date(iso).getTime() >= cutoff.getTime()
}

export function isInstagramOwnAccountConfigured(): boolean {
  return Boolean(getInstagramEnvCredentials())
}

async function fetchMediaFromGraphWithCredentials(
  token: string,
  businessAccountId: string,
  limit: number
): Promise<{
  username: string
  posts: RadarPostRow[]
  error?: string
} | null> {
  if (!token.trim() || !businessAccountId.trim()) return null

  let igId: string
  let username: string
  try {
    const resolved = await resolveInstagramBusinessAccount(businessAccountId, token)
    igId = resolved.instagramBusinessId
    username = resolved.ownerUsername
  } catch (err) {
    return {
      username: '',
      posts: [],
      error: err instanceof Error ? err.message : 'Erro ao resolver conta Instagram',
    }
  }

  const res = await fetch(
    `${GRAPH_BASE}/${igId}/media?fields=id,caption,timestamp,like_count,comments_count,media_type,permalink,thumbnail_url,media_url&limit=${limit}&access_token=${encodeURIComponent(token)}`
  )
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    return {
      username,
      posts: [],
      error: json.error?.message ?? 'Erro ao buscar mídia do Instagram',
    }
  }

  const json = (await res.json()) as { data?: GraphMediaItem[] }
  const collectedAt = new Date().toISOString()

  const posts: RadarPostRow[] = (json.data ?? []).map((item) => ({
    politico_id: '',
    instagram_username: normalizeInstagramUsername(username) ?? username,
    post_id: item.id,
    posted_at: item.timestamp ?? null,
    post_type: mapMediaType(item.media_type, item.permalink),
    caption: item.caption ?? null,
    likes_count: item.like_count ?? 0,
    comments_count: item.comments_count ?? 0,
    post_url: item.permalink ?? `https://www.instagram.com/p/${item.id}/`,
    thumbnail_url: item.thumbnail_url ?? item.media_url ?? null,
    collected_at: collectedAt,
  }))

  return { username: normalizeInstagramUsername(username) ?? username, posts }
}

async function fetchMediaFromGraph(limit: number): Promise<{  username: string
  posts: RadarPostRow[]
  error?: string
} | null> {
  const creds = getInstagramEnvCredentials()
  if (!creds) return null

  let igId: string
  let username: string
  try {
    const resolved = await resolveInstagramBusinessAccount(creds.businessAccountId, creds.token)
    igId = resolved.instagramBusinessId
    username = resolved.ownerUsername
  } catch (err) {
    return {
      username: '',
      posts: [],
      error: err instanceof Error ? err.message : 'Erro ao resolver conta Instagram',
    }
  }

  const res = await fetch(
    `${GRAPH_BASE}/${igId}/media?fields=id,caption,timestamp,like_count,comments_count,media_type,permalink,thumbnail_url,media_url&limit=${limit}&access_token=${encodeURIComponent(creds.token)}`
  )
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    return {
      username,
      posts: [],
      error: json.error?.message ?? 'Erro ao buscar mídia do Instagram',
    }
  }

  const json = (await res.json()) as { data?: GraphMediaItem[] }
  const collectedAt = new Date().toISOString()

  const posts: RadarPostRow[] = (json.data ?? []).map((item) => ({
    politico_id: '',
    instagram_username: normalizeInstagramUsername(username) ?? username,
    post_id: item.id,
    posted_at: item.timestamp ?? null,
    post_type: mapMediaType(item.media_type, item.permalink),
    caption: item.caption ?? null,
    likes_count: item.like_count ?? 0,
    comments_count: item.comments_count ?? 0,
    post_url: item.permalink ?? `https://www.instagram.com/p/${item.id}/`,
    thumbnail_url: item.thumbnail_url ?? item.media_url ?? null,
    collected_at: collectedAt,
  }))

  return { username: normalizeInstagramUsername(username) ?? username, posts }
}

async function resolveOwnerUserId(supabase: SupabaseClient): Promise<string | null> {
  const fromEnv = process.env.INSTAGRAM_RADAR_OWNER_USER_ID?.trim()
  if (fromEnv) return fromEnv

  const { data } = await supabase
    .from('instagram_metrics_history')
    .select('user_id')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.user_id ?? null
}

async function fetchMediaFromHistory(
  supabase: SupabaseClient,
  actorId: string,
  username: string,
  limit: number,
  cutoff: Date
): Promise<{ posts: RadarPostRow[]; error?: string }> {
  const userId = await resolveOwnerUserId(supabase)
  if (!userId) {
    return {
      posts: [],
      error: 'Abra Redes & Instagram e atualize os dados para gravar o histórico no Supabase.',
    }
  }
  const records = await getLatestInstagramPostMetrics(supabase, userId)
  const collectedAt = new Date().toISOString()

  const posts = records
    .filter((r) => withinWindow(r.postedAt, cutoff))
    .slice(0, limit)
    .map((r) => ({
      politico_id: actorId,
      instagram_username: username,
      post_id: r.id,
      posted_at: r.postedAt || null,
      post_type: mapMediaType(r.type, r.url),
      caption: r.caption ?? null,
      likes_count: r.metrics.likes,
      comments_count: r.metrics.comments,
      post_url: r.url || `https://www.instagram.com/p/${r.id}/`,
      thumbnail_url: r.thumbnail ?? null,
      collected_at: collectedAt,
    }))

  return { posts }
}

async function upsertRadarPosts(
  supabase: SupabaseClient,
  actorId: string,
  rows: RadarPostRow[]
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0
  let updated = 0

  for (const row of rows) {
    const payload = { ...row, politico_id: actorId }

    const { data: existing } = await supabase
      .from('instagram_radar_posts')
      .select('id')
      .eq('politico_id', actorId)
      .eq('post_id', row.post_id)
      .maybeSingle()

    if (existing?.id) {
      const { error } = await supabase.from('instagram_radar_posts').update(payload).eq('id', existing.id)
      if (!error) updated += 1
    } else {
      const { error } = await supabase.from('instagram_radar_posts').insert(payload)
      if (!error) inserted += 1
    }
  }

  return { inserted, updated }
}

async function resolveUsernameFromHistory(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from('instagram_metrics_history')
    .select('instagram_username')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return normalizeInstagramUsername(data?.instagram_username) ?? data?.instagram_username ?? null
}

export async function syncOwnCandidateInstagramRadar(
  supabase: SupabaseClient,
  options?: OwnCandidateSyncOptions
): Promise<OwnCandidateSyncResult[]> {  const limit = options?.postsLimit ?? getInstagramRadarPostsLimit()
  const windowDays = parseWindowDays(options?.windowLabel ?? process.env.INSTAGRAM_RADAR_POSTS_WINDOW ?? '30 days')
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - windowDays)

  let query = supabase
    .from('political_actors')
    .select('id, slug, name, actor_type, instagram_username, active')
    .eq('active', true)
    .eq('actor_type', 'own_candidate')

  if (options?.politicoSlug) {
    query = query.eq('slug', options.politicoSlug)
  }

  const { data: actors, error } = await query
  if (error) throw new Error(error.message)

  const ownActors = actors ?? []
  if (ownActors.length === 0) return []

  const results: OwnCandidateSyncResult[] = []

  for (const actor of ownActors) {
    let source: OwnCandidateSyncResult['source'] = 'metrics_history'
    let username =
      normalizeInstagramUsername(actor.instagram_username) ??
      (await resolveUsernameFromHistory(supabase)) ??
      ''
    let rows: RadarPostRow[] = []
    let syncError: string | undefined

    const clientToken = options?.instagramToken?.trim()
    const clientBusinessId = options?.instagramBusinessAccountId?.trim()

    if (clientToken && clientBusinessId) {
      source = 'graph_api'
      const graph = await fetchMediaFromGraphWithCredentials(clientToken, clientBusinessId, limit)
      if (graph?.posts.length) {
        username = graph.username || username
        rows = graph.posts.filter((p) => withinWindow(p.posted_at, cutoff))
      } else if (graph?.error) {
        syncError = graph.error
      }
    }

    if (rows.length === 0) {
      const hist = await fetchMediaFromHistory(supabase, actor.id, username, limit, cutoff)
      rows = hist.posts
      source = 'metrics_history'
      if (hist.error && !rows.length) syncError = hist.error
      if (rows.length && !username) {
        username = (await resolveUsernameFromHistory(supabase)) ?? 'jadyelalencar'
      }
    }

    if (rows.length === 0 && !clientToken) {
      source = 'graph_api'
      const graph = await fetchMediaFromGraph(limit)
      if (graph?.posts.length) {
        username = graph.username || username
        rows = graph.posts.filter((p) => withinWindow(p.posted_at, cutoff))
      } else if (graph?.error) {
        syncError = graph.error
      }
    }
    if (username && username !== actor.instagram_username) {
      await supabase
        .from('political_actors')
        .update({ instagram_username: username })
        .eq('id', actor.id)
    }

    const { inserted, updated } = rows.length
      ? await upsertRadarPosts(supabase, actor.id, rows.map((r) => ({ ...r, instagram_username: username || r.instagram_username })))
      : { inserted: 0, updated: 0 }

    results.push({
      slug: actor.slug,
      username: username || actor.instagram_username || '—',
      source,
      postsFound: rows.length,
      postsInserted: inserted,
      postsUpdated: updated,
      error: rows.length === 0 ? syncError ?? 'Nenhum post encontrado na API nem no histórico.' : syncError,
    })
  }

  return results
}

export function shouldSyncOwnCandidate(options?: { politicoSlug?: string }): boolean {
  if (!options?.politicoSlug) return true
  return options.politicoSlug === OWN_CANDIDATE_SLUG
}

export function shouldRunApifyForSlug(politicoSlug: string | undefined, actorType: string): boolean {
  if (actorType === 'own_candidate') return false
  if (politicoSlug === OWN_CANDIDATE_SLUG) return false
  return true
}
