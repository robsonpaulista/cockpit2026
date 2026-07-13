import { execFile } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import type {
  GoogleTrendingHours,
  GoogleTrendingTopicsCollectResult,
} from '@/lib/google-trending-topics-types'
import {
  DEFAULT_GOOGLE_TRENDING_GEO,
  DEFAULT_GOOGLE_TRENDING_HOURS,
  normalizeGoogleTrendingHours,
} from '@/lib/google-trending-topics-types'
import {
  GoogleTrendsRunnerUnavailableError,
  isGoogleTrendsRunnerAvailable,
} from '@/lib/serverless-runtime'

const execFileAsync = promisify(execFile)

const COLLECT_COOLDOWN_MS = 2 * 60_000
const COLLECT_STALE_MS = 5 * 60_000

export type GoogleTrendingTopicsCollectState = {
  collectInProgress: boolean
  collectStartedAt: number | null
  lastCollectFinishedAt: number
  lastCollectResult: GoogleTrendingTopicsCollectResult | null
  lastCollectError: string | null
}

let collectInProgress = false
let collectStartedAt: number | null = null
let lastCollectFinishedAt = 0
let lastCollectResult: GoogleTrendingTopicsCollectResult | null = null
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

export function getGoogleTrendingTopicsCollectState(): GoogleTrendingTopicsCollectState {
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
  hours: GoogleTrendingHours
): Promise<GoogleTrendingTopicsCollectResult> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'collect-google-trending-topics.mjs')
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath, '--geo', geo, '--hours', String(hours)],
    {
      cwd: process.cwd(),
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
      env: process.env,
    }
  )

  const lines = stdout.trim().split('\n').filter(Boolean)
  const lastLine = lines.at(-1)
  if (!lastLine) {
    throw new Error(stderr.trim() || 'Coleta de temas em alta sem resposta do script Node.')
  }

  const parsed = JSON.parse(lastLine) as GoogleTrendingTopicsCollectResult
  if (!parsed.ok) {
    throw new Error(parsed.error ?? 'Falha na coleta de temas em alta.')
  }
  return parsed
}

async function runCollect(options: {
  geo: string
  hours: GoogleTrendingHours
}): Promise<GoogleTrendingTopicsCollectResult> {
  if (process.env.VERCEL === '1') {
    const { runGoogleTrendingTopicsCollect } = await import('@/lib/google-trending-topics-collect-core')
    const result = await runGoogleTrendingTopicsCollect(options)
    if (!result.ok) {
      throw new Error(result.error ?? 'Falha na coleta de temas em alta.')
    }
    return result
  }

  return await collectViaScript(options.geo, options.hours)
}

export type StartGoogleTrendingTopicsCollectResult =
  | { status: 'started' }
  | { status: 'already_running' }

export function startGoogleTrendingTopicsCollect(options?: {
  geo?: string
  hours?: GoogleTrendingHours
}): StartGoogleTrendingTopicsCollectResult {
  if (!isGoogleTrendsRunnerAvailable()) {
    throw new GoogleTrendsRunnerUnavailableError(
      'Coleta de temas em alta indisponível na Vercel. Rode localmente: node scripts/collect-google-trending-topics.mjs'
    )
  }

  releaseStaleCollectLock()
  if (collectInProgress) {
    return { status: 'already_running' }
  }

  assertCollectAllowed()

  const geo = options?.geo?.trim().toUpperCase() || DEFAULT_GOOGLE_TRENDING_GEO
  const hours = normalizeGoogleTrendingHours(options?.hours) ?? DEFAULT_GOOGLE_TRENDING_HOURS

  collectInProgress = true
  collectStartedAt = Date.now()
  lastCollectError = null

  void runCollect({ geo, hours })
    .then((result) => {
      lastCollectResult = result
    })
    .catch((e: unknown) => {
      lastCollectError = e instanceof Error ? e.message : 'Falha na coleta de temas em alta.'
      lastCollectResult = null
    })
    .finally(() => {
      collectInProgress = false
      collectStartedAt = null
      lastCollectFinishedAt = Date.now()
    })

  return { status: 'started' }
}
