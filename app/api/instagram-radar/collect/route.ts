import { NextResponse } from 'next/server'
import { z } from 'zod'
import { collectInstagramRadar } from '@/lib/instagram-radar-collect'
import { getInstagramRadarBudgetSummary } from '@/lib/instagram-radar-aggregate'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 900

const bodySchema = z.object({
  politicoSlug: z.string().trim().optional(),
  instagramToken: z.string().trim().optional(),
  instagramBusinessAccountId: z.string().trim().optional(),
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
    const parsed = await collectInstagramRadar({
      politicoSlug: body.politicoSlug,
      instagramToken: body.instagramToken,
      instagramBusinessAccountId: body.instagramBusinessAccountId,
    })

    return NextResponse.json({
      ok: true,
      results: parsed.results,
      totals: parsed.totals,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na coleta Instagram'
    console.error('[instagram-radar/collect]', e)
    const status = msg.includes('Limite semanal') ? 429 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function GET() {
  const budget = getInstagramRadarBudgetSummary()
  return NextResponse.json({
    provider: 'mixed',
    ownCandidate: {
      slug: 'jadyel-alencar',
      source: 'redes-instagram (localStorage + histórico Supabase) ou INSTAGRAM_TOKEN no servidor',
    },
    competitors: {
      source: 'apify/instagram-scraper',
      env: ['APIFY_TOKEN'],
    },
    pricing: {
      postsUsdPer1000: 1.5,
      freeMonthlyUsd: 5,
      source: 'https://apify.com/apify/instagram-scraper',
    },
    limits: budget,
    cooldown: '1 coleta a cada 7 dias (INSTAGRAM_RADAR_SKIP_COOLDOWN=1 para desativar)',
  })
}
