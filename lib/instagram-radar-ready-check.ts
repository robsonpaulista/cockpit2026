import type { SupabaseClient } from '@supabase/supabase-js'
import { getInstagramEnvCredentials } from '@/lib/instagram-graph-server'
import { ensureEnvLocalLoaded } from '@/lib/load-env-local'
import { OWN_CANDIDATE_SLUG } from '@/lib/instagram-radar-own-sync'

export type OwnInstagramRadarReady = {
  ready: boolean
  source: 'env' | 'metrics_history' | 'radar_posts' | 'none'
  postsInHistory: number
  username: string | null
  lastSnapshotDate: string | null
}

/** Apify — lê process.env com fallback para .env.local se o dev server não recarregou. */
export function isApifyConfigured(): boolean {
  ensureEnvLocalLoaded()
  return Boolean(process.env.APIFY_TOKEN?.trim())
}

export async function getOwnInstagramRadarReady(
  supabase: SupabaseClient
): Promise<OwnInstagramRadarReady> {
  ensureEnvLocalLoaded()

  if (getInstagramEnvCredentials()) {
    return {
      ready: true,
      source: 'env',
      postsInHistory: 0,
      username: null,
      lastSnapshotDate: null,
    }
  }

  const [ownActorRes, metricsRes, postCountRes] = await Promise.all([
    supabase
      .from('political_actors')
      .select('id, instagram_username')
      .eq('slug', OWN_CANDIDATE_SLUG)
      .maybeSingle(),
    supabase
      .from('instagram_metrics_history')
      .select('instagram_username, snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('instagram_post_metrics_history')
      .select('post_id', { count: 'exact', head: true }),
  ])

  const ownActor = ownActorRes.data

  if (ownActor?.id) {
    const { count } = await supabase
      .from('instagram_radar_posts')
      .select('id', { count: 'exact', head: true })
      .eq('politico_id', ownActor.id)

    if ((count ?? 0) > 0) {
      return {
        ready: true,
        source: 'radar_posts',
        postsInHistory: count ?? 0,
        username: ownActor.instagram_username,
        lastSnapshotDate: null,
      }
    }
  }

  const metricsRow = metricsRes.data
  const metricsErr = metricsRes.error
  const postCountOnly = postCountRes.count ?? 0

  if (!metricsErr && metricsRow) {
    return {
      ready: true,
      source: 'metrics_history',
      postsInHistory: postCountOnly,
      username: metricsRow.instagram_username || null,
      lastSnapshotDate: metricsRow.snapshot_date ?? null,
    }
  }

  if (postCountOnly > 0) {
    return {
      ready: true,
      source: 'metrics_history',
      postsInHistory: postCountOnly,
      username: ownActor?.instagram_username ?? null,
      lastSnapshotDate: null,
    }
  }

  return {
    ready: false,
    source: 'none',
    postsInHistory: 0,
    username: null,
    lastSnapshotDate: null,
  }
}

export function isInstagramEnvConfigured(): boolean {
  ensureEnvLocalLoaded()
  return Boolean(getInstagramEnvCredentials())
}
