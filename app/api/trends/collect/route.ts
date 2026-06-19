import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { collectGoogleTrends } from '@/lib/google-trends-collect'
import type { GoogleTrendsTimeframe } from '@/lib/google-trends-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const bodySchema = z.object({
  geo: z.string().trim().min(2).max(12).optional().default('BR-PI'),
  timeframe: z
    .enum(['today 3-m', 'today 1-m', 'today 7-d'])
    .optional()
    .default('today 3-m'),
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
    const result = await collectGoogleTrends({
      geo: body.geo,
      timeframe: body.timeframe,
    })

    return NextResponse.json({
      ok: true,
      geo: result.geo ?? body.geo,
      timeframe: result.timeframe ?? body.timeframe,
      terms: result.terms ?? 0,
      rowsUpserted: result.rowsUpserted ?? 0,
      errors: result.errors ?? [],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na coleta Google Trends'
    console.error('[trends/collect]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    geo: 'BR-PI',
    defaultTimeframe: 'today 3-m' satisfies GoogleTrendsTimeframe,
    python: 'scripts/collect-google-trends.py',
    requirements: 'scripts/requirements-trends.txt',
  })
}
