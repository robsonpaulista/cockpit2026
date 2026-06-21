import { NextResponse } from 'next/server'
import { getMetaAdsCollectStatus } from '@/lib/meta-ads-collect'
import { isMetaAdsDailyLimitEnabled } from '@/lib/meta-ads-types'
import { META_ADS_RUNNER_UNAVAILABLE_MESSAGE, isMetaAdsRunnerAvailable } from '@/lib/serverless-runtime'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const status = await getMetaAdsCollectStatus(supabase)
    const dailyLimitEnabled = isMetaAdsDailyLimitEnabled()

    return NextResponse.json({
      ...status,
      setupRequired: false,
      message: !status.runnerAvailable
        ? (status.runnerMessage ?? META_ADS_RUNNER_UNAVAILABLE_MESSAGE)
        : dailyLimitEnabled
          ? 'A Biblioteca de Anúncios da Meta é consultada via automação (Playwright). Para evitar bloqueios, a coleta completa fica limitada a 1 vez a cada 24 horas.'
          : 'Limite de 24 horas desativado (META_ADS_SKIP_DAILY_LIMIT). Use com moderação para evitar bloqueio pela Meta.',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao consultar status Meta Ads'
    if (msg.includes('does not exist') || msg.includes('42P01')) {
      return NextResponse.json({
        canCollect: false,
        setupRequired: true,
        collectInProgress: false,
        progress: null,
        runnerAvailable: isMetaAdsRunnerAvailable(),
        runnerMessage: isMetaAdsRunnerAvailable() ? null : META_ADS_RUNNER_UNAVAILABLE_MESSAGE,
        message:
          'Execute database/create-meta-ads-radar-tables.sql no Supabase antes da primeira coleta.',
      })
    }
    console.error('[meta-ads/status]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
