/** Fuso do Google Trends no cockpit (Piauí / Brasília, UTC−3). */
export const GOOGLE_TRENDS_TZ_MINUTES = 180

const BR_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Fortaleza',
})

export function formatGoogleTrendsInterestDay(ms: number): string {
  return BR_DATE_FORMATTER.format(new Date(ms))
}

export function interestDateFromTrendsPoint(time: string | number, formattedTime?: string): string {
  if (formattedTime) {
    const parsed = Date.parse(formattedTime)
    if (!Number.isNaN(parsed)) return formatGoogleTrendsInterestDay(parsed)
  }

  const asNum = Number(time)
  if (Number.isFinite(asNum) && asNum > 0) {
    const ms = asNum > 1e12 ? asNum : asNum * 1000
    return formatGoogleTrendsInterestDay(ms)
  }

  if (typeof time === 'string' && /^\d{4}-\d{2}-\d{2}/.test(time)) return time.slice(0, 10)

  throw new Error(`Data Trends inválida: ${time}`)
}

type TimelinePoint = {
  time: string | number
  formattedTime?: string
  value: number[]
}

type ActorRef = { id: string; name: string }

type InterestRowDraft = {
  politico_id: string
  search_term: string
  interest_date: string
  interest_score: number
}

/** Agrupa pontos horários/diários em um valor por dia (máximo) por candidato. */
export function buildInterestRowsFromTimeline(
  timeline: TimelinePoint[],
  batch: ActorRef[]
): InterestRowDraft[] {
  const scoreByTermDate = new Map<string, number>()

  for (const point of timeline) {
    const interestDate = interestDateFromTrendsPoint(point.time, point.formattedTime)
    batch.forEach((actor, idx) => {
      const raw = point.value[idx]
      const score = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : 0
      const clamped = Math.max(0, Math.min(100, score))
      const key = `${actor.name}\0${interestDate}`
      const prev = scoreByTermDate.get(key) ?? 0
      scoreByTermDate.set(key, Math.max(prev, clamped))
    })
  }

  const rows: InterestRowDraft[] = []
  for (const [key, interest_score] of scoreByTermDate) {
    const [search_term, interest_date] = key.split('\0')
    const actor = batch.find((a) => a.name === search_term)
    if (!actor) continue
    rows.push({
      politico_id: actor.id,
      search_term,
      interest_date,
      interest_score,
    })
  }

  return rows.sort((a, b) => a.interest_date.localeCompare(b.interest_date))
}

export function isGoogleTrendsSeriesStale(dateTo: string | null, maxLagDays = 2): boolean {
  if (!dateTo) return true
  const endMs = new Date(`${dateTo}T12:00:00`).getTime()
  const todayMs = new Date(formatGoogleTrendsInterestDay(Date.now()) + 'T12:00:00').getTime()
  const lagDays = (todayMs - endMs) / (1000 * 60 * 60 * 24)
  return lagDays > maxLagDays
}
