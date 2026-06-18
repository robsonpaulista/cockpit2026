import { formatInstagramFollowersDailyReport } from '@/lib/instagram-followers-daily-report'
import { parseInstagramFollowersDailyDays } from '@/lib/agent/detect-instagram-followers-daily'
import type { InstagramSnapshot } from '@/lib/instagramApi'

type SnapshotHistoryResponse = {
  history?: Array<{
    snapshot_date: string
    followers_count: number
    instagram_username?: string
  }>
  summary?: {
    currentFollowers?: number
    growth?: number
    growthPercentage?: number
    periodDays?: number
  }
}

async function fetchWithCookies(origin: string, path: string, cookie: string): Promise<Response> {
  return fetch(`${origin}${path}`, {
    headers: { cookie },
    cache: 'no-store',
  })
}

export async function toolConsultarInstagramSeguidoresDiario(
  origin: string,
  cookie: string,
  args: Record<string, string>,
  queryHint?: string
): Promise<string> {
  const days = parseInstagramFollowersDailyDays(
    args.dias ? `${args.dias} dias` : (queryHint ?? '')
  )

  const res = await fetchWithCookies(
    origin,
    `/api/instagram/snapshot?days=${days}`,
    cookie
  )

  if (!res.ok) {
    if (res.status === 401) {
      return 'Configure o Instagram em **Redes & Instagram** para consultar a evolução de seguidores.'
    }
    return 'Não foi possível carregar o histórico de seguidores. Tente atualizar a página **Redes & Instagram**.'
  }

  const data = (await res.json()) as SnapshotHistoryResponse
  const history = data.history ?? []

  const username =
    history.length > 0
      ? history[history.length - 1].instagram_username
      : undefined

  return formatInstagramFollowersDailyReport({
    history: history as InstagramSnapshot[],
    periodDays: days,
    username,
    currentFollowers: data.summary?.currentFollowers,
    periodGrowth: data.summary?.growth,
    growthPercentage: data.summary?.growthPercentage,
  })
}
