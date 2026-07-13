import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { startGoogleTrendingTopicsCollect } from '@/lib/google-trending-topics-collect'
import {
  DEFAULT_GOOGLE_TRENDING_GEO,
  DEFAULT_GOOGLE_TRENDING_HOURS,
  GOOGLE_TRENDING_HOURS,
  normalizeGoogleTrendingHours,
} from '@/lib/google-trending-topics-types'
import {
  GoogleTrendsRunnerUnavailableError,
  isGoogleTrendsRunnerAvailable,
} from '@/lib/serverless-runtime'

export const dynamic = 'force-dynamic'

const VIRAL_RUNNER_MESSAGE =
  'Coleta de temas em alta indisponível na Vercel. Rode localmente: node scripts/collect-google-trending-topics.mjs'

const hoursSchema = z
  .union([z.number(), z.string()])
  .transform((v, ctx) => {
    const normalized = normalizeGoogleTrendingHours(v)
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'hours inválido (4, 24, 48 ou 168).' })
      return z.NEVER
    }
    return normalized
  })

const bodySchema = z.object({
  geo: z.string().trim().min(2).max(8).optional().default(DEFAULT_GOOGLE_TRENDING_GEO),
  hours: hoursSchema.optional().default(DEFAULT_GOOGLE_TRENDING_HOURS),
})

export async function POST(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const body = bodySchema.parse(await request.json().catch(() => ({})))
    const started = startGoogleTrendingTopicsCollect({
      geo: body.geo,
      hours: body.hours,
    })

    if (started.status === 'already_running') {
      return NextResponse.json({ ok: true, started: false, collectInProgress: true })
    }

    return NextResponse.json({
      ok: true,
      started: true,
      collectInProgress: true,
      geo: body.geo,
      hours: body.hours,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na coleta de temas em alta'
    console.error('[viral-trends/collect]', e)
    if (e instanceof GoogleTrendsRunnerUnavailableError) {
      return NextResponse.json({ error: msg, runnerAvailable: false }, { status: 503 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    geo: DEFAULT_GOOGLE_TRENDING_GEO,
    defaultHours: DEFAULT_GOOGLE_TRENDING_HOURS,
    hoursOptions: GOOGLE_TRENDING_HOURS,
    provider: 'trendsearch.trendingNow',
    runnerAvailable: isGoogleTrendsRunnerAvailable(),
    runnerMessage: isGoogleTrendsRunnerAvailable() ? null : VIRAL_RUNNER_MESSAGE,
  })
}
