import { execFile } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import type { GoogleTrendsCollectResult, GoogleTrendsTimeframe } from '@/lib/google-trends-types'
import { normalizeGoogleTrendsTimeframe, DEFAULT_GOOGLE_TRENDS_TIMEFRAME } from '@/lib/google-trends-timeframe'
import { isGoogleTrendsRunnerAvailable, GoogleTrendsRunnerUnavailableError } from '@/lib/serverless-runtime'

const execFileAsync = promisify(execFile)

const COLLECT_COOLDOWN_MS = 3 * 60_000
const COLLECT_STALE_MS = 15 * 60_000

export type GoogleTrendsCollectState = {
  collectInProgress: boolean
  collectStartedAt: number | null
  lastCollectFinishedAt: number
  lastCollectResult: GoogleTrendsCollectResult | null
  lastCollectError: string | null
}

let collectInProgress = false
let collectStartedAt: number | null = null
let lastCollectFinishedAt = 0
let lastCollectResult: GoogleTrendsCollectResult | null = null
let lastCollectError: string | null = null

function releaseStaleCollectLock(): void {
  if (!collectInProgress || collectStartedAt == null) return
  if (Date.now() - collectStartedAt > COLLECT_STALE_MS) {
    collectInProgress = false
    collectStartedAt = null
  }
}

function assertCollectAllowed(): void {
  releaseStaleCollectLock()

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

export function getGoogleTrendsCollectState(): GoogleTrendsCollectState {
  releaseStaleCollectLock()
  return {
    collectInProgress,
    collectStartedAt,
    lastCollectFinishedAt,
    lastCollectResult,
    lastCollectError,
  }
}

async function collectViaScript(
  geo: string,
  timeframe: GoogleTrendsTimeframe,
  skipRelated: boolean
): Promise<GoogleTrendsCollectResult> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'collect-google-trends.mjs')
  const args = [scriptPath, '--geo', geo, '--timeframe', timeframe]
  if (skipRelated) args.push('--skip-related')
  const { stdout, stderr } = await execFileAsync(process.execPath, args, {
    cwd: process.cwd(),
    timeout: 300_000,
    maxBuffer: 8 * 1024 * 1024,
    env: process.env,
  })

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
}

async function runCollect(options: {
  geo: string
  timeframe: GoogleTrendsTimeframe
  skipRelated: boolean
}): Promise<GoogleTrendsCollectResult> {
  const { geo, timeframe, skipRelated } = options

  if (process.env.VERCEL === '1') {
    const { runGoogleTrendsCollect } = await import('@/lib/google-trends-collect-core')
    const result = await runGoogleTrendsCollect({ geo, timeframe, skipRelated })
    if (!result.ok) {
      throw new Error(result.error ?? 'Falha na coleta Google Trends.')
    }
    return result
  }

  return await collectViaScript(geo, timeframe, skipRelated)
}

export type StartGoogleTrendsCollectResult =
  | { status: 'started' }
  | { status: 'already_running' }

export function startGoogleTrendsCollect(options: {
  geo?: string
  timeframe?: GoogleTrendsTimeframe
  skipRelated?: boolean
}): StartGoogleTrendsCollectResult {
  if (!isGoogleTrendsRunnerAvailable()) {
    throw new GoogleTrendsRunnerUnavailableError()
  }

  releaseStaleCollectLock()
  if (collectInProgress) {
    return { status: 'already_running' }
  }

  assertCollectAllowed()

  const geo = options.geo ?? 'BR-PI'
  const skipRelated = options.skipRelated ?? true
  const timeframe = normalizeGoogleTrendsTimeframe(options.timeframe) ?? DEFAULT_GOOGLE_TRENDS_TIMEFRAME

  collectInProgress = true
  collectStartedAt = Date.now()
  lastCollectError = null

  void runCollect({ geo, timeframe, skipRelated })
    .then((result) => {
      lastCollectResult = result
    })
    .catch((e: unknown) => {
      lastCollectError = e instanceof Error ? e.message : 'Falha na coleta Google Trends.'
      lastCollectResult = null
    })
    .finally(() => {
      collectInProgress = false
      collectStartedAt = null
      lastCollectFinishedAt = Date.now()
    })

  return { status: 'started' }
}

export async function collectGoogleTrends(options: {
  geo?: string
  timeframe?: GoogleTrendsTimeframe
  /** Pula related queries/topics — padrão true (coleta rápida ~1 min). */
  skipRelated?: boolean
}): Promise<GoogleTrendsCollectResult> {
  if (!isGoogleTrendsRunnerAvailable()) {
    throw new GoogleTrendsRunnerUnavailableError()
  }

  assertCollectAllowed()
  collectInProgress = true
  collectStartedAt = Date.now()
  lastCollectError = null

  const geo = options.geo ?? 'BR-PI'
  const skipRelated = options.skipRelated ?? true
  const timeframe = normalizeGoogleTrendsTimeframe(options.timeframe) ?? DEFAULT_GOOGLE_TRENDS_TIMEFRAME

  try {
    const result = await runCollect({ geo, timeframe, skipRelated })
    lastCollectResult = result
    return result
  } catch (e) {
    lastCollectError = e instanceof Error ? e.message : 'Falha na coleta Google Trends.'
    throw e
  } finally {
    collectInProgress = false
    collectStartedAt = null
    lastCollectFinishedAt = Date.now()
  }
}

export async function waitForGoogleTrendsCollect(timeoutMs = 180_000): Promise<GoogleTrendsCollectState> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const state = getGoogleTrendsCollectState()
    if (!state.collectInProgress) return state
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  throw new Error('Tempo esgotado aguardando coleta do Google Trends.')
}
