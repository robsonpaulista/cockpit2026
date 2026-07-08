import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()

    const { searchParams } = new URL(request.url)
    const politicoSlug = searchParams.get('politico')?.trim() ?? 'all'
    const date = searchParams.get('date')?.trim() ?? ''
    const channel = searchParams.get('channel')?.trim() ?? 'all'
    const lookbackDays = Math.min(90, Math.max(1, Number(searchParams.get('days') ?? 7) || 7))
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') ?? 200) || 200))

    let query = supabase
      .from('google_news_mentions')
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
      if (channel === 'google_videos') {
        query = query
          .gte('collected_at', `${date}T00:00:00.000Z`)
          .lt('collected_at', `${endDate}T00:00:00.000Z`)
      } else {
        query = query
          .gte('published_at', `${date}T00:00:00.000Z`)
          .lt('published_at', `${endDate}T00:00:00.000Z`)
      }
    } else {
      const cutoff = new Date()
      cutoff.setUTCDate(cutoff.getUTCDate() - lookbackDays)
      const cutoffIso = cutoff.toISOString()
      if (channel === 'google_videos') {
        // Janela = última coleta; data exibida = published_at (data do vídeo)
        query = query.gte('collected_at', cutoffIso)
      } else {
        query = query.gte('published_at', cutoffIso)
      }
    }

    if (politicoSlug && politicoSlug !== 'all') {
      query = query.eq('political_actors.slug', politicoSlug)
    }

    if (channel === 'google_videos') {
      query = query
        .eq('collect_channel', 'google_videos')
        .in('platform', ['instagram', 'facebook', 'youtube', 'tiktok', 'twitter'])
    } else if (channel === 'news') {
      query = query.in('collect_channel', ['google_news_rss', 'google_web'])
    } else if (channel === 'google_news_rss' || channel === 'google_web') {
      query = query.eq('collect_channel', channel)
    }

    const { data, error } = await query

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json(
          {
            error:
              'Tabela google_news_mentions ausente. Execute database/create-google-news-radar-tables.sql no Supabase.',
            setupRequired: true,
            mentions: [],
          },
          { status: 503 }
        )
      }
      throw new Error(error.message)
    }

    const mentions = (data ?? []) as GoogleNewsMentionWithActor[]

    return NextResponse.json({
      mentions,
      lookbackDays: /^\d{4}-\d{2}-\d{2}$/.test(date) ? null : lookbackDays,
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      setupRequired: false,
    })
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      console.warn('[google-news/mentions] Supabase indisponível (rede). Respondendo 503 retryable.')
      return NextResponse.json(
        {
          error: 'Conexão com o Supabase temporariamente indisponível. Aguarde alguns segundos e tente novamente.',
          retryable: true,
          mentions: [],
        },
        { status: 503 }
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao listar notícias Google News'
    console.error('[google-news/mentions]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
