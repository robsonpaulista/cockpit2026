import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import {
  collectGoogleNewsRadar,
  isGoogleWebSearchConfigured,
} from '@/lib/google-news-collect'
import { isGoogleVideosRunnerAvailable } from '@/lib/serverless-runtime'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const bodySchema = z.object({
  politicoSlug: z.string().trim().optional(),
})

export async function POST(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()

    const body = bodySchema.parse(await request.json().catch(() => ({})))
    const results = await collectGoogleNewsRadar(supabase, {
      politicoSlug: body.politicoSlug,
    })

    const totals = results.reduce(
      (acc, r) => {
        acc.articlesFound += r.articlesFound
        acc.articlesInserted += r.articlesInserted
        acc.articlesUpdated += r.articlesUpdated
        acc.webArticlesFound += r.webArticlesFound
        acc.errors.push(...r.errors)
        return acc
      },
      {
        articlesFound: 0,
        articlesInserted: 0,
        articlesUpdated: 0,
        webArticlesFound: 0,
        errors: [] as string[],
      }
    )

    return NextResponse.json({
      ok: true,
      results,
      totals,
      webSearchEnabled: results.some((r) => r.webSearchEnabled),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na coleta Google News'
    console.error('[google-news/collect]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    providers: ['google-news-rss', 'google-web-search'],
    rssSearchBase: 'https://news.google.com/rss/search',
    webSearchEnabled: isGoogleWebSearchConfigured(),
    webSearchRequires: ['GOOGLE_CSE_API_KEY ou GOOGLE_API_KEY', 'GOOGLE_CSE_ID'],
    videoTab: '/dashboard/noticias/monitoramento?tab=google-videos',
    videoSearchEnabled: isGoogleVideosRunnerAvailable(),
    videoSearchProvider: 'playwright',
  })
}
