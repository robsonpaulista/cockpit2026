import { panoramaWindowCutoffDay } from '@/lib/monitoramento-panorama-window'
import type { GoogleTrendsInterestRow } from '@/lib/google-trends-types'

/** Prioridade na deduplicação — coleta canônica de 30 dias vence legado. */
const TIMEFRAME_READ_PRIORITY: Record<string, number> = {
  'today 1-m': 0,
  'now 7-d': 1,
  'today 7-d': 2,
  'today 3-m': 3,
}

function timeframePriority(timeframe: string): number {
  return TIMEFRAME_READ_PRIORITY[timeframe] ?? 99
}

function rowKey(row: GoogleTrendsInterestRow): string {
  return `${row.search_term}\0${row.interest_date}`
}

function pickPreferredRow(
  current: GoogleTrendsInterestRow,
  candidate: GoogleTrendsInterestRow
): GoogleTrendsInterestRow {
  const pCurrent = timeframePriority(current.timeframe)
  const pCandidate = timeframePriority(candidate.timeframe)
  if (pCandidate < pCurrent) return candidate
  if (pCandidate > pCurrent) return current
  return candidate.collected_at > current.collected_at ? candidate : current
}

/**
 * Unifica linhas de janelas legadas (7d / 3m) na visão de 30 dias:
 * deduplica por nome+data e descarta pontos fora dos últimos 30 dias.
 */
export function normalizeGoogleTrendsInterestRows(
  rows: GoogleTrendsInterestRow[]
): GoogleTrendsInterestRow[] {
  const cutoffDay = panoramaWindowCutoffDay()
  const map = new Map<string, GoogleTrendsInterestRow>()

  for (const row of rows) {
    if (row.interest_date < cutoffDay) continue
    const key = rowKey(row)
    const existing = map.get(key)
    map.set(key, existing ? pickPreferredRow(existing, row) : row)
  }

  return [...map.values()].sort((a, b) => a.interest_date.localeCompare(b.interest_date))
}

export function googleTrendsInterestDateRange(rows: GoogleTrendsInterestRow[]): {
  dateFrom: string | null
  dateTo: string | null
} {
  if (rows.length === 0) return { dateFrom: null, dateTo: null }
  let dateFrom = rows[0].interest_date
  let dateTo = rows[0].interest_date
  for (const row of rows) {
    if (row.interest_date < dateFrom) dateFrom = row.interest_date
    if (row.interest_date > dateTo) dateTo = row.interest_date
  }
  return { dateFrom, dateTo }
}
