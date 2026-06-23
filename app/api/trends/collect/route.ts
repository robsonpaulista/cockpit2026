import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { startGoogleTrendsCollect } from '@/lib/google-trends-collect'
import { normalizeGoogleTrendsTimeframe, DEFAULT_GOOGLE_TRENDS_TIMEFRAME } from '@/lib/google-trends-timeframe'
import {
  GoogleTrendsRunnerUnavailableError,
  GOOGLE_TRENDS_RUNNER_UNAVAILABLE_MESSAGE,
  isGoogleTrendsRunnerAvailable,
} from '@/lib/serverless-runtime'

export const dynamic = 'force-dynamic'

const timeframeSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const normalized = normalizeGoogleTrendsTimeframe(v)
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'timeframe inválido.' })
      return z.NEVER
    }
    return normalized
  })

const bodySchema = z.object({
  geo: z.string().trim().min(2).max(12).optional().default('BR-PI'),
  timeframe: timeframeSchema.optional().default(DEFAULT_GOOGLE_TRENDS_TIMEFRAME),
  /** Padrão true: só interesse comparativo (~1 min). Use false para consultas/tópicos relacionados (lento). */
  skipRelated: z.boolean().optional().default(true),
})

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = bodySchema.parse(await request.json().catch(() => ({})))
    const started = startGoogleTrendsCollect({
      geo: body.geo,
      timeframe: body.timeframe,
      skipRelated: body.skipRelated,
    })

    if (started.status === 'already_running') {
      return NextResponse.json({ ok: true, started: false, collectInProgress: true })
    }

    return NextResponse.json({
      ok: true,
      started: true,
      collectInProgress: true,
      geo: body.geo,
      timeframe: body.timeframe,
      skipRelated: body.skipRelated,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na coleta Google Trends'
    console.error('[trends/collect]', e)
    if (e instanceof GoogleTrendsRunnerUnavailableError) {
      return NextResponse.json({ error: msg, runnerAvailable: false }, { status: 503 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    geo: 'BR-PI',
    defaultTimeframe: DEFAULT_GOOGLE_TRENDS_TIMEFRAME,
    provider: 'trendsearch',
    runnerAvailable: isGoogleTrendsRunnerAvailable(),
    runnerMessage: isGoogleTrendsRunnerAvailable() ? null : GOOGLE_TRENDS_RUNNER_UNAVAILABLE_MESSAGE,
    runner:
      process.env.VERCEL === '1' && isGoogleTrendsRunnerAvailable()
        ? 'lib/google-trends-collect-core.ts'
        : 'scripts/collect-google-trends.mjs',
  })
}
