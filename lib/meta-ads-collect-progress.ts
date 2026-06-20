export type MetaAdsCollectPhase =
  | 'starting'
  | 'browser'
  | 'listing'
  | 'geo'
  | 'upsert'
  | 'done'
  | 'error'

export type MetaAdsCollectProgress = {
  phase: MetaAdsCollectPhase
  message: string
  percent: number
  actorIndex?: number
  actorTotal?: number
  actorName?: string
  adIndex?: number
  adTotal?: number
  adsFound?: number
  startedAt?: string
  updatedAt?: string
}

const PHASE_LABELS: Record<MetaAdsCollectPhase, string> = {
  starting: 'Preparando',
  browser: 'Abrindo navegador',
  listing: 'Listagem na biblioteca',
  geo: 'Localização (cidade/UF)',
  upsert: 'Salvando no banco',
  done: 'Concluído',
  error: 'Erro',
}

export function metaAdsCollectPhaseLabel(phase: MetaAdsCollectPhase): string {
  return PHASE_LABELS[phase] ?? phase
}

/** Estima % com base no candidato atual e sub-etapa (listagem → geo → upsert). */
export function calcMetaAdsCollectPercent(input: {
  actorIndex?: number
  actorTotal?: number
  phase?: MetaAdsCollectPhase
  adIndex?: number
  adTotal?: number
}): number {
  const actorTotal = input.actorTotal ?? 1
  const actorIndex = Math.max(1, input.actorIndex ?? 1)
  const phase = input.phase ?? 'starting'

  let step = 0.02
  if (phase === 'browser') step = 0.06
  else if (phase === 'listing') step = 0.22
  else if (phase === 'geo') {
    const adTotal = Math.max(1, input.adTotal ?? 1)
    const adIndex = Math.max(0, input.adIndex ?? 0)
    step = 0.22 + (adIndex / adTotal) * 0.68
  } else if (phase === 'upsert') step = 0.94
  else if (phase === 'done') return 100

  const base = (actorIndex - 1) / actorTotal
  const slice = step / actorTotal
  return Math.min(99, Math.max(0, Math.round((base + slice) * 100)))
}

export function normalizeMetaAdsCollectProgress(raw: unknown): MetaAdsCollectProgress | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const phase = row.phase
  const message = typeof row.message === 'string' ? row.message : ''
  if (
    phase !== 'starting' &&
    phase !== 'browser' &&
    phase !== 'listing' &&
    phase !== 'geo' &&
    phase !== 'upsert' &&
    phase !== 'done' &&
    phase !== 'error'
  ) {
    return null
  }
  if (!message) return null

  const actorIndex = typeof row.actorIndex === 'number' ? row.actorIndex : undefined
  const actorTotal = typeof row.actorTotal === 'number' ? row.actorTotal : undefined
  const adIndex = typeof row.adIndex === 'number' ? row.adIndex : undefined
  const adTotal = typeof row.adTotal === 'number' ? row.adTotal : undefined
  const percentRaw = typeof row.percent === 'number' ? row.percent : undefined

  return {
    phase,
    message,
    percent:
      percentRaw ??
      calcMetaAdsCollectPercent({ actorIndex, actorTotal, phase, adIndex, adTotal }),
    actorIndex,
    actorTotal,
    actorName: typeof row.actorName === 'string' ? row.actorName : undefined,
    adIndex,
    adTotal,
    adsFound: typeof row.adsFound === 'number' ? row.adsFound : undefined,
    startedAt: typeof row.startedAt === 'string' ? row.startedAt : undefined,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
  }
}

export function formatMetaAdsCollectElapsed(startedAt: string | undefined): string | null {
  if (!startedAt) return null
  const ms = Date.now() - new Date(startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min === 0) return `${sec}s`
  return `${min}min ${sec}s`
}
