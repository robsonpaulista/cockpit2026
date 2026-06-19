import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'

export const dynamic = 'force-dynamic'

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
    const politicoSlug = searchParams.get('politico')?.trim() ?? 'all'
    const lookbackDays = Math.min(90, Math.max(1, Number(searchParams.get('days') ?? 7) || 7))
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') ?? 200) || 200))

    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - lookbackDays)

    let query = supabase
      .from('google_news_mentions')
      .select(
        `
        *,
        political_actors!inner ( id, name, slug, actor_type )
      `
      )
      .gte('published_at', cutoff.toISOString())
      .order('published_at', { ascending: false })
      .limit(limit)

    if (politicoSlug && politicoSlug !== 'all') {
      query = query.eq('political_actors.slug', politicoSlug)
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
      lookbackDays,
      setupRequired: false,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao listar notícias Google News'
    console.error('[google-news/mentions]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
