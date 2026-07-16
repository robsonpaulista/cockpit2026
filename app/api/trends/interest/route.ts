import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import {
  buildGoogleTrendsCompareRows,
  buildGoogleTrendsSeries,
  buildTrendsChartData,
} from '@/lib/google-trends-aggregate'
import {
  googleTrendsInterestDateRange,
  googleTrendsInterestQueryCutoffDay,
  GOOGLE_TRENDS_INTEREST_QUERY_LIMIT,
  normalizeGoogleTrendsInterestRows,
} from '@/lib/google-trends-normalize-rows'
import { isGoogleTrendsSeriesStale } from '@/lib/google-trends-interest-date'
import type { GoogleTrendsInterestRow, GoogleTrendsRelatedRow } from '@/lib/google-trends-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import {
  googleTrendsTimeframeQueryKeys,
  normalizeGoogleTrendsTimeframe,
  DEFAULT_GOOGLE_TRENDS_TIMEFRAME,
} from '@/lib/google-trends-timeframe'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()

    const { searchParams } = new URL(request.url)
    const geo = searchParams.get('geo')?.trim() || 'BR-PI'
    const timeframe =
      normalizeGoogleTrendsTimeframe(searchParams.get('timeframe')) ?? DEFAULT_GOOGLE_TRENDS_TIMEFRAME
    if (!timeframe) {
      return NextResponse.json({ error: 'timeframe inválido.' }, { status: 400 })
    }
    const baseCampanha = searchParams.get('base')?.trim().toLowerCase() === 'campanha'
    const campaignTerms = baseCampanha
      ? (await import('@/lib/campaign-trends-keywords')).getCampaignTrendsTermSet()
      : null

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
          actors: [],
          rows: [],
          series: [],
          compare: [],
          chartData: [],
          setupRequired: true,
        })
      }
      throw new Error(actorsError.message)
    }

    const timeframeKeys = googleTrendsTimeframeQueryKeys(timeframe)
    const interestCutoffDay = googleTrendsInterestQueryCutoffDay()

    let interestQuery = supabase
      .from('google_trends_interest')
      .select('*')
      .eq('geo', geo)
      .in('timeframe', timeframeKeys)
      .gte('interest_date', interestCutoffDay)
      .order('interest_date', { ascending: true })
      .limit(GOOGLE_TRENDS_INTEREST_QUERY_LIMIT)

    if (campaignTerms) {
      interestQuery = interestQuery.in('search_term', [...campaignTerms])
    }

    const { data: interestRows, error: interestError } = await interestQuery

    let relatedQuery = supabase
      .from('google_trends_related')
      .select('*')
      .eq('geo', geo)
      .in('timeframe', timeframeKeys)
      .order('rank', { ascending: true })

    if (campaignTerms) {
      relatedQuery = relatedQuery.in('search_term', [...campaignTerms])
    }

    const { data: relatedRowsRaw } = await relatedQuery

    const relatedRows = (relatedRowsRaw ?? []) as GoogleTrendsRelatedRow[]

    if (interestError) {
      if (interestError.message.includes('does not exist') || interestError.code === '42P01') {
        return NextResponse.json({
          actors: actors ?? [],
          rows: [],
          series: [],
          compare: [],
          chartData: [],
          setupRequired: true,
        })
      }
      throw new Error(interestError.message)
    }

    const typedActors = baseCampanha ? [] : ((actors ?? []) as PoliticalActorWithTerms[])
    const rowsRaw = (interestRows ?? []) as GoogleTrendsInterestRow[]
    const rows = normalizeGoogleTrendsInterestRows(rowsRaw)
    const series = buildGoogleTrendsSeries(typedActors, rows)
    const compare = buildGoogleTrendsCompareRows(typedActors, rows, relatedRows)
    const chartData = buildTrendsChartData(series)
    const { dateFrom, dateTo } = googleTrendsInterestDateRange(rows)
    const seriesStale = isGoogleTrendsSeriesStale(dateTo)

    const latestCollected = rows.reduce<string | null>((acc, r) => {
      if (!acc || r.collected_at > acc) return r.collected_at
      return acc
    }, null)

    const keywords = baseCampanha
      ? (await import('@/lib/campaign-trends-keywords')).getAllCampaignTrendsKeywords()
      : undefined

    return NextResponse.json({
      actors: typedActors,
      rows,
      relatedRows,
      series,
      compare,
      chartData,
      keywords,
      geo,
      timeframe,
      dateFrom,
      dateTo,
      seriesStale,
      collectedAt: latestCollected,
      setupRequired: false,
      base: baseCampanha ? 'campanha' : 'atores',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao carregar Trends'
    console.error('[trends/interest]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
