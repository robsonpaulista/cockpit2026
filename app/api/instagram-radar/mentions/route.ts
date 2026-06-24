import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()

    const { searchParams } = new URL(request.url)
    const politico = searchParams.get('politico') ?? 'all'
    const daysRaw = Number(searchParams.get('days') ?? 30)
    const limitRaw = Number(searchParams.get('limit') ?? 300)
    const days = Number.isFinite(daysRaw) ? Math.min(90, Math.max(1, daysRaw)) : 30
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, limitRaw)) : 300

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffIso = cutoff.toISOString()

    let query = supabase
      .from('instagram_radar_posts')
      .select(`*, political_actors!inner ( id, name, slug, actor_type )`)
      .gte('posted_at', cutoffIso)
      .order('posted_at', { ascending: false })
      .limit(limit)

    if (politico !== 'all') {
      query = query.eq('political_actors.slug', politico)
    }

    const { data, error } = await query

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({
          setupRequired: true,
          posts: [] as InstagramRadarPostWithActor[],
        })
      }
      throw new Error(error.message)
    }

    return NextResponse.json({
      setupRequired: false,
      posts: (data ?? []) as InstagramRadarPostWithActor[],
      lookbackDays: days,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao carregar posts Instagram'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
