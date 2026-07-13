import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logger, logError } from '@/lib/logger'
import {
  loadInstagramCityDemographicsEvolution,
  saveInstagramCityDemographicsSnapshot,
} from '@/lib/instagram-city-demographics-history'

export const dynamic = 'force-dynamic'

type DemoBreakdownBlock = {
  dimension_keys: string[]
  results: Array<{ dimension_values: string[]; value: number }>
}

type DemoMetricPayload = {
  data?: Array<{
    name: string
    total_value?: { breakdowns?: DemoBreakdownBlock[] }
  }>
  error?: { message?: string; code?: number }
}

const API_VERSION = 'v21.0'

function readDimensionValue(keys: string[], values: string[], key: string): string | undefined {
  const idx = keys.indexOf(key)
  if (idx < 0) return undefined
  return values[idx]?.trim() || undefined
}

function collectCityMap(blocks: DemoBreakdownBlock[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const block of blocks) {
    const keys = block.dimension_keys || []
    if (!keys.includes('city')) continue
    for (const result of block.results || []) {
      const city = readDimensionValue(keys, result.dimension_values || [], 'city')
      const value = Number(result.value) || 0
      if (!city || value <= 0) continue
      map[city] = (map[city] || 0) + value
    }
  }
  return map
}

async function fetchCityBreakdown(
  igUserId: string,
  token: string,
  metric: 'follower_demographics' | 'engaged_audience_demographics',
  timeframe: string
): Promise<Record<string, number>> {
  const url =
    `https://graph.facebook.com/${API_VERSION}/${igUserId}/insights` +
    `?metric=${metric}` +
    `&period=lifetime` +
    `&timeframe=${timeframe}` +
    `&metric_type=total_value` +
    `&breakdown=city` +
    `&access_token=${token}`

  const response = await fetch(url)
  const payload = (await response.json()) as DemoMetricPayload
  if (!response.ok) {
    logger.warn('instagram demographics city falhou', {
      metric,
      timeframe,
      status: response.status,
      error: payload.error?.message,
    })
    return {}
  }
  const row = payload.data?.find((item) => item.name === metric)
  return collectCityMap(row?.total_value?.breakdowns ?? [])
}

/**
 * Endpoint leve para o mapa IPT: só demográficos por cidade + total de seguidores.
 * Evita puxar posts/insights completos de /api/instagram.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const rateLimitResult = checkRateLimit(`instagram-demo:${user.id}`, RATE_LIMITS.INSTAGRAM)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde antes de tentar novamente.' },
        { status: 429 }
      )
    }

    const body = (await request.json()) as {
      token?: string
      businessAccountId?: string
    }
    const token = body.token?.trim()
    const businessAccountId = body.businessAccountId?.trim()
    if (!token || !businessAccountId) {
      return NextResponse.json(
        { error: 'Token e Business Account ID são obrigatórios' },
        { status: 400 }
      )
    }

    const pageResponse = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${businessAccountId}?fields=instagram_business_account{id,followers_count}&access_token=${token}`
    )
    if (!pageResponse.ok) {
      const err = (await pageResponse.json()) as { error?: { message?: string } }
      return NextResponse.json(
        { error: err.error?.message || 'Erro ao buscar conta Instagram' },
        { status: 400 }
      )
    }

    const pageData = (await pageResponse.json()) as {
      instagram_business_account?: { id?: string; followers_count?: number }
    }
    const igUserId = pageData.instagram_business_account?.id
    if (!igUserId) {
      return NextResponse.json(
        { error: 'Esta página não tem conta Instagram Business associada' },
        { status: 400 }
      )
    }

    const followersTotal = pageData.instagram_business_account?.followers_count ?? 0

    const [topLocations, engagedTopLocations] = await Promise.all([
      fetchCityBreakdown(igUserId, token, 'follower_demographics', 'last_30_days'),
      fetchCityBreakdown(igUserId, token, 'engaged_audience_demographics', 'this_month'),
    ])

    // Snapshot diário (histórico para evolução no IPT)
    const saved = await saveInstagramCityDemographicsSnapshot({
      userId: user.id,
      followersTotal,
      topLocations,
      engagedTopLocations,
    })

    const { previousByMunicipio } = await loadInstagramCityDemographicsEvolution({
      userId: user.id,
      lookbackDays: 30,
    })

    const previousByMunicipioObj: Record<
      string,
      { followers: number; engaged: number; date: string }
    > = {}
    for (const [k, v] of previousByMunicipio) previousByMunicipioObj[k] = v

    return NextResponse.json({
      followersTotal,
      topLocations,
      engagedTopLocations,
      topLocationsCount: Object.keys(topLocations).length,
      engagedTopLocationsCount: Object.keys(engagedTopLocations).length,
      snapshotSaved: saved,
      previousByMunicipio: previousByMunicipioObj,
    })
  } catch (error) {
    logError('Erro em /api/instagram/demographics', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
