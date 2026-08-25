import type { CityDemographicsSeriesPoint } from '@/lib/instagram-city-demographics-history'

export type InstagramCityDemographicsHistoryResponse = {
  lookbackDays: number
  seriesByCity: Record<string, CityDemographicsSeriesPoint[]>
  error?: string
}

export async function fetchInstagramCityDemographicsHistory(
  days = 90,
): Promise<InstagramCityDemographicsHistoryResponse> {
  const res = await fetch(`/api/instagram/demographics/history?days=${days}`, {
    cache: 'no-store',
  })
  const json = (await res.json()) as InstagramCityDemographicsHistoryResponse
  if (!res.ok) {
    return { lookbackDays: days, seriesByCity: {}, error: json.error ?? 'Falha ao carregar histórico' }
  }
  return {
    lookbackDays: json.lookbackDays ?? days,
    seriesByCity: json.seriesByCity ?? {},
  }
}
