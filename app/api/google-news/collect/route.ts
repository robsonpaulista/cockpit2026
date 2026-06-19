import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { collectGoogleNewsRadar } from '@/lib/google-news-collect'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const bodySchema = z.object({
  politicoSlug: z.string().trim().optional(),
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
    const results = await collectGoogleNewsRadar(supabase, {
      politicoSlug: body.politicoSlug,
    })

    const totals = results.reduce(
      (acc, r) => {
        acc.articlesFound += r.articlesFound
        acc.articlesInserted += r.articlesInserted
        acc.articlesUpdated += r.articlesUpdated
        acc.errors.push(...r.errors)
        return acc
      },
      { articlesFound: 0, articlesInserted: 0, articlesUpdated: 0, errors: [] as string[] }
    )

    return NextResponse.json({ ok: true, results, totals })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na coleta Google News'
    console.error('[google-news/collect]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    provider: 'google-news-rss',
    searchBase: 'https://news.google.com/rss/search',
  })
}
