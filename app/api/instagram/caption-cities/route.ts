import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logError } from '@/lib/logger'
import { getLatestInstagramPostMetrics } from '@/lib/instagram-snapshot-server'
import { aggregateInstagramMetricsByCaptionCity } from '@/lib/instagram-city-caption-stats'
import { normalizeIptMunicipio } from '@/lib/ipt'

export const dynamic = 'force-dynamic'

/**
 * Agrega posts do histórico (snapshots) por município citado na legenda.
 * Mesma lógica de Redes → Por cidade → Posts (legenda), janela padrão 30 dias.
 */
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const rateLimitResult = checkRateLimit(
      `instagram-caption-cities:${user.id}`,
      RATE_LIMITS.INSTAGRAM,
    )
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde antes de tentar novamente.' },
        { status: 429 },
      )
    }

    const { searchParams } = new URL(request.url)
    const daysRaw = Number(searchParams.get('days') ?? '30')
    const days =
      Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(Math.floor(daysRaw), 90) : 30

    const records = await getLatestInstagramPostMetrics(supabase, user.id)
    const startMs = Date.now() - days * 24 * 60 * 60 * 1000
    const posts = records.filter((post) => {
      const t = new Date(post.postedAt).getTime()
      return !Number.isNaN(t) && t >= startMs
    })

    const aggregate = aggregateInstagramMetricsByCaptionCity(posts)
    const byMunicipio: Record<
      string,
      {
        posts: number
        engagement: number
        avgEngagement: number
        likes: number
        comments: number
      }
    > = {}

    for (const city of aggregate.cities) {
      const key = normalizeIptMunicipio(city.municipio)
      byMunicipio[key] = {
        posts: city.posts,
        engagement: city.engagement,
        avgEngagement: city.avgEngagement,
        likes: city.likes,
        comments: city.comments,
      }
    }

    return NextResponse.json({
      days,
      postsTotal: aggregate.postsTotal,
      postsWithCity: aggregate.postsWithCity,
      postsWithoutCity: aggregate.postsWithoutCity,
      cityCount: aggregate.cities.length,
      byMunicipio,
    })
  } catch (error) {
    logError('Erro em /api/instagram/caption-cities', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
