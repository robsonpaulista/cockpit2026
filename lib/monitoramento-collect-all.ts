import type { GoogleTrendsTimeframe } from '@/lib/google-trends-types'
import type { MetaAdsCollectProgress } from '@/lib/meta-ads-collect-progress'
import { normalizeMetaAdsCollectProgress } from '@/lib/meta-ads-collect-progress'
import type { MetaAdsCollectStatus } from '@/lib/meta-ads-types'

export type MonitoramentoCollectStepId = 'youtube' | 'google-news' | 'meta-ads' | 'trends'

export type MonitoramentoCollectStepStatus = 'pending' | 'running' | 'success' | 'skipped' | 'error'

export type MonitoramentoCollectStep = {
  id: MonitoramentoCollectStepId
  label: string
  status: MonitoramentoCollectStepStatus
  message: string
}

export type MonitoramentoCollectAllProgress = {
  running: boolean
  currentStepId: MonitoramentoCollectStepId | null
  stepIndex: number
  totalSteps: number
  steps: MonitoramentoCollectStep[]
}

export const MONITORAMENTO_COLLECT_STEPS: ReadonlyArray<{
  id: MonitoramentoCollectStepId
  label: string
}> = [
  { id: 'youtube', label: 'YouTube' },
  { id: 'google-news', label: 'Google News' },
  { id: 'trends', label: 'Google Trends' },
  { id: 'meta-ads', label: 'Meta Ads' },
]

const PANORAMA_YOUTUBE_LOOKBACK_DAYS = 7 as const
const PANORAMA_TRENDS_GEO = 'BR-PI'
const PANORAMA_TRENDS_TIMEFRAME: GoogleTrendsTimeframe = 'today 3-m'

function initialSteps(): MonitoramentoCollectStep[] {
  return MONITORAMENTO_COLLECT_STEPS.map((step) => ({
    id: step.id,
    label: step.label,
    status: 'pending',
    message: '',
  }))
}

function buildProgress(
  steps: MonitoramentoCollectStep[],
  currentStepId: MonitoramentoCollectStepId | null,
  running: boolean
): MonitoramentoCollectAllProgress {
  const totalSteps = steps.length
  let stepIndex = totalSteps

  if (currentStepId) {
    stepIndex = steps.findIndex((s) => s.id === currentStepId) + 1
  } else if (running) {
    const nextPending = steps.findIndex((s) => s.status === 'pending')
    stepIndex = nextPending >= 0 ? nextPending + 1 : totalSteps
  }

  return {
    running,
    currentStepId,
    stepIndex,
    totalSteps,
    steps,
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

async function collectYoutubeStep(): Promise<string> {
  const actorsRes = await fetch('/api/youtube/actors', { cache: 'no-store' })
  const actorsJson = await parseJson<{ configured?: boolean; setupRequired?: boolean; error?: string }>(
    actorsRes
  )

  if (!actorsRes.ok) {
    throw new Error(actorsJson.error ?? 'Falha ao verificar YouTube.')
  }
  if (actorsJson.setupRequired) {
    return 'Tabelas não configuradas — etapa ignorada.'
  }
  if (actorsJson.configured === false) {
    return 'YOUTUBE_DATA_API_KEY não configurada — etapa ignorada.'
  }

  const res = await fetch('/api/youtube/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lookbackDays: PANORAMA_YOUTUBE_LOOKBACK_DAYS }),
  })
  const j = await parseJson<{
    error?: string
    totals?: { videosFound: number; videosInserted: number; videosUpdated: number }
  }>(res)

  if (!res.ok) throw new Error(j.error ?? 'Falha na coleta YouTube.')

  const t = j.totals
  return t
    ? `${t.videosFound} vídeos · ${t.videosInserted} novos · ${t.videosUpdated} atualizados`
    : 'Coleta concluída.'
}

async function collectGoogleNewsStep(): Promise<string> {
  const res = await fetch('/api/google-news/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const j = await parseJson<{
    error?: string
    setupRequired?: boolean
    totals?: { articlesFound: number; articlesInserted: number; articlesUpdated: number }
  }>(res)

  if (j.setupRequired) {
    return 'Tabelas não configuradas — etapa ignorada.'
  }
  if (!res.ok) throw new Error(j.error ?? 'Falha na coleta Google News.')

  const t = j.totals
  return t
    ? `${t.articlesFound} notícias · ${t.articlesInserted} novas · ${t.articlesUpdated} atualizadas`
    : 'Coleta concluída.'
}

async function collectTrendsStep(): Promise<string> {
  const res = await fetch('/api/trends/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ geo: PANORAMA_TRENDS_GEO, timeframe: PANORAMA_TRENDS_TIMEFRAME }),
  })
  const j = await parseJson<{
    error?: string
    setupRequired?: boolean
    terms?: number
    termsSucceeded?: number
    rowsUpserted?: number
    errors?: string[]
  }>(res)

  if (j.setupRequired) {
    return 'Tabelas não configuradas — etapa ignorada.'
  }
  if (!res.ok) throw new Error(j.error ?? 'Falha na coleta Trends.')

  const ok = j.termsSucceeded ?? 0
  const total = j.terms ?? 0
  const base = `${ok}/${total} nomes · ${j.rowsUpserted ?? 0} pontos salvos`
  if (ok < total && j.errors?.length) {
    return `${base} (parcial: ${j.errors.slice(0, 2).join('; ')})`
  }
  return base
}

async function collectMetaAdsStep(
  onMetaAdsProgress?: (progress: MetaAdsCollectProgress | null) => void
): Promise<{ message: string; skipped: boolean }> {
  const statusRes = await fetch('/api/meta-ads/status', { cache: 'no-store' })
  const status = await parseJson<MetaAdsCollectStatus & { setupRequired?: boolean; error?: string }>(
    statusRes
  )

    if (status.setupRequired) {
    return { skipped: true, message: 'Tabelas não configuradas — etapa ignorada.' }
  }
  if (status.runnerAvailable === false) {
    return {
      skipped: true,
      message: status.runnerMessage ?? 'Meta Ads indisponível neste servidor — etapa ignorada.',
    }
  }
  if (status.collectInProgress) {
    return { skipped: true, message: 'Coleta Meta Ads já em andamento no servidor — etapa ignorada.' }
  }
  if (status.dailyLimitEnabled !== false && !status.canCollect) {
    const when = status.nextCollectAt
      ? new Date(status.nextCollectAt).toLocaleString('pt-BR', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'em breve'
    return { skipped: true, message: `Limite diário — próxima coleta disponível ${when}.` }
  }

  onMetaAdsProgress?.(
    normalizeMetaAdsCollectProgress(status.progress) ?? {
      phase: 'starting',
      message: 'Iniciando coleta Meta Ads…',
      percent: 0,
    }
  )

  const pollId = window.setInterval(() => {
    void (async () => {
      try {
        const res = await fetch('/api/meta-ads/status', { cache: 'no-store' })
        const j = (await res.json()) as MetaAdsCollectStatus & { progress?: unknown }
        if (res.ok) {
          onMetaAdsProgress?.(normalizeMetaAdsCollectProgress(j.progress))
        }
      } catch {
        /* ignore poll errors */
      }
    })()
  }, 2000)

  try {
    const res = await fetch('/api/meta-ads/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const j = await parseJson<{
      error?: string
      totals?: { adsFound: number; adsInserted: number; adsUpdated: number; errors?: string[] }
    }>(res)

    if (res.status === 429) {
      return { skipped: true, message: j.error ?? 'Limite diário de coleta Meta Ads.' }
    }
    if (res.status === 503) {
      return {
        skipped: true,
        message: j.error ?? 'Meta Ads indisponível neste servidor — etapa ignorada.',
      }
    }
    if (!res.ok) throw new Error(j.error ?? 'Falha na coleta Meta Ads.')

    const t = j.totals
    const warnings = (t?.errors ?? []).filter(Boolean)
    const base = t
      ? `${t.adsFound} anúncios · ${t.adsInserted} novos · ${t.adsUpdated} atualizados`
      : 'Coleta concluída.'
    return {
      skipped: false,
      message: warnings.length ? `${base} (${warnings.length} aviso(s))` : base,
    }
  } finally {
    window.clearInterval(pollId)
    onMetaAdsProgress?.(null)
  }
}

async function runStep(
  id: MonitoramentoCollectStepId,
  onMetaAdsProgress?: (progress: MetaAdsCollectProgress | null) => void
): Promise<{ message: string; skipped: boolean }> {
  switch (id) {
    case 'youtube':
      return { message: await collectYoutubeStep(), skipped: false }
    case 'google-news':
      return { message: await collectGoogleNewsStep(), skipped: false }
    case 'trends':
      return { message: await collectTrendsStep(), skipped: false }
    case 'meta-ads':
      return collectMetaAdsStep(onMetaAdsProgress)
  }
}

function isSkippedMessage(message: string): boolean {
  return (
    message.includes('ignorada') ||
    message.includes('Limite diário') ||
    message.includes('indisponível neste servidor') ||
    message.includes('indisponível na Vercel')
  )
}

export async function runMonitoramentoCollectAll(
  onProgress: (progress: MonitoramentoCollectAllProgress) => void,
  options?: {
    onMetaAdsProgress?: (progress: MetaAdsCollectProgress | null) => void
  }
): Promise<MonitoramentoCollectAllProgress> {
  const steps = initialSteps()
  onProgress(buildProgress(steps, MONITORAMENTO_COLLECT_STEPS[0].id, true))

  for (let i = 0; i < MONITORAMENTO_COLLECT_STEPS.length; i += 1) {
    const { id, label } = MONITORAMENTO_COLLECT_STEPS[i]
    steps[i] = { id, label, status: 'running', message: 'Coletando…' }
    onProgress(buildProgress(steps, id, true))

    try {
      const result = await runStep(id, options?.onMetaAdsProgress)
      const skipped = result.skipped || isSkippedMessage(result.message)
      steps[i] = {
        id,
        label,
        status: skipped ? 'skipped' : 'success',
        message: result.message,
      }
    } catch (e) {
      steps[i] = {
        id,
        label,
        status: 'error',
        message: e instanceof Error ? e.message : 'Erro na coleta.',
      }
    }

    onProgress(buildProgress(steps, null, i < MONITORAMENTO_COLLECT_STEPS.length - 1))
  }

  const finalProgress = buildProgress(steps, null, false)
  onProgress(finalProgress)
  return finalProgress
}
