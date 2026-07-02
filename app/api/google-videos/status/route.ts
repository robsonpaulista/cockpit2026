import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

import { requireRouteUser } from '@/lib/supabase/route-auth'

import { getGoogleVideosCollectStatus } from '@/lib/google-videos-collect'

import { GOOGLE_VIDEOS_CAUSA_ANIMAL_QUERIES } from '@/lib/google-news-search-term'

import {

  getGoogleVideosCooldownMs,

  getGoogleVideosMaxItems,

  isGoogleVideosCooldownEnabled,

} from '@/lib/google-videos-config'



export const dynamic = 'force-dynamic'



export async function GET() {

  try {

    const auth = await requireRouteUser()

    if (!auth.ok) return auth.response



    const supabase = createClient()

    const status = await getGoogleVideosCollectStatus(supabase)

    const videoPilotTerms = [...GOOGLE_VIDEOS_CAUSA_ANIMAL_QUERIES]

    const maxItems = getGoogleVideosMaxItems()

    const cooldownDays = getGoogleVideosCooldownMs() / (24 * 3_600_000)



    let message = ''

    if (!status.runnerAvailable) {

      message = status.runnerMessage ?? 'Playwright indisponível neste ambiente.'

    } else if (status.canCollect) {
      message = status.cooldownEnabled
        ? `Coleta liberada · Playwright · cooldown ${status.cooldownDays} dias.`
        : 'Coleta liberada · Playwright · sem cooldown.'

    } else if (status.cooldownEnabled && status.nextCollectAt) {

      message = `Em cooldown. Próxima coleta em ${new Date(status.nextCollectAt).toLocaleString('pt-BR')}.`

    } else if (status.collectInProgress) {

      message = 'Coleta em andamento…'

    }



    return NextResponse.json({

      ...status,

      setupRequired: false,

      message,

      pilot: {

        scope: 'castração / causa animal',

        terms: videoPilotTerms,

        maxItemsPerTerm: maxItems,

        provider: 'playwright',

      },

      cooldown: {
        enabled: isGoogleVideosCooldownEnabled(),
        days: cooldownDays,
        enableEnv: 'GOOGLE_VIDEOS_COOLDOWN_DAYS=7',
      },

    })

  } catch (e) {

    const msg = e instanceof Error ? e.message : 'Erro ao carregar status'

    if (msg.includes('does not exist') || msg.includes('42P01')) {

      return NextResponse.json({

        setupRequired: true,

        canCollect: false,

        runnerAvailable: false,

        message: 'Execute database/create-google-videos-collect-log.sql no Supabase.',

      })

    }

    return NextResponse.json({ error: msg }, { status: 500 })

  }

}

