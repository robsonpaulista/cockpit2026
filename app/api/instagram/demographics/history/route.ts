import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { logError } from '@/lib/logger'
import { loadInstagramCityDemographicsSeries } from '@/lib/instagram-city-demographics-history'

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

    const rateLimitResult = checkRateLimit(
      `instagram-demo-history:${user.id}`,
      RATE_LIMITS.INSTAGRAM,
    )
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde antes de tentar novamente.' },
        { status: 429 },
      )
    }

    const daysRaw = Number(new URL(request.url).searchParams.get('days') ?? '90')
    const lookbackDays =
      Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(Math.floor(daysRaw), 180) : 90

    const seriesByCity = await loadInstagramCityDemographicsSeries({
      userId: user.id,
      lookbackDays,
    })

    return NextResponse.json({ lookbackDays, seriesByCity })
  } catch (error) {
    logError('Erro em /api/instagram/demographics/history', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
