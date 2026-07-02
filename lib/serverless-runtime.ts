/** Playwright + Chromium não rodam no runtime serverless da Vercel. */
export function isVercelServerless(): boolean {
  return process.env.VERCEL === '1'
}

export function isMetaAdsRunnerAvailable(): boolean {
  if (process.env.META_ADS_RUNNER_ENABLED === '1') return true
  return !isVercelServerless()
}

/** Coleta Trends é longa (rate limit) e instável no serverless compartilhado da Vercel. */
export function isGoogleTrendsRunnerAvailable(): boolean {
  if (process.env.GOOGLE_TRENDS_RUNNER_ENABLED === '1') return true
  return !isVercelServerless()
}

export function isGoogleVideosRunnerAvailable(): boolean {
  if (process.env.GOOGLE_VIDEOS_RUNNER_ENABLED === '1') return true
  return !isVercelServerless()
}

export const META_ADS_RUNNER_UNAVAILABLE_MESSAGE =
  'Meta Ads requer Playwright + Chromium — indisponível na Vercel. Rode a coleta localmente ou em um cron com npx playwright install chromium.'

export const GOOGLE_TRENDS_RUNNER_UNAVAILABLE_MESSAGE =
  'Coleta Google Trends indisponível na Vercel (processo longo + rate limit do Google). Rode localmente: node scripts/collect-google-trends.mjs'

export const GOOGLE_VIDEOS_RUNNER_UNAVAILABLE_MESSAGE =
  'Google Vídeos requer Playwright + Chromium — indisponível na Vercel. Rode localmente: node scripts/collect-google-videos.mjs'

export class MetaAdsRunnerUnavailableError extends Error {
  readonly skipInBatch = true

  constructor(message = META_ADS_RUNNER_UNAVAILABLE_MESSAGE) {
    super(message)
    this.name = 'MetaAdsRunnerUnavailableError'
  }
}

export class GoogleTrendsRunnerUnavailableError extends Error {
  readonly skipInBatch = true

  constructor(message = GOOGLE_TRENDS_RUNNER_UNAVAILABLE_MESSAGE) {
    super(message)
    this.name = 'GoogleTrendsRunnerUnavailableError'
  }
}

export class GoogleVideosRunnerUnavailableError extends Error {
  readonly skipInBatch = true

  constructor(message = GOOGLE_VIDEOS_RUNNER_UNAVAILABLE_MESSAGE) {
    super(message)
    this.name = 'GoogleVideosRunnerUnavailableError'
  }
}
