import { execFile } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calcMetaAdsCollectPercent,
  normalizeMetaAdsCollectProgress,
  type MetaAdsCollectProgress,
} from '@/lib/meta-ads-collect-progress'
import {
  isMetaAdsDailyLimitEnabled,
  META_ADS_DAILY_COOLDOWN_MS,
  type MetaAdsCollectScriptResult,
  type MetaAdsCollectStatus,
} from '@/lib/meta-ads-types'
import {
  isMetaAdsRunnerAvailable,
  META_ADS_RUNNER_UNAVAILABLE_MESSAGE,
  MetaAdsRunnerUnavailableError,
} from '@/lib/serverless-runtime'

const execFileAsync = promisify(execFile)

/** Coletas sem finished_at após esse prazo são consideradas travadas. */
const STALE_COLLECT_MS = 16 * 60 * 1000

let collectInProgress = false

function tableMissingMessage(): string {
  return 'Tabela meta_ads_collect_log ausente. Execute database/create-meta-ads-radar-tables.sql no Supabase.'
}

async function closeStaleCollectLogs(
  supabase: SupabaseClient,
  activelyCollecting = collectInProgress
): Promise<number> {
  const staleCutoff = new Date(Date.now() - STALE_COLLECT_MS).toISOString()
  const orphanCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const cutoff = activelyCollecting ? staleCutoff : orphanCutoff

  const { data: stale, error: selectErr } = await supabase
    .from('meta_ads_collect_log')
    .select('id')
    .is('finished_at', null)
    .lt('started_at', cutoff)

  if (selectErr) {
    if (selectErr.message.includes('does not exist') || selectErr.code === '42P01') return 0
    throw new Error(selectErr.message)
  }

  if (!stale?.length) return 0

  const { error: updateErr } = await supabase
    .from('meta_ads_collect_log')
    .update({
      finished_at: new Date().toISOString(),
      success: false,
      error_message: activelyCollecting
        ? 'Coleta interrompida (timeout ou crash do Playwright).'
        : 'Coleta interrompida (servidor reiniciado ou processo encerrado).',
    })
    .is('finished_at', null)
    .lt('started_at', cutoff)

  if (updateErr) throw new Error(updateErr.message)
  return stale.length
}

export async function getMetaAdsCollectStatus(supabase: SupabaseClient): Promise<MetaAdsCollectStatus> {
  await closeStaleCollectLogs(supabase)

  const [{ data, error }, runningRes] = await Promise.all([
    supabase
      .from('meta_ads_collect_log')
      .select('started_at, finished_at, success')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('meta_ads_collect_log')
      .select('started_at, progress')
      .is('finished_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const runningLog = runningRes.error ? null : runningRes.data
  const inProgress = collectInProgress || Boolean(runningLog?.started_at)
  const progress = normalizeMetaAdsCollectProgress(runningLog?.progress)

  const runnerAvailable = isMetaAdsRunnerAvailable()
  const runnerMessage = runnerAvailable ? null : META_ADS_RUNNER_UNAVAILABLE_MESSAGE

  if (error) {
    if (error.message.includes('does not exist') || error.code === '42P01') {
      return {
        canCollect: false,
        dailyLimitEnabled: isMetaAdsDailyLimitEnabled(),
        cooldownHours: META_ADS_DAILY_COOLDOWN_MS / 3_600_000,
        lastCollectStartedAt: null,
        lastCollectFinishedAt: null,
        lastCollectSuccess: null,
        nextCollectAt: null,
        hoursUntilNextCollect: null,
        collectInProgress: inProgress,
        progress,
        runnerAvailable,
        runnerMessage,
      }
    }
    throw new Error(error.message)
  }

  const dailyLimitEnabled = isMetaAdsDailyLimitEnabled()
  const lastStarted = data?.started_at ? new Date(data.started_at).getTime() : 0
  const elapsed = lastStarted > 0 ? Date.now() - lastStarted : META_ADS_DAILY_COOLDOWN_MS
  const withinCooldown =
    dailyLimitEnabled && lastStarted > 0 && elapsed < META_ADS_DAILY_COOLDOWN_MS
  const canCollect = runnerAvailable && !withinCooldown
  const nextCollectAt = withinCooldown
    ? new Date(lastStarted + META_ADS_DAILY_COOLDOWN_MS).toISOString()
    : null
  const msUntil = nextCollectAt ? new Date(nextCollectAt).getTime() - Date.now() : null

  return {
    canCollect: canCollect && !inProgress,
    dailyLimitEnabled,
    cooldownHours: META_ADS_DAILY_COOLDOWN_MS / 3_600_000,
    lastCollectStartedAt: data?.started_at ?? null,
    lastCollectFinishedAt: data?.finished_at ?? null,
    lastCollectSuccess: data?.success ?? null,
    nextCollectAt,
    hoursUntilNextCollect: msUntil !== null ? Math.max(0, Math.ceil(msUntil / 3_600_000)) : null,
    collectInProgress: inProgress,
    progress,
    runnerAvailable,
    runnerMessage,
  }
}

async function assertDailyCollectAllowed(supabase: SupabaseClient): Promise<void> {
  await closeStaleCollectLogs(supabase)

  if (!isMetaAdsRunnerAvailable()) {
    throw new MetaAdsRunnerUnavailableError()
  }

  if (collectInProgress) {
    throw new Error('Coleta Meta Ads já em andamento. Aguarde a conclusão.')
  }

  const status = await getMetaAdsCollectStatus(supabase)
  if (status.collectInProgress) {
    throw new Error('Coleta Meta Ads já em andamento. Aguarde a conclusão.')
  }
  if (status.dailyLimitEnabled && !status.canCollect && status.nextCollectAt) {
    const when = new Date(status.nextCollectAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    throw new Error(
      `Limite diário: a Biblioteca de Anúncios da Meta só pode ser consultada 1 vez a cada 24 horas. Próxima coleta disponível em ${when}.`
    )
  }
}

export async function collectMetaAds(options?: {
  politicoSlug?: string
}): Promise<MetaAdsCollectScriptResult> {
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.')
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })
  await closeStaleCollectLogs(admin)
  await assertDailyCollectAllowed(admin)
  collectInProgress = true

  const { data: logRow, error: logErr } = await admin
    .from('meta_ads_collect_log')
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
  const progressStartedAt = new Date().toISOString()
  const initialProgress: MetaAdsCollectProgress = {
    phase: 'starting',
    message: 'Preparando coleta de anúncios…',
    percent: 0,
    startedAt: progressStartedAt,
    updatedAt: progressStartedAt,
  }
  await admin
    .from('meta_ads_collect_log')
    .update({ progress: initialProgress })
    .eq('id', logId)

  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'collect-meta-ads.mjs')
    const args = [scriptPath]
    if (options?.politicoSlug) args.push('--slug', options.politicoSlug)

    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      cwd: process.cwd(),
      timeout: 900_000,
      maxBuffer: 8 * 1024 * 1024,
      env: {
        ...process.env,
        META_ADS_COLLECT_LOG_ID: logId,
      },
    })

    if (stderr.trim()) {
      console.error('[meta-ads/collect:script]', stderr.trim())
    }

    const lines = stdout.trim().split('\n').filter(Boolean)
    const lastLine = lines.at(-1)
    if (!lastLine) {
      const hint = stderr.trim().slice(-500)
      throw new Error(
        hint
          ? `Coleta expirou ou falhou antes de concluir. Último log: ${hint}`
          : 'Coleta Meta Ads sem resposta do script Node (timeout ou crash do Playwright).'
      )
    }

    const parsed = JSON.parse(lastLine) as MetaAdsCollectScriptResult
    if (!parsed.ok) {
      throw new Error(parsed.error ?? 'Falha na coleta Meta Ads.')
    }

    const totals = parsed.totals ?? {
      adsFound: 0,
      adsInserted: 0,
      adsUpdated: 0,
      errors: [],
    }

    await admin
      .from('meta_ads_collect_log')
      .update({
        finished_at: new Date().toISOString(),
        success: true,
        actors_count: parsed.results?.length ?? 0,
        ads_found: totals.adsFound,
        ads_inserted: totals.adsInserted,
        ads_updated: totals.adsUpdated,
        error_message: totals.errors.length ? totals.errors.join(' · ') : null,
        progress: {
          phase: 'done',
          message: `Coleta concluída — ${totals.adsFound} anúncios · ${totals.adsInserted} novos · ${totals.adsUpdated} atualizados`,
          percent: 100,
          startedAt: progressStartedAt,
          updatedAt: new Date().toISOString(),
        } satisfies MetaAdsCollectProgress,
      })
      .eq('id', logId)

    return parsed
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na coleta Meta Ads'
    await admin
      .from('meta_ads_collect_log')
      .update({
        finished_at: new Date().toISOString(),
        success: false,
        error_message: msg,
        progress: {
          phase: 'error',
          message: msg,
          percent: calcMetaAdsCollectPercent({ phase: 'error' }),
          startedAt: progressStartedAt,
          updatedAt: new Date().toISOString(),
        } satisfies MetaAdsCollectProgress,
      })
      .eq('id', logId)
    throw e
  } finally {
    collectInProgress = false
  }
}
