import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildGoogleTrendsCompareRows,
  buildGoogleTrendsSeries,
  buildTrendsChartData,
} from '@/lib/google-trends-aggregate'
import type { GoogleTrendsInterestRow } from '@/lib/google-trends-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'

export const dynamic = 'force-dynamic'

const ALLOWED_TIMEFRAMES = new Set(['today 3-m', 'today 1-m', 'today 7-d'])

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const geo = searchParams.get('geo')?.trim() || 'BR-PI'
    const timeframe = searchParams.get('timeframe')?.trim() || 'today 3-m'
    if (!ALLOWED_TIMEFRAMES.has(timeframe)) {
      return NextResponse.json({ error: 'timeframe inválido.' }, { status: 400 })
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

    const { data: interestRows, error: interestError } = await supabase
      .from('google_trends_interest')
      .select('*')
      .eq('geo', geo)
      .eq('timeframe', timeframe)
      .order('interest_date', { ascending: true })

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

    const typedActors = (actors ?? []) as PoliticalActorWithTerms[]
    const rows = (interestRows ?? []) as GoogleTrendsInterestRow[]
    const series = buildGoogleTrendsSeries(typedActors, rows)
    const compare = buildGoogleTrendsCompareRows(typedActors, rows)
    const chartData = buildTrendsChartData(series)

    const latestCollected = rows.reduce<string | null>((acc, r) => {
      if (!acc || r.collected_at > acc) return r.collected_at
      return acc
    }, null)

    return NextResponse.json({
      actors: typedActors,
      rows,
      series,
      compare,
      chartData,
      geo,
      timeframe,
      collectedAt: latestCollected,
      setupRequired: false,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao carregar Trends'
    console.error('[trends/interest]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
