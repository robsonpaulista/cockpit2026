import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'

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
    const lookbackDays = Math.min(90, Math.max(1, Number(searchParams.get('days') ?? 30) || 30))
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') ?? 200) || 200))

    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - lookbackDays)
    const cutoffIso = cutoff.toISOString()

    let query = supabase
      .from('meta_ads_mentions')
      .select(
        `
        *,
        political_actors!inner ( id, name, slug, actor_type )
      `
      )
      .or(`started_running_at.gte.${cutoffIso},and(started_running_at.is.null,collected_at.gte.${cutoffIso})`)
      .order('started_running_at', { ascending: false, nullsFirst: false })
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
              'Tabela meta_ads_mentions ausente. Execute database/create-meta-ads-radar-tables.sql no Supabase.',
            setupRequired: true,
            ads: [],
          },
          { status: 503 }
        )
      }
      throw new Error(error.message)
    }

    const ads = (data ?? []) as MetaAdsMentionWithActor[]

    return NextResponse.json({
      ads,
      lookbackDays,
      setupRequired: false,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao listar anúncios Meta Ads'
    console.error('[meta-ads/mentions]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
