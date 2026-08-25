import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import { adBelongsToPoliticalActor } from '@/lib/meta-ads-actor-match'
import { purgeUnrelatedMetaAdsMentions } from '@/lib/meta-ads-purge-unrelated'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()

    const { searchParams } = new URL(request.url)
    const politicoSlug = searchParams.get('politico')?.trim() ?? 'all'
    const lookbackDays = Math.min(90, Math.max(1, Number(searchParams.get('days') ?? 30) || 30))
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') ?? 200) || 200))

    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - lookbackDays)
    const cutoffIso = cutoff.toISOString()

    const dbLimit = Math.min(2000, Math.max(limit * 4, 500))

    let query = supabase
      .from('meta_ads_mentions')
      .select(
        `
        *,
        political_actors!inner ( id, name, slug, actor_type, instagram_username )
      `
      )
      .or(`started_running_at.gte.${cutoffIso},and(started_running_at.is.null,collected_at.gte.${cutoffIso})`)
      .order('started_running_at', { ascending: false, nullsFirst: false })
      .limit(dbLimit)

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

    const rawAds = (data ?? []) as MetaAdsMentionWithActor[]
    const matchedAds = rawAds.filter((ad) => {
      const actor = ad.political_actors
      if (!actor) return false
      return adBelongsToPoliticalActor(
        {
          page_name: ad.page_name,
          payer_name: ad.payer_name,
          ad_body: ad.ad_body,
        },
        {
          name: actor.name,
          instagram_username: actor.instagram_username,
        },
      )
    })
    const ads = matchedAds.slice(0, limit)

    if (matchedAds.length < rawAds.length) {
      try {
        const admin = createAdminClient()
        void purgeUnrelatedMetaAdsMentions(admin).catch((purgeErr) => {
          console.warn('[meta-ads/mentions] purge de anúncios irrelevantes:', purgeErr)
        })
      } catch (purgeSetupErr) {
        console.warn('[meta-ads/mentions] não foi possível iniciar o purge:', purgeSetupErr)
      }
    }

    return NextResponse.json({
      ads,
      lookbackDays,
      setupRequired: false,
    })
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      console.warn('[meta-ads/mentions] Supabase indisponível (rede). Respondendo 503 retryable.')
      return NextResponse.json(
        {
          error: 'Conexão com o Supabase temporariamente indisponível. Aguarde alguns segundos e tente novamente.',
          retryable: true,
          ads: [],
        },
        { status: 503 }
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao listar anúncios Meta Ads'
    console.error('[meta-ads/mentions]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
