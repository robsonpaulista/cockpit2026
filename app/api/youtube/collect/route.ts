import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isYoutubeApiConfigured } from '@/lib/youtube-data-api'
import { collectYoutubeRadar } from '@/lib/youtube-radar-collect'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const bodySchema = z.object({
  lookbackDays: z.union([z.literal(1), z.literal(7), z.literal(30)]).optional().default(7),
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

    if (!isYoutubeApiConfigured()) {
      return NextResponse.json(
        {
          error:
            'YOUTUBE_DATA_API_KEY não configurada no servidor. Adicione em .env.local e reinicie o app.',
        },
        { status: 503 }
      )
    }

    const body = bodySchema.parse(await request.json().catch(() => ({})))
    const results = await collectYoutubeRadar(supabase, {
      lookbackDays: body.lookbackDays,
      politicoSlug: body.politicoSlug,
    })

    const totals = results.reduce(
      (acc, r) => {
        acc.videosFound += r.videosFound
        acc.videosInserted += r.videosInserted
        acc.videosUpdated += r.videosUpdated
        acc.quotaEstimate += r.quotaEstimate
        acc.errors.push(...r.errors)
        return acc
      },
      { videosFound: 0, videosInserted: 0, videosUpdated: 0, quotaEstimate: 0, errors: [] as string[] }
    )

    return NextResponse.json({
      ok: true,
      lookbackDays: body.lookbackDays,
      results,
      totals,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na coleta YouTube'
    console.error('[youtube/collect]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    configured: isYoutubeApiConfigured(),
    defaultLookbackDays: 7,
    pilot: { slug: 'jadyel-alencar', term: 'Jadyel Alencar' },
  })
}
