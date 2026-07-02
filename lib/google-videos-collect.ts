import { execFile } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getGoogleVideosCooldownMs,
  getGoogleVideosMaxItems,
  isGoogleVideosCooldownEnabled,
} from '@/lib/google-videos-config'
import { GOOGLE_VIDEOS_CAUSA_ANIMAL_QUERIES } from '@/lib/google-news-search-term'
import type { GoogleVideosCollectResult } from '@/lib/google-news-types'
import {
  GOOGLE_VIDEOS_RUNNER_UNAVAILABLE_MESSAGE,
  GoogleVideosRunnerUnavailableError,
  isGoogleVideosRunnerAvailable,
} from '@/lib/serverless-runtime'

const execFileAsync = promisify(execFile)
const STALE_COLLECT_MS = 20 * 60 * 1000

let collectInProgress = false

export type GoogleVideosCollectScriptResult = {
  ok: boolean
  error?: string
  results?: GoogleVideosCollectResult[]
  totals?: {
    videosFound: number
    videosInserted: number
    videosUpdated: number
    errors: string[]
  }
}

export type GoogleVideosCollectStatus = {
  canCollect: boolean
  cooldownEnabled: boolean
  cooldownDays: number
  lastCollectStartedAt: string | null
  lastCollectFinishedAt: string | null
  lastCollectSuccess: boolean | null
  nextCollectAt: string | null
  hoursUntilNextCollect: number | null
  collectInProgress: boolean
  runnerAvailable: boolean
  runnerMessage: string | null
  limits: {
    maxItemsPerTerm: number
    pilotTermsCount: number
  }
}

function tableMissingMessage(): string {
  return 'Tabela google_videos_collect_log ausente. Execute database/create-google-videos-collect-log.sql no Supabase.'
}

function defaultLimits() {
  return {
    maxItemsPerTerm: getGoogleVideosMaxItems(),
    pilotTermsCount: GOOGLE_VIDEOS_CAUSA_ANIMAL_QUERIES.length,
  }
}

export async function closeStaleGoogleVideosCollectLogs(
  supabase: SupabaseClient,
  activelyCollecting = collectInProgress
): Promise<number> {
  const staleCutoff = new Date(Date.now() - STALE_COLLECT_MS).toISOString()
  const orphanCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const cutoff = activelyCollecting ? staleCutoff : orphanCutoff

  const { data: stale, error: selectErr } = await supabase
    .from('google_videos_collect_log')
    .select('id')
    .is('finished_at', null)
    .lt('started_at', cutoff)

  if (selectErr) {
    if (selectErr.message.includes('does not exist') || selectErr.code === '42P01') return 0
    throw new Error(selectErr.message)
  }

  if (!stale?.length) return 0

  const { error: updateErr } = await supabase
    .from('google_videos_collect_log')
    .update({
      finished_at: new Date().toISOString(),
      success: false,
      error_message: activelyCollecting
        ? 'Coleta interrompida (timeout ou crash do Playwright).'
        : 'Coleta interrompida (servidor reiniciado).',
    })
    .is('finished_at', null)
    .lt('started_at', cutoff)

  if (updateErr) throw new Error(updateErr.message)
  return stale.length
}

export async function getGoogleVideosCollectStatus(
  supabase: SupabaseClient
): Promise<GoogleVideosCollectStatus> {
  await closeStaleGoogleVideosCollectLogs(supabase)

  const cooldownEnabled = isGoogleVideosCooldownEnabled()
  const cooldownMs = getGoogleVideosCooldownMs()
  const limits = defaultLimits()
  const runnerAvailable = isGoogleVideosRunnerAvailable()
  const runnerMessage = runnerAvailable ? null : GOOGLE_VIDEOS_RUNNER_UNAVAILABLE_MESSAGE

  const [{ data, error }, runningRes] = await Promise.all([
    supabase
      .from('google_videos_collect_log')
      .select('started_at, finished_at, success')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('google_videos_collect_log')
      .select('started_at')
      .is('finished_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const inProgress = collectInProgress || Boolean(runningRes.data?.started_at)

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      return {
        canCollect: false,
        cooldownEnabled,
        cooldownDays: cooldownMs / (24 * 3_600_000),
        lastCollectStartedAt: null,
        lastCollectFinishedAt: null,
        lastCollectSuccess: null,
        nextCollectAt: null,
        hoursUntilNextCollect: null,
        collectInProgress: inProgress,
        runnerAvailable,
        runnerMessage,
        limits,
      }
    }
    throw new Error(error.message)
  }

  const lastStarted = data?.started_at ? new Date(data.started_at).getTime() : 0
  const elapsed = lastStarted > 0 ? Date.now() - lastStarted : cooldownMs
  const withinCooldown = cooldownEnabled && lastStarted > 0 && elapsed < cooldownMs
  const canCollect = runnerAvailable && !withinCooldown && !inProgress
  const nextCollectAt = withinCooldown ? new Date(lastStarted + cooldownMs).toISOString() : null
  const msUntil = nextCollectAt ? new Date(nextCollectAt).getTime() - Date.now() : null

  return {
    canCollect,
    cooldownEnabled,
    cooldownDays: cooldownMs / (24 * 3_600_000),
    lastCollectStartedAt: data?.started_at ?? null,
    lastCollectFinishedAt: data?.finished_at ?? null,
    lastCollectSuccess: data?.success ?? null,
    nextCollectAt,
    hoursUntilNextCollect: msUntil !== null ? Math.max(0, Math.ceil(msUntil / 3_600_000)) : null,
    collectInProgress: inProgress,
    runnerAvailable,
    runnerMessage,
    limits,
  }
}

async function assertCollectAllowed(supabase: SupabaseClient): Promise<void> {
  await closeStaleGoogleVideosCollectLogs(supabase)

  if (!isGoogleVideosRunnerAvailable()) {
    throw new GoogleVideosRunnerUnavailableError()
  }

  if (collectInProgress) {
    throw new Error('Coleta Google Vídeos já em andamento.')
  }

  const status = await getGoogleVideosCollectStatus(supabase)
  if (status.collectInProgress) {
    throw new Error('Coleta Google Vídeos já em andamento.')
  }
  if (status.cooldownEnabled && !status.canCollect && status.nextCollectAt) {
    const when = new Date(status.nextCollectAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    throw new Error(
      `Limite semanal: Google Vídeos disponível 1 vez a cada ${status.cooldownDays} dias. Próxima em ${when}.`
    )
  }
}

export async function collectGoogleVideos(options?: {
  politicoSlug?: string
}): Promise<GoogleVideosCollectScriptResult> {
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.')
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })
  await closeStaleGoogleVideosCollectLogs(admin)
  await assertCollectAllowed(admin)
  collectInProgress = true

  const { data: logRow, error: logErr } = await admin
    .from('google_videos_collect_log')
    .insert({ started_at: new Date().toISOString() })
    .select('id')
    .single()

  if (logErr) {
    collectInProgress = false
    if (logErr.message.includes('does not exist') || logErr.code === '42P01') {
      throw new Error(tableMissingMessage())
    }
    throw new Error(logErr.message)
  }

  const logId = logRow.id as string

  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'collect-google-videos.mjs')
    const args = [scriptPath]
    if (options?.politicoSlug) args.push('--slug', options.politicoSlug)

    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      cwd: process.cwd(),
      timeout: 300_000,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env },
    })

    if (stderr.trim()) {
      console.error('[google-videos/collect:script]', stderr.trim())
    }

    const lines = stdout.trim().split('\n').filter(Boolean)
    const lastLine = lines.at(-1)
    if (!lastLine) {
      const hint = stderr.trim().slice(-500)
      throw new Error(
        hint
          ? `Coleta expirou ou falhou antes de concluir. Último log: ${hint}`
          : 'Coleta Google Vídeos sem resposta do script (timeout ou crash do Playwright).'
      )
    }

    const parsed = JSON.parse(lastLine) as GoogleVideosCollectScriptResult
    if (!parsed.ok) {
      throw new Error(parsed.error ?? 'Falha na coleta Google Vídeos.')
    }

    const totals = parsed.totals ?? {
      videosFound: 0,
      videosInserted: 0,
      videosUpdated: 0,
      errors: [],
    }

    await admin
      .from('google_videos_collect_log')
      .update({
        finished_at: new Date().toISOString(),
        success: true,
        terms_count: GOOGLE_VIDEOS_CAUSA_ANIMAL_QUERIES.length,
        videos_found: totals.videosFound,
        videos_inserted: totals.videosInserted,
        videos_updated: totals.videosUpdated,
        estimated_cost_usd: 0,
        error_message: totals.errors.length ? totals.errors.join(' · ') : null,
      })
      .eq('id', logId)

    return parsed
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na coleta Google Vídeos'
    try {
      await admin
        .from('google_videos_collect_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: msg,
        })
        .eq('id', logId)
    } catch {
      /* ignore log update failure */
    }
    throw e
  } finally {
    collectInProgress = false
  }
}

export function formatGoogleVideosSkipReason(nextCollectAt: string, cooldownDays: number): string {
  const when = new Date(nextCollectAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `Google Vídeos em cooldown (${cooldownDays} dias). Dados anteriores mantidos. Próxima coleta em ${when}.`
}

export { tableMissingMessage as googleVideosCollectLogTableMissingMessage }
