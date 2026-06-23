import {
  GOOGLE_TRENDS_RUNNER_UNAVAILABLE_MESSAGE,
  META_ADS_RUNNER_UNAVAILABLE_MESSAGE,
  isGoogleTrendsRunnerAvailable,
  isMetaAdsRunnerAvailable,
  isVercelServerless,
} from '@/lib/serverless-runtime'

export const MONITORAMENTO_PRODUCTION_COLLECT_NOTICE =
  'Neste ambiente (produção), Google Trends e Meta Ads não são atualizados por aqui. Rode a coleta no seu computador — os dados vão para o Supabase e aparecem neste painel para todos. YouTube, Google News e Instagram continuam atualizando normalmente.'

export type MonitoramentoCollectorsStatus = {
  productionMode: boolean
  showProductionNotice: boolean
  notice: string | null
  trends: {
    runnerAvailable: boolean
    message: string | null
    localCommand: string
  }
  metaAds: {
    runnerAvailable: boolean
    message: string | null
    localCommand: string
  }
}

export function getMonitoramentoCollectorsStatus(): MonitoramentoCollectorsStatus {
  const productionMode = isVercelServerless()
  const trendsAvailable = isGoogleTrendsRunnerAvailable()
  const metaAdsAvailable = isMetaAdsRunnerAvailable()
  const showProductionNotice = productionMode && (!trendsAvailable || !metaAdsAvailable)

  return {
    productionMode,
    showProductionNotice,
    notice: showProductionNotice ? MONITORAMENTO_PRODUCTION_COLLECT_NOTICE : null,
    trends: {
      runnerAvailable: trendsAvailable,
      message: trendsAvailable ? null : GOOGLE_TRENDS_RUNNER_UNAVAILABLE_MESSAGE,
      localCommand:
        'node scripts/collect-google-trends.mjs --geo BR-PI --timeframe "today 1-m"  # 30 dias; --with-related para consultas/tópicos',
    },
    metaAds: {
      runnerAvailable: metaAdsAvailable,
      message: metaAdsAvailable ? null : META_ADS_RUNNER_UNAVAILABLE_MESSAGE,
      localCommand: 'node scripts/collect-meta-ads.mjs',
    },
  }
}
