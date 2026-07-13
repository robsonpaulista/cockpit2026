import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import {
  DEFAULT_GOOGLE_TRENDING_GEO,
  DEFAULT_GOOGLE_TRENDING_HOURS,
  normalizeGoogleTrendingHours,
  type GoogleTrendingTopicRow,
} from '@/lib/google-trending-topics-types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const geo = searchParams.get('geo')?.trim().toUpperCase() || DEFAULT_GOOGLE_TRENDING_GEO
    const hours = normalizeGoogleTrendingHours(searchParams.get('hours')) ?? DEFAULT_GOOGLE_TRENDING_HOURS
    const historyLimit = Math.min(Math.max(Number(searchParams.get('history') ?? '6') || 6, 1), 24)

    const supabase = createClient()

    const { data: latestMeta, error: metaError } = await supabase
      .from('google_trending_topics')
      .select('collected_at')
      .eq('geo', geo)
      .eq('hours', hours)
      .order('collected_at', { ascending: false })
      .limit(1)

    if (metaError) {
      if (metaError.message.includes('does not exist') || metaError.code === '42P01') {
        return NextResponse.json({
          setupRequired: true,
          geo,
          hours,
          collectedAt: null,
          items: [],
          history: [],
        })
      }
      throw new Error(metaError.message)
    }

    const collectedAt = latestMeta?.[0]?.collected_at ?? null
    if (!collectedAt) {
      return NextResponse.json({
        setupRequired: false,
        geo,
        hours,
        collectedAt: null,
        items: [],
        history: [],
      })
    }

    const { data: items, error: itemsError } = await supabase
      .from('google_trending_topics')
      .select(
        'id, collected_at, geo, hours, rank, keyword, traffic, traffic_growth_rate, related_keywords, active_time, created_at'
      )
      .eq('geo', geo)
      .eq('hours', hours)
      .eq('collected_at', collectedAt)
      .order('rank', { ascending: true })

    if (itemsError) throw new Error(itemsError.message)

    const { data: historyRows, error: historyError } = await supabase
      .from('google_trending_topics')
      .select('collected_at')
      .eq('geo', geo)
      .eq('hours', hours)
      .order('collected_at', { ascending: false })
      .limit(historyLimit * 40)

    if (historyError) throw new Error(historyError.message)

    const seen = new Set<string>()
    const history: string[] = []
    for (const row of historyRows ?? []) {
      const ts = row.collected_at as string
      if (seen.has(ts)) continue
      seen.add(ts)
      history.push(ts)
      if (history.length >= historyLimit) break
    }

    return NextResponse.json({
      setupRequired: false,
      geo,
      hours,
      collectedAt,
      items: (items ?? []) as GoogleTrendingTopicRow[],
      history,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao carregar temas em alta'
    console.error('[viral-trends/topics]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
