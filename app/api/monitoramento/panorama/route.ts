import { NextResponse } from 'next/server'
import {
  buildMonitoramentoPanorama,
  buildTrendsCompareFromRows,
} from '@/lib/monitoramento-panorama'
import { getMonitoramentoCollectorsStatus } from '@/lib/monitoramento-collectors-status'
import { googleTrendsTimeframeQueryKeys, PANORAMA_GOOGLE_TRENDS_TIMEFRAME } from '@/lib/google-trends-timeframe'
import { normalizeGoogleTrendsInterestRows, googleTrendsInterestQueryCutoffDay, GOOGLE_TRENDS_INTEREST_QUERY_LIMIT } from '@/lib/google-trends-normalize-rows'
import {
  panoramaWindowCutoffIso,
} from '@/lib/monitoramento-panorama-window'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import type { GoogleTrendsInterestRow, GoogleTrendsRelatedRow } from '@/lib/google-trends-types'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseMissingTableError } from '@/lib/supabase/table-error'
import type { PoliticalActorWithTerms, YoutubeMentionWithActor } from '@/lib/youtube-radar-types'

export const dynamic = 'force-dynamic'

const GEO = 'BR-PI'
const TIMEFRAME = PANORAMA_GOOGLE_TRENDS_TIMEFRAME

export async function GET() {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()
    const { data: actors, error: actorsError } = await supabase
      .from('political_actors')
      .select(
        `
        id,
        name,
        slug,
        actor_type,
        active,
        instagram_username,
        notes,
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
      .order('name', { ascending: true })

    if (actorsError) {
      if (isSupabaseMissingTableError(actorsError)) {
        return NextResponse.json({
          panorama: buildMonitoramentoPanorama({
            actors: [],
            trendsRows: [],
            trendsInterestRows: [],
            youtubeMentions: [],
            googleNewsMentions: [],
            instagramPosts: [],
            metaAdsMentions30d: [],
            lastUpdated: null,
            setupRequired: true,
          }),
          collectorsStatus: getMonitoramentoCollectorsStatus(),
        })
      }
      throw new Error(actorsError.message)
    }

    const typedActors = (actors ?? []) as PoliticalActorWithTerms[]
    const timeframeKeys = googleTrendsTimeframeQueryKeys(TIMEFRAME)
    const trendsInterestCutoffDay = googleTrendsInterestQueryCutoffDay()

    const cutoffIso = panoramaWindowCutoffIso()

    const [trendsRes, trendsRelatedRes, youtubeRes, newsRes, instagramRes, metaRes, collectLogRes, instagramLogRes] =
      await Promise.all([
      supabase
        .from('google_trends_interest')
        .select('*')
        .eq('geo', GEO)
        .in('timeframe', timeframeKeys)
        .gte('interest_date', trendsInterestCutoffDay)
        .order('interest_date', { ascending: true })
        .limit(GOOGLE_TRENDS_INTEREST_QUERY_LIMIT),
      supabase
        .from('google_trends_related')
        .select('*')
        .eq('geo', GEO)
        .in('timeframe', timeframeKeys)
        .order('rank', { ascending: true }),
      supabase
        .from('youtube_mentions')
        .select(`*, political_actors!inner ( id, name, slug, actor_type )`)
        .gte('published_at', cutoffIso)
        .order('published_at', { ascending: false })
        .limit(3000),
      supabase
        .from('google_news_mentions')
        .select(`*, political_actors!inner ( id, name, slug, actor_type )`)
        .gte('published_at', cutoffIso)
        .order('published_at', { ascending: false })
        .limit(3000),
      supabase
        .from('instagram_radar_posts')
        .select(`*, political_actors!inner ( id, name, slug, actor_type )`)
        .gte('posted_at', cutoffIso)
        .order('posted_at', { ascending: false })
        .limit(3000),
      supabase
        .from('meta_ads_mentions')
        .select(`*, political_actors!inner ( id, name, slug, actor_type )`)
        .or(
          `started_running_at.gte.${cutoffIso},and(started_running_at.is.null,collected_at.gte.${cutoffIso})`
        )
        .order('collected_at', { ascending: false })
        .limit(500),
      supabase
        .from('meta_ads_collect_log')
        .select('finished_at, started_at')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('instagram_radar_collect_log')
        .select('finished_at, started_at')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    let setupRequired = false
    const timestamps: string[] = []

    const trendsRowsAll =
      isSupabaseMissingTableError(trendsRes.error)
        ? []
        : normalizeGoogleTrendsInterestRows((trendsRes.data ?? []) as GoogleTrendsInterestRow[])
    const trendsRows = trendsRowsAll
    if (isSupabaseMissingTableError(trendsRes.error)) {
      setupRequired = true
    } else if (trendsRes.error) {
      console.warn('[monitoramento/panorama] google_trends_interest:', trendsRes.error.message)
    }

    for (const r of trendsRows) timestamps.push(r.collected_at)

    const trendsRelatedRows =
      trendsRelatedRes.error &&
      (trendsRelatedRes.error.message.includes('does not exist') || trendsRelatedRes.error.code === '42P01')
        ? []
        : ((trendsRelatedRes.data ?? []) as GoogleTrendsRelatedRow[])
    for (const r of trendsRelatedRows) timestamps.push(r.collected_at)

    const youtubeMentions =
      youtubeRes.error &&
      (youtubeRes.error.message.includes('does not exist') || youtubeRes.error.code === '42P01')
        ? []
        : ((youtubeRes.data ?? []) as YoutubeMentionWithActor[])
    for (const m of youtubeMentions) timestamps.push(m.collected_at)

    const googleNewsMentions =
      newsRes.error &&
      (newsRes.error.message.includes('does not exist') || newsRes.error.code === '42P01')
        ? []
        : ((newsRes.data ?? []) as GoogleNewsMentionWithActor[])
    for (const m of googleNewsMentions) timestamps.push(m.collected_at)

    const instagramPosts =
      instagramRes.error &&
      (instagramRes.error.message.includes('does not exist') || instagramRes.error.code === '42P01')
        ? []
        : ((instagramRes.data ?? []) as InstagramRadarPostWithActor[])
    for (const p of instagramPosts) timestamps.push(p.collected_at)

    const metaAdsMentions =
      metaRes.error &&
      (metaRes.error.message.includes('does not exist') || metaRes.error.code === '42P01')
        ? []
        : ((metaRes.data ?? []) as MetaAdsMentionWithActor[])
    for (const m of metaAdsMentions) timestamps.push(m.collected_at)

    if (collectLogRes.data?.finished_at) timestamps.push(collectLogRes.data.finished_at)
    else if (collectLogRes.data?.started_at) timestamps.push(collectLogRes.data.started_at)

    if (instagramLogRes.data?.finished_at) timestamps.push(instagramLogRes.data.finished_at)
    else if (instagramLogRes.data?.started_at) timestamps.push(instagramLogRes.data.started_at)

    const lastUpdated =
      timestamps.length > 0
        ? timestamps.reduce((acc, t) => (t > acc ? t : acc), timestamps[0])
        : null

    const trendsCompare = buildTrendsCompareFromRows(typedActors, trendsRows, trendsRelatedRows)

    const panorama = buildMonitoramentoPanorama({
      actors: typedActors,
      trendsRows: trendsCompare,
      trendsInterestRows: trendsRows,
      youtubeMentions,
      googleNewsMentions,
      instagramPosts,
      metaAdsMentions30d: metaAdsMentions,
      lastUpdated,
      setupRequired,
    })

    return NextResponse.json({
      panorama,
      collectorsStatus: getMonitoramentoCollectorsStatus(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao carregar panorama'
    console.error('[monitoramento/panorama]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
