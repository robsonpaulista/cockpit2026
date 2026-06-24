export type DataFreshnessLevel = 'fresh' | 'stale' | 'old'

const FRESH_MS = 30 * 60 * 1000
const STALE_MS = 2 * 60 * 60 * 1000

export function getDataFreshnessLevel(
  lastUpdatedIso: string | null,
  isLive?: boolean
): DataFreshnessLevel {
  if (isLive) return 'fresh'
  if (!lastUpdatedIso) return 'old'
  const age = Date.now() - new Date(lastUpdatedIso).getTime()
  if (age <= FRESH_MS) return 'fresh'
  if (age <= STALE_MS) return 'stale'
  return 'old'
}

export function formatDataFreshnessLabel(
  lastUpdatedIso: string | null,
  isLive?: boolean
): string {
  if (isLive) return 'dados recentes'
  if (!lastUpdatedIso) return 'sem atualização recente'
  const age = Date.now() - new Date(lastUpdatedIso).getTime()
  const minutes = Math.floor(age / 60_000)
  if (minutes < 1) return 'atualizado agora'
  if (minutes < 60) return `atualizado há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `atualizado há ${hours}h`
  const days = Math.floor(hours / 24)
  return `atualizado há ${days} dia${days === 1 ? '' : 's'}`
}
