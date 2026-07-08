import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import type { YoutubeMentionWithActor, YoutubeRadarSummary } from '@/lib/youtube-radar-types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()

    const { searchParams } = new URL(request.url)
    const politicoSlug = searchParams.get('politico')?.trim() ?? 'all'
    const date = searchParams.get('date')?.trim() ?? ''
    const lookbackDays = Math.min(90, Math.max(1, Number(searchParams.get('days') ?? 7) || 7))
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') ?? 200) || 200))

    let query = supabase
      .from('youtube_mentions')
      .select(
        `
        *,
        political_actors!inner ( id, name, slug, actor_type )
      `
      )
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const nextDay = new Date(`${date}T12:00:00.000Z`)
      nextDay.setUTCDate(nextDay.getUTCDate() + 1)
      const endDate = nextDay.toISOString().slice(0, 10)
      query = query.gte('published_at', `${date}T00:00:00.000Z`).lt('published_at', `${endDate}T00:00:00.000Z`)
    } else {
      const cutoff = new Date()
      cutoff.setUTCDate(cutoff.getUTCDate() - lookbackDays)
      query = query.gte('published_at', cutoff.toISOString())
    }

    if (politicoSlug && politicoSlug !== 'all') {
      query = query.eq('political_actors.slug', politicoSlug)
    }

    const { data, error } = await query

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json(
          {
            error:
              'Tabelas do Radar YouTube ainda não existem. Execute database/create-youtube-radar-tables.sql no Supabase.',
          },
          { status: 503 }
        )
      }
      throw new Error(error.message)
    }

    const mentions = (data ?? []) as YoutubeMentionWithActor[]

    const channelCounts = new Map<string, number>()
    let totalViews = 0
    let latestCollected: string | null = null

    for (const m of mentions) {
      totalViews += m.views ?? 0
      const ch = m.channel_title?.trim() || 'Canal desconhecido'
      channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1)
      if (!latestCollected || m.collected_at > latestCollected) {
        latestCollected = m.collected_at
      }
    }

    const topChannels = [...channelCounts.entries()]
      .map(([channel_title, count]) => ({ channel_title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    const summary: YoutubeRadarSummary = {
      totalVideos: mentions.length,
      totalViews,
      topChannels,
      lookbackDays,
      collectedAt: latestCollected,
    }

    return NextResponse.json({
      mentions,
      summary,
      lookbackDays: /^\d{4}-\d{2}-\d{2}$/.test(date) ? null : lookbackDays,
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    })
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      console.warn('[youtube/mentions] Supabase indisponível (rede). Respondendo 503 retryable.')
      return NextResponse.json(
        {
          error: 'Conexão com o Supabase temporariamente indisponível. Aguarde alguns segundos e tente novamente.',
          retryable: true,
          mentions: [],
        },
        { status: 503 }
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao listar menções'
    console.error('[youtube/mentions]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
