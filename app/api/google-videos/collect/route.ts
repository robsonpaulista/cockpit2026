import { NextResponse } from 'next/server'

import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

import { requireRouteUser } from '@/lib/supabase/route-auth'

import { collectGoogleVideos, getGoogleVideosCollectStatus } from '@/lib/google-videos-collect'

import { GoogleVideosRunnerUnavailableError } from '@/lib/serverless-runtime'



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



    const status = await getGoogleVideosCollectStatus(supabase)

    if (status.cooldownEnabled && !status.canCollect && status.nextCollectAt) {

      const skipReason = `Google Vídeos em cooldown (${status.cooldownDays} dias). Próxima coleta em ${new Date(status.nextCollectAt).toLocaleString('pt-BR')}.`

      return NextResponse.json({

        ok: true,

        results: [],

        totals: {

          videosFound: 0,

          videosInserted: 0,

          videosUpdated: 0,

          collectSkipped: true,

          skipReason,

          errors: [skipReason],

        },

      })

    }



    const parsed = await collectGoogleVideos({ politicoSlug: body.politicoSlug })

    const results = (parsed.results ?? []).map((r) => ({

      ...r,

      collectSkipped: false,

    }))



    const totals = parsed.totals ?? {

      videosFound: 0,

      videosInserted: 0,

      videosUpdated: 0,

      errors: [],

    }



    return NextResponse.json({

      ok: true,

      results,

      totals: {

        ...totals,

        collectSkipped: false,

        skipReason: null,

      },

    })

  } catch (e) {

    const msg = e instanceof Error ? e.message : 'Erro na coleta Google Vídeos'

    console.error('[google-videos/collect]', e)

    if (e instanceof GoogleVideosRunnerUnavailableError) {

      return NextResponse.json({ error: msg, runnerAvailable: false }, { status: 503 })

    }

    const status = msg.includes('Limite semanal') ? 429 : 500

    return NextResponse.json({ error: msg }, { status })

  }

}

