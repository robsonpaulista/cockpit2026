export type CityTrendDirection = 'up' | 'down' | 'stable' | 'insufficient'

export type CityTrendPoint = {
  date: string
  value: number
  label?: string
  postsCount?: number
}

const STABLE_PCT = 0.08

/** Compara o início da série com o fim (média do primeiro vs. último terço). */
export function inferCityTrend(points: CityTrendPoint[]): CityTrendDirection {
  if (points.length < 2) return 'insufficient'

  const values = points.map((p) => p.value)
  const third = Math.max(1, Math.floor(values.length / 3))
  const head = values.slice(0, third)
  const tail = values.slice(-third)
  const avg = (arr: number[]) => arr.reduce((s, n) => s + n, 0) / arr.length
  const first = avg(head)
  const last = avg(tail)
  const base = Math.max(Math.abs(first), 1)
  const pct = (last - first) / base

  if (Math.abs(pct) < STABLE_PCT) return 'stable'
  return pct > 0 ? 'up' : 'down'
}

export function cityTrendLabel(direction: CityTrendDirection): string {
  if (direction === 'up') return 'Sobe'
  if (direction === 'down') return 'Cai'
  if (direction === 'stable') return 'Estável'
  return 'Poucos pontos'
}
