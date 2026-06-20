import type {
  GoogleTrendsCompareRow,
  GoogleTrendsInterestPoint,
  GoogleTrendsInterestRow,
  GoogleTrendsRelatedBucket,
  GoogleTrendsRelatedItem,
  GoogleTrendsRelatedKind,
  GoogleTrendsRelatedRow,
  GoogleTrendsSearchContext,
  GoogleTrendsSeries,
} from '@/lib/google-trends-types'
import type { PoliticalActorWithTerms, PoliticalActorType } from '@/lib/youtube-radar-types'

const ACTOR_TYPE_ORDER: Record<string, number> = {
  own_candidate: 0,
  competitor: 1,
  ally: 2,
  other: 3,
}

const RECENT_DAYS = 7
const PREVIOUS_DAYS = 7

function avg(points: GoogleTrendsInterestPoint[]): number {
  if (points.length === 0) return 0
  return points.reduce((acc, p) => acc + p.score, 0) / points.length
}

function buildPoints(rows: GoogleTrendsInterestRow[]): GoogleTrendsInterestPoint[] {
  return [...rows]
    .sort((a, b) => a.interest_date.localeCompare(b.interest_date))
    .map((r) => ({ date: r.interest_date, score: r.interest_score }))
}

function splitRecentPrevious(points: GoogleTrendsInterestPoint[]): {
  recent: GoogleTrendsInterestPoint[]
  previous: GoogleTrendsInterestPoint[]
} {
  if (points.length <= RECENT_DAYS) {
    const mid = Math.max(1, Math.floor(points.length / 2))
    return { recent: points.slice(-mid), previous: points.slice(0, mid) }
  }
  const recent = points.slice(-RECENT_DAYS)
  const previous = points.slice(-(RECENT_DAYS + PREVIOUS_DAYS), -RECENT_DAYS)
  return { recent, previous }
}

function detectPeak(points: GoogleTrendsInterestPoint[]): { peakScore: number; peakDate: string | null } {
  if (points.length === 0) return { peakScore: 0, peakDate: null }
  let peak = points[0]
  for (const p of points) {
    if (p.score > peak.score) peak = p
  }
  return { peakScore: peak.score, peakDate: peak.date }
}

function isTrendAlert(points: GoogleTrendsInterestPoint[], peakDate: string | null, peakScore: number): boolean {
  if (!peakDate || peakScore < 25) return false
  const lastDate = points.at(-1)?.date
  if (!lastDate) return false
  const peakMs = new Date(`${peakDate}T12:00:00`).getTime()
  const lastMs = new Date(`${lastDate}T12:00:00`).getTime()
  const daysSincePeak = (lastMs - peakMs) / (1000 * 60 * 60 * 24)
  return daysSincePeak <= 3
}

type ActorMeta = {
  id: string
  name: string
  slug: string
  actorType: PoliticalActorType
}

function actorMetaByName(actors: PoliticalActorWithTerms[]): Map<string, ActorMeta> {
  const map = new Map<string, ActorMeta>()
  for (const a of actors) {
    map.set(a.name, { id: a.id, name: a.name, slug: a.slug, actorType: a.actor_type })
  }
  return map
}

export function groupTrendsByTerm(rows: GoogleTrendsInterestRow[]): Map<string, GoogleTrendsInterestRow[]> {
  const map = new Map<string, GoogleTrendsInterestRow[]>()
  for (const row of rows) {
    const arr = map.get(row.search_term) ?? []
    arr.push(row)
    map.set(row.search_term, arr)
  }
  return map
}

export function buildGoogleTrendsSeries(
  actors: PoliticalActorWithTerms[],
  rows: GoogleTrendsInterestRow[]
): GoogleTrendsSeries[] {
  const byTerm = groupTrendsByTerm(rows)
  const meta = actorMetaByName(actors)

  const series: GoogleTrendsSeries[] = []

  for (const actor of actors.filter((a) => a.active)) {
    const termRows = byTerm.get(actor.name) ?? []
    series.push({
      searchTerm: actor.name,
      politicoId: actor.id,
      slug: actor.slug,
      name: actor.name,
      actorType: actor.actor_type,
      points: buildPoints(termRows),
    })
  }

  for (const [term, termRows] of byTerm.entries()) {
    if (meta.has(term)) continue
    series.push({
      searchTerm: term,
      politicoId: termRows[0]?.politico_id ?? null,
      slug: null,
      name: term,
      actorType: null,
      points: buildPoints(termRows),
    })
  }

  return series.sort((a, b) => {
    const ta = a.actorType ? (ACTOR_TYPE_ORDER[a.actorType] ?? 9) : 9
    const tb = b.actorType ? (ACTOR_TYPE_ORDER[b.actorType] ?? 9) : 9
    if (ta !== tb) return ta - tb
    const aLast = a.points.at(-1)?.score ?? 0
    const bLast = b.points.at(-1)?.score ?? 0
    return bLast - aLast || a.name.localeCompare(b.name, 'pt-BR')
  })
}

export function groupTrendsRelatedByTerm(rows: GoogleTrendsRelatedRow[]): Map<string, GoogleTrendsRelatedRow[]> {
  const map = new Map<string, GoogleTrendsRelatedRow[]>()
  for (const row of rows) {
    const arr = map.get(row.search_term) ?? []
    arr.push(row)
    map.set(row.search_term, arr)
  }
  return map
}

function relatedItemsForBucket(
  rows: GoogleTrendsRelatedRow[],
  kind: GoogleTrendsRelatedKind,
  bucket: GoogleTrendsRelatedBucket
): GoogleTrendsRelatedItem[] {
  return rows
    .filter((r) => r.kind === kind && r.bucket === bucket)
    .sort((a, b) => a.rank - b.rank)
    .map((r) => ({
      label: r.label,
      formattedValue: r.formatted_value,
      valueScore: r.value_score,
      exploreLink: r.explore_link,
      rank: r.rank,
      kind: r.kind,
      bucket: r.bucket,
    }))
}

export function buildGoogleTrendsSearchContext(
  searchTerm: string,
  politicoId: string | null,
  slug: string | null,
  name: string,
  relatedRows: GoogleTrendsRelatedRow[]
): GoogleTrendsSearchContext {
  const queriesTop = relatedItemsForBucket(relatedRows, 'query', 'top')
  const queriesRising = relatedItemsForBucket(relatedRows, 'query', 'rising')
  const topicsTop = relatedItemsForBucket(relatedRows, 'topic', 'top')
  const topicsRising = relatedItemsForBucket(relatedRows, 'topic', 'rising')

  return {
    searchTerm,
    politicoId,
    slug,
    name,
    queriesTop,
    queriesRising,
    topicsTop,
    topicsRising,
    hasData:
      queriesTop.length > 0 ||
      queriesRising.length > 0 ||
      topicsTop.length > 0 ||
      topicsRising.length > 0,
  }
}

export function buildGoogleTrendsSearchContexts(
  actors: PoliticalActorWithTerms[],
  relatedRows: GoogleTrendsRelatedRow[]
): GoogleTrendsSearchContext[] {
  const byTerm = groupTrendsRelatedByTerm(relatedRows)
  const contexts: GoogleTrendsSearchContext[] = []

  for (const actor of actors.filter((a) => a.active)) {
    contexts.push(
      buildGoogleTrendsSearchContext(
        actor.name,
        actor.id,
        actor.slug,
        actor.name,
        byTerm.get(actor.name) ?? []
      )
    )
  }

  for (const [term, termRows] of byTerm.entries()) {
    if (contexts.some((c) => c.searchTerm === term)) continue
    contexts.push(
      buildGoogleTrendsSearchContext(
        term,
        termRows[0]?.politico_id ?? null,
        null,
        term,
        termRows
      )
    )
  }

  return contexts
}

export function attachSearchContextsToCompareRows(
  compare: GoogleTrendsCompareRow[],
  contexts: GoogleTrendsSearchContext[]
): GoogleTrendsCompareRow[] {
  const byTerm = new Map(contexts.map((c) => [c.searchTerm, c]))
  return compare.map((row) => ({
    ...row,
    searchContext: byTerm.get(row.searchTerm) ?? null,
  }))
}

export function buildGoogleTrendsCompareRows(
  actors: PoliticalActorWithTerms[],
  rows: GoogleTrendsInterestRow[],
  relatedRows: GoogleTrendsRelatedRow[] = []
): GoogleTrendsCompareRow[] {
  const contexts = buildGoogleTrendsSearchContexts(actors, relatedRows)
  const compare = buildGoogleTrendsSeries(actors, rows).map((s) => {
    const { recent, previous } = splitRecentPrevious(s.points)
    const avgRecent = avg(recent)
    const avgPrevious = avg(previous)
    const growthPct =
      avgPrevious > 0 ? Math.round(((avgRecent - avgPrevious) / avgPrevious) * 100) : avgRecent > 0 ? 100 : null
    const { peakScore, peakDate } = detectPeak(s.points)
    const latestScore = s.points.at(-1)?.score ?? 0

    return {
      searchTerm: s.searchTerm,
      politicoId: s.politicoId,
      slug: s.slug,
      name: s.name,
      actorType: s.actorType,
      avgRecent: Math.round(avgRecent),
      avgPrevious: Math.round(avgPrevious),
      growthPct,
      peakScore,
      peakDate,
      latestScore,
      trendAlert: isTrendAlert(s.points, peakDate, peakScore),
      points: s.points,
      searchContext: null,
    }
  })

  return attachSearchContextsToCompareRows(compare, contexts)
}

export function buildTrendsChartData(
  series: GoogleTrendsSeries[]
): Array<Record<string, string | number>> {
  const dateSet = new Set<string>()
  for (const s of series) {
    for (const p of s.points) dateSet.add(p.date)
  }
  const dates = [...dateSet].sort()

  return dates.map((date) => {
    const row: Record<string, string | number> = { date }
    for (const s of series) {
      const point = s.points.find((p) => p.date === date)
      if (point) row[s.name] = point.score
    }
    return row
  })
}
