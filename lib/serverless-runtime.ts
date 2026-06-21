/** Playwright + Chromium não rodam no runtime serverless da Vercel. */
export function isVercelServerless(): boolean {
  return process.env.VERCEL === '1'
}

export function isMetaAdsRunnerAvailable(): boolean {
  if (process.env.META_ADS_RUNNER_ENABLED === '1') return true
  return !isVercelServerless()
}

export const META_ADS_RUNNER_UNAVAILABLE_MESSAGE =
  'Meta Ads requer Playwright + Chromium — indisponível na Vercel. Rode a coleta localmente ou em um cron com npx playwright install chromium.'

export class MetaAdsRunnerUnavailableError extends Error {
  readonly skipInBatch = true

  constructor(message = META_ADS_RUNNER_UNAVAILABLE_MESSAGE) {
    super(message)
    this.name = 'MetaAdsRunnerUnavailableError'
  }
}
