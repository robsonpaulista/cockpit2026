import { NextResponse } from 'next/server'
import { z } from 'zod'
import { collectMetaAds } from '@/lib/meta-ads-collect'
import { MetaAdsRunnerUnavailableError } from '@/lib/serverless-runtime'
import { requireRouteUser } from '@/lib/supabase/route-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 900

const bodySchema = z.object({
  politicoSlug: z.string().trim().optional(),
})

export async function POST(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const body = bodySchema.parse(await request.json().catch(() => ({})))
    const parsed = await collectMetaAds({ politicoSlug: body.politicoSlug })

    return NextResponse.json({
      ok: true,
      results: parsed.results,
      totals: parsed.totals,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na coleta Meta Ads'
    console.error('[meta-ads/collect]', e)
    if (e instanceof MetaAdsRunnerUnavailableError) {
      return NextResponse.json({ error: msg, runnerAvailable: false }, { status: 503 })
    }
    const status = msg.includes('Limite diário') ? 429 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function GET() {
  return NextResponse.json({
    provider: 'meta-ads-library-playwright',
    searchBase: 'https://www.facebook.com/ads/library',
    dailyLimit: '1 coleta a cada 24 horas',
  })
}
