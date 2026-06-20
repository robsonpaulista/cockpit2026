import { NextResponse } from 'next/server'
import {
  buildMonitoramentoPanorama,
  buildTrendsCompareFromRows,
} from '@/lib/monitoramento-panorama'
import { googleTrendsTimeframeQueryKeys } from '@/lib/google-trends-timeframe'
import {
  panoramaWindowCutoffDay,
  panoramaWindowCutoffIso,
} from '@/lib/monitoramento-panorama-window'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import type { GoogleTrendsInterestRow, GoogleTrendsRelatedRow } from '@/lib/google-trends-types'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import { createClient } from '@/lib/supabase/server'
import type { PoliticalActorWithTerms, YoutubeMentionWithActor } from '@/lib/youtube-radar-types'

export const dynamic = 'force-dynamic'

const GEO = 'BR-PI'
const TIMEFRAME = 'today 3-m'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: actors, error: actorsError } = await supabase
      .from('political_actors')
      .select(
        `
        id,
        name,
        slug,
        actor_type,
        active,
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
      if (actorsError.message.includes('does not exist') || actorsError.code === '42P01') {
        return NextResponse.json({
          panorama: buildMonitoramentoPanorama({
            actors: [],
            trendsRows: [],
            trendsInterestRows: [],
            youtubeMentions: [],
            googleNewsMentions: [],
            metaAdsMentions30d: [],
            lastUpdated: null,
            setupRequired: true,
          }),
        })
      }
      throw new Error(actorsError.message)
    }

    const typedActors = (actors ?? []) as PoliticalActorWithTerms[]
    const timeframeKeys = googleTrendsTimeframeQueryKeys(TIMEFRAME)

    const cutoffIso = panoramaWindowCutoffIso()
    const cutoffDay = panoramaWindowCutoffDay()

    const [trendsRes, trendsRelatedRes, youtubeRes, newsRes, metaRes, collectLogRes] = await Promise.all([
      supabase
        .from('google_trends_interest')
        .select('*')
        .eq('geo', GEO)
        .in('timeframe', timeframeKeys)
        .order('interest_date', { ascending: true }),
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
    ])

    let setupRequired = false
    const timestamps: string[] = []

    const trendsRowsAll =
      trendsRes.error &&
      (trendsRes.error.message.includes('does not exist') || trendsRes.error.code === '42P01')
        ? []
        : ((trendsRes.data ?? []) as GoogleTrendsInterestRow[])
    const trendsRows = trendsRowsAll.filter((r) => r.interest_date >= cutoffDay)
    if (trendsRes.error && trendsRowsAll.length === 0) setupRequired = true

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

    const metaAdsMentions =
      metaRes.error &&
      (metaRes.error.message.includes('does not exist') || metaRes.error.code === '42P01')
        ? []
        : ((metaRes.data ?? []) as MetaAdsMentionWithActor[])
    for (const m of metaAdsMentions) timestamps.push(m.collected_at)

    if (collectLogRes.data?.finished_at) timestamps.push(collectLogRes.data.finished_at)
    else if (collectLogRes.data?.started_at) timestamps.push(collectLogRes.data.started_at)

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
      metaAdsMentions30d: metaAdsMentions,
      lastUpdated,
      setupRequired,
    })

    return NextResponse.json({ panorama })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao carregar panorama'
    console.error('[monitoramento/panorama]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
