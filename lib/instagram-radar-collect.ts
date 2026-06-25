import { execFile } from 'child_process'
import path from 'path'
import { promisify } from 'util'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getInstagramRadarBudgetSummary } from '@/lib/instagram-radar-aggregate'
import {
  isInstagramRadarCooldownEnabled,
  INSTAGRAM_RADAR_COOLDOWN_MS,
} from '@/lib/instagram-radar-config'
import { getOwnInstagramRadarReady, isApifyConfigured } from '@/lib/instagram-radar-ready-check'
import {
  shouldSyncOwnCandidate,
  syncOwnCandidateInstagramRadar,
} from '@/lib/instagram-radar-own-sync'
import type {
  InstagramRadarCollectScriptResult,
  InstagramRadarCollectStatus,
} from '@/lib/instagram-radar-types'

const execFileAsync = promisify(execFile)

const STALE_COLLECT_MS = 20 * 60 * 1000

let collectInProgress = false

function tableMissingMessage(): string {
  return 'Tabelas instagram_radar ausentes. Execute database/create-instagram-radar-tables.sql no Supabase.'
}

function emptyScriptResult(): InstagramRadarCollectScriptResult {
  return {
    results: [],
    totals: {
      actorsProcessed: 0,
      postsFound: 0,
      postsInserted: 0,
      postsUpdated: 0,
      estimatedCostUsd: 0,
      apifyRunId: null,
      ownCandidateSynced: 0,
      errors: [],
    },
  }
}

function mergeCollectResults(
  ownResults: Awaited<ReturnType<typeof syncOwnCandidateInstagramRadar>>,
  apify: InstagramRadarCollectScriptResult
): InstagramRadarCollectScriptResult {
  const ownMapped = ownResults.map((r) => ({
    slug: r.slug,
    username: r.username,
    postsFound: r.postsFound,
    postsInserted: r.postsInserted,
    postsUpdated: r.postsUpdated,
    source: r.source as 'graph_api' | 'metrics_history',
    error: r.error,
  }))

  const ownTotals = ownResults.reduce(
    (acc, r) => ({
      postsFound: acc.postsFound + r.postsFound,
      postsInserted: acc.postsInserted + r.postsInserted,
      postsUpdated: acc.postsUpdated + r.postsUpdated,
    }),
    { postsFound: 0, postsInserted: 0, postsUpdated: 0 }
  )

  const ownErrors = ownResults.map((r) => r.error).filter(Boolean) as string[]

  return {
    results: [...ownMapped, ...apify.results],
    totals: {
      actorsProcessed: ownResults.length + apify.totals.actorsProcessed,
      postsFound: ownTotals.postsFound + apify.totals.postsFound,
      postsInserted: ownTotals.postsInserted + apify.totals.postsInserted,
      postsUpdated: ownTotals.postsUpdated + apify.totals.postsUpdated,
      estimatedCostUsd: apify.totals.estimatedCostUsd,
      apifyRunId: apify.totals.apifyRunId,
      ownCandidateSynced: ownResults.length,
      errors: [...ownErrors, ...apify.totals.errors],
    },
  }
}

async function closeStaleCollectLogs(
  supabase: SupabaseClient,
  activelyCollecting = collectInProgress
): Promise<number> {
  const staleCutoff = new Date(Date.now() - STALE_COLLECT_MS).toISOString()
  const orphanCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const cutoff = activelyCollecting ? staleCutoff : orphanCutoff

  const { data: stale, error: selectErr } = await supabase
    .from('instagram_radar_collect_log')
    .select('id')
    .is('finished_at', null)
    .lt('started_at', cutoff)

  if (selectErr) {
    if (selectErr.message.includes('does not exist') || selectErr.code === '42P01') return 0
    throw new Error(selectErr.message)
  }

  if (!stale?.length) return 0

  const { error: updateErr } = await supabase
    .from('instagram_radar_collect_log')
    .update({
      finished_at: new Date().toISOString(),
      success: false,
      error_message: activelyCollecting
        ? 'Coleta interrompida (timeout).'
        : 'Coleta interrompida (servidor reiniciado).',
    })
    .is('finished_at', null)
    .lt('started_at', cutoff)

  if (updateErr) throw new Error(updateErr.message)
  return stale.length
}

async function hasApifyTargets(
  supabase: SupabaseClient,
  politicoSlug?: string
): Promise<boolean> {
  let query = supabase
    .from('political_actors')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)
    .neq('actor_type', 'own_candidate')
    .not('instagram_username', 'is', null)

  if (politicoSlug) query = query.eq('slug', politicoSlug)

  const { count, error } = await query
  if (error) {
    if (error.message.includes('instagram_username') || error.code === '42703') return false
    throw new Error(error.message)
  }
  return (count ?? 0) > 0
}

export async function getInstagramRadarCollectStatus(
  supabase: SupabaseClient
): Promise<InstagramRadarCollectStatus> {
  await closeStaleCollectLogs(supabase)

  const budget = getInstagramRadarBudgetSummary()
  const apifyConfigured = isApifyConfigured()
  const ownReady = await getOwnInstagramRadarReady(supabase)
  const cooldownEnabled = isInstagramRadarCooldownEnabled()

  const [{ data, error }, runningRes] = await Promise.all([
    supabase
      .from('instagram_radar_collect_log')
      .select('started_at, finished_at, success')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('instagram_radar_collect_log')
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
        cooldownDays: INSTAGRAM_RADAR_COOLDOWN_MS / (24 * 3_600_000),
        lastCollectStartedAt: null,
        lastCollectFinishedAt: null,
        lastCollectSuccess: null,
        nextCollectAt: null,
        hoursUntilNextCollect: null,
        collectInProgress: inProgress,
        apifyConfigured,
        ownAccountConfigured: ownReady.ready,
        ownInstagramSource: ownReady.source,
        ownInstagramPostsInHistory: ownReady.postsInHistory,
        limits: {
          maxActors: budget.maxActors,
          postsPerProfile: budget.postsPerProfile,
          maxChargeUsd: budget.maxChargeUsd,
          estimatedCostPerRunUsd: budget.estimatedCostPerRunUsd,
          freeMonthlyUsd: budget.freeMonthlyUsd,
        },
      }
    }
    throw new Error(error.message)
  }

  const lastStarted = data?.started_at ? new Date(data.started_at).getTime() : 0
  const elapsed = lastStarted > 0 ? Date.now() - lastStarted : INSTAGRAM_RADAR_COOLDOWN_MS
  const withinCooldown =
    cooldownEnabled && lastStarted > 0 && elapsed < INSTAGRAM_RADAR_COOLDOWN_MS
  const canCollect =
    (apifyConfigured || ownReady.ready) && !withinCooldown && !inProgress
  const nextCollectAt = withinCooldown
    ? new Date(lastStarted + INSTAGRAM_RADAR_COOLDOWN_MS).toISOString()
    : null
  const msUntil = nextCollectAt ? new Date(nextCollectAt).getTime() - Date.now() : null

  return {
    canCollect,
    cooldownEnabled,
    cooldownDays: INSTAGRAM_RADAR_COOLDOWN_MS / (24 * 3_600_000),
    lastCollectStartedAt: data?.started_at ?? null,
    lastCollectFinishedAt: data?.finished_at ?? null,
    lastCollectSuccess: data?.success ?? null,
    nextCollectAt,
    hoursUntilNextCollect: msUntil !== null ? Math.max(0, Math.ceil(msUntil / 3_600_000)) : null,
    collectInProgress: inProgress,
    apifyConfigured,
    ownAccountConfigured: ownReady.ready,
    ownInstagramSource: ownReady.source,
    ownInstagramPostsInHistory: ownReady.postsInHistory,
    limits: {
      maxActors: budget.maxActors,
      postsPerProfile: budget.postsPerProfile,
      maxChargeUsd: budget.maxChargeUsd,
      estimatedCostPerRunUsd: budget.estimatedCostPerRunUsd,
      freeMonthlyUsd: budget.freeMonthlyUsd,
    },
  }
}

async function assertCollectAllowed(
  supabase: SupabaseClient,
  options?: { politicoSlug?: string }
): Promise<void> {
  await closeStaleCollectLogs(supabase)

  const apifyConfigured = isApifyConfigured()
  const ownReady = await getOwnInstagramRadarReady(supabase)
  const needsApify = await hasApifyTargets(supabase, options?.politicoSlug)
  const needsOwn = shouldSyncOwnCandidate(options)

  if (needsApify && !apifyConfigured && !(needsOwn && ownReady.ready)) {
    throw new Error('Coleta de concorrentes não configurada e dados do candidato próprio indisponíveis.')
  }
  if (needsOwn && options?.politicoSlug && !ownReady.ready && !needsApify) {
    throw new Error(
      'Dados do Jadyel indisponíveis. Abra Redes & Instagram e atualize, ou conecte o Instagram no navegador.'
    )
  }
  if (!needsApify && !(needsOwn && ownReady.ready)) {
    throw new Error(
      'Nenhum candidato elegível: cadastre @ de concorrentes ou atualize Redes & Instagram.'
    )
  }

  if (collectInProgress) {
    throw new Error('Coleta Instagram já em andamento.')
  }

  const status = await getInstagramRadarCollectStatus(supabase)
  if (status.collectInProgress) {
    throw new Error('Coleta Instagram já em andamento.')
  }
  if (status.cooldownEnabled && !status.canCollect && status.nextCollectAt) {
    const when = new Date(status.nextCollectAt).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    throw new Error(
      `Limite semanal: coleta Instagram disponível 1 vez a cada ${status.cooldownDays} dias. Próxima em ${when}.`
    )
  }
}

export async function collectInstagramRadar(options?: {
  politicoSlug?: string
  instagramToken?: string
  instagramBusinessAccountId?: string
}): Promise<InstagramRadarCollectScriptResult> {
  const { createClient } = await import('@supabase/supabase-js')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.')
  }

  const admin = createClient(url, key, { auth: { persistSession: false } })
  await closeStaleCollectLogs(admin)
  await assertCollectAllowed(admin, options)
  collectInProgress = true

  const { data: logRow, error: logErr } = await admin
    .from('instagram_radar_collect_log')
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
    let ownResults: Awaited<ReturnType<typeof syncOwnCandidateInstagramRadar>> = []
    if (shouldSyncOwnCandidate(options)) {
      ownResults = await syncOwnCandidateInstagramRadar(admin, {
        politicoSlug: options?.politicoSlug,
        instagramToken: options?.instagramToken,
        instagramBusinessAccountId: options?.instagramBusinessAccountId,
      })
    }

    const runApify = isApifyConfigured() && (await hasApifyTargets(admin, options?.politicoSlug))

    let apifyResult = emptyScriptResult()

    if (runApify) {
      const scriptPath = path.join(process.cwd(), 'scripts', 'collect-instagram-radar.mjs')
      const args = [scriptPath]
      if (options?.politicoSlug) args.push('--slug', options.politicoSlug)

      const { stdout, stderr } = await execFileAsync(process.execPath, args, {
        cwd: process.cwd(),
        timeout: 900_000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env },
      })

      if (stderr.trim()) {
        console.error('[instagram-radar/collect:script]', stderr.trim())
      }

      const lines = stdout.trim().split('\n').filter(Boolean)
      const lastLine = lines.at(-1)
      if (lastLine) {
        apifyResult = JSON.parse(lastLine) as InstagramRadarCollectScriptResult
      }
    }

    const parsed = mergeCollectResults(ownResults, apifyResult)

    await admin
      .from('instagram_radar_collect_log')
      .update({
        finished_at: new Date().toISOString(),
        success: true,
        actors_count: parsed.totals.actorsProcessed,
        posts_found: parsed.totals.postsFound,
        posts_inserted: parsed.totals.postsInserted,
        posts_updated: parsed.totals.postsUpdated,
        apify_run_id: parsed.totals.apifyRunId,
        estimated_cost_usd: parsed.totals.estimatedCostUsd,
        error_message: parsed.totals.errors.length ? parsed.totals.errors.join(' · ') : null,
      })
      .eq('id', logId)

    return parsed
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro na coleta Instagram'
    await admin
      .from('instagram_radar_collect_log')
      .update({
        finished_at: new Date().toISOString(),
        success: false,
        error_message: msg,
      })
      .eq('id', logId)
    throw e instanceof Error ? e : new Error(msg)
  } finally {
    collectInProgress = false
  }
}
