import { execFile } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import type { GoogleTrendsCollectResult, GoogleTrendsTimeframe } from '@/lib/google-trends-types'
import { normalizeGoogleTrendsTimeframe } from '@/lib/google-trends-timeframe'

const execFileAsync = promisify(execFile)

const COLLECT_COOLDOWN_MS = 3 * 60_000

let collectInProgress = false
let lastCollectFinishedAt = 0

function assertCollectAllowed(): void {
  if (collectInProgress) {
    throw new Error('Coleta já em andamento. Aguarde a conclusão antes de tentar de novo.')
  }

  const elapsed = Date.now() - lastCollectFinishedAt
  if (lastCollectFinishedAt > 0 && elapsed < COLLECT_COOLDOWN_MS) {
    const waitSec = Math.ceil((COLLECT_COOLDOWN_MS - elapsed) / 1000)
    throw new Error(
      `Aguarde ${waitSec}s antes de coletar novamente — o Google Trends limita requisições por IP.`
    )
  }
}

export async function collectGoogleTrends(options: {
  geo?: string
  timeframe?: GoogleTrendsTimeframe
}): Promise<GoogleTrendsCollectResult> {
  assertCollectAllowed()
  collectInProgress = true

  const geo = options.geo ?? 'BR-PI'
  const timeframe =
    normalizeGoogleTrendsTimeframe(options.timeframe) ??
    normalizeGoogleTrendsTimeframe('today 3-m')!

  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'collect-google-trends.mjs')
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [scriptPath, '--geo', geo, '--timeframe', timeframe],
      {
        cwd: process.cwd(),
        timeout: 600_000,
        maxBuffer: 8 * 1024 * 1024,
        env: process.env,
      }
    )

    const lines = stdout.trim().split('\n').filter(Boolean)
    const lastLine = lines.at(-1)
    if (!lastLine) {
      throw new Error(stderr.trim() || 'Coleta Trends sem resposta do script Node.')
    }

    const parsed = JSON.parse(lastLine) as GoogleTrendsCollectResult
    if (!parsed.ok) {
      throw new Error(parsed.error ?? 'Falha na coleta Google Trends.')
    }

    return parsed
  } finally {
    collectInProgress = false
    lastCollectFinishedAt = Date.now()
  }
}
