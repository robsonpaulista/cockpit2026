/** Visitas ao perfil Instagram lançadas manualmente (Supabase). */

export type InstagramProfileVisitManual = {
  date: string
  visits: number
  notes?: string | null
}

export type InstagramProfileVisitsResponse = {
  visits: InstagramProfileVisitManual[]
  /** Mapa date → visits para cruzamentos rápidos. */
  byDate: Record<string, number>
}

function toByDate(rows: InstagramProfileVisitManual[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const row of rows) {
    if (!row.date) continue
    map[row.date] = row.visits
  }
  return map
}

/** Busca visitas manuais dos últimos `days` dias. */
export async function fetchInstagramProfileVisitsManual(
  days: number = 30,
): Promise<InstagramProfileVisitsResponse> {
  try {
    const response = await fetch(`/api/instagram/profile-visits?days=${days}`)
    if (!response.ok) {
      console.error('Erro ao buscar visitas manuais do perfil')
      return { visits: [], byDate: {} }
    }
    const data = (await response.json()) as {
      visits?: InstagramProfileVisitManual[]
    }
    const visits = Array.isArray(data.visits) ? data.visits : []
    return { visits, byDate: toByDate(visits) }
  } catch (error) {
    console.error('Erro ao buscar visitas manuais do perfil:', error)
    return { visits: [], byDate: {} }
  }
}

/** Upsert de uma ou mais datas. */
export async function saveInstagramProfileVisitsManual(
  entries: Array<{ date: string; visits: number; notes?: string | null }>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('/api/instagram/profile-visits', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      return { ok: false, error: payload?.error || 'Falha ao salvar visitas' }
    }
    return { ok: true }
  } catch (error) {
    console.error('Erro ao salvar visitas manuais:', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Erro ao salvar',
    }
  }
}

/** Soma visitas no mapa para as datas informadas. */
export function sumProfileVisits(
  byDate: Record<string, number>,
  dates: string[],
): number {
  let total = 0
  for (const date of dates) {
    const v = byDate[date]
    if (typeof v === 'number' && Number.isFinite(v)) total += v
  }
  return total
}
