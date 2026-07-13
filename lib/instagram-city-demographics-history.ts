import { createClient } from '@/lib/supabase/server'
import { matchInstagramCityToPiMunicipio } from '@/lib/ipt-instagram-presenca-digital'
import { normalizeIptMunicipio } from '@/lib/ipt'
import { logger } from '@/lib/logger'

export type CityDemoSnapshotRow = {
  city_label: string
  municipio_norm: string | null
  followers_count: number
  engaged_accounts: number
  followers_total_account: number | null
  snapshot_date: string
}

/** Upsert snapshot do dia para todas as labels Instagram. */
export async function saveInstagramCityDemographicsSnapshot(input: {
  userId: string
  followersTotal: number
  topLocations: Record<string, number>
  engagedTopLocations: Record<string, number>
  snapshotDate?: string
}): Promise<number> {
  const supabase = createClient()
  const snapshotDate = input.snapshotDate ?? new Date().toISOString().slice(0, 10)
  const labels = new Set([
    ...Object.keys(input.topLocations),
    ...Object.keys(input.engagedTopLocations),
  ])
  if (labels.size === 0) return 0

  const rows: Array<{
    user_id: string
    snapshot_date: string
    city_label: string
    municipio_norm: string | null
    followers_count: number
    engaged_accounts: number
    followers_total_account: number
  }> = [...labels].map((city_label) => {
    const oficial = matchInstagramCityToPiMunicipio(city_label)
    return {
      user_id: input.userId,
      snapshot_date: snapshotDate,
      city_label,
      municipio_norm: oficial ? normalizeIptMunicipio(oficial) : null,
      followers_count: Number(input.topLocations[city_label] ?? 0) || 0,
      engaged_accounts: Number(input.engagedTopLocations[city_label] ?? 0) || 0,
      followers_total_account: input.followersTotal,
    }
  })

  const { error } = await supabase.from('instagram_city_demographics_history').upsert(rows, {
    onConflict: 'user_id,snapshot_date,city_label',
  })

  if (error) {
    logger.warn('Falha ao salvar snapshot demografia por cidade', { error: error.message })
    return 0
  }
  return rows.length
}

/**
 * Compara snapshot mais recente com o mais antigo disponível em até `lookbackDays`
 * (preferindo ~30d atrás, senão o mais distante disponível).
 */
export async function loadInstagramCityDemographicsEvolution(input: {
  userId: string
  lookbackDays?: number
}): Promise<{
  latestByMunicipio: Map<string, { followers: number; engaged: number; date: string }>
  previousByMunicipio: Map<string, { followers: number; engaged: number; date: string }>
}> {
  const supabase = createClient()
  const lookbackDays = input.lookbackDays ?? 30
  const since = new Date()
  since.setDate(since.getDate() - Math.max(lookbackDays, 7))
  const sinceStr = since.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('instagram_city_demographics_history')
    .select(
      'city_label, municipio_norm, followers_count, engaged_accounts, snapshot_date'
    )
    .eq('user_id', input.userId)
    .not('municipio_norm', 'is', null)
    .gte('snapshot_date', sinceStr)
    .order('snapshot_date', { ascending: true })

  const latestByMunicipio = new Map<string, { followers: number; engaged: number; date: string }>()
  const previousByMunicipio = new Map<string, { followers: number; engaged: number; date: string }>()

  if (error || !data) {
    if (error) logger.warn('Falha ao ler histórico demografia cidade', { error: error.message })
    return { latestByMunicipio, previousByMunicipio }
  }

  const byMun = new Map<string, CityDemoSnapshotRow[]>()
  for (const raw of data) {
    const municipio_norm = (raw.municipio_norm as string | null)?.trim()
    if (!municipio_norm) continue
    const row: CityDemoSnapshotRow = {
      city_label: String(raw.city_label),
      municipio_norm,
      followers_count: Number(raw.followers_count) || 0,
      engaged_accounts: Number(raw.engaged_accounts) || 0,
      followers_total_account: null,
      snapshot_date: String(raw.snapshot_date).slice(0, 10),
    }
    const list = byMun.get(municipio_norm) ?? []
    list.push(row)
    byMun.set(municipio_norm, list)
  }

  for (const [mun, rows] of byMun) {
    const sorted = [...rows].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    const latest = sorted[sorted.length - 1]!
    latestByMunicipio.set(mun, {
      followers: latest.followers_count,
      engaged: latest.engaged_accounts,
      date: latest.snapshot_date,
    })

    // Prefer snapshot ~lookbackDays ago; else oldest different day
    const target = new Date(latest.snapshot_date)
    target.setDate(target.getDate() - lookbackDays)
    const targetStr = target.toISOString().slice(0, 10)

    let previous: CityDemoSnapshotRow | null = null
    for (const row of sorted) {
      if (row.snapshot_date >= latest.snapshot_date) break
      if (row.snapshot_date <= targetStr) previous = row
    }
    if (!previous) {
      for (let i = sorted.length - 2; i >= 0; i--) {
        if (sorted[i]!.snapshot_date !== latest.snapshot_date) {
          previous = sorted[i]!
          break
        }
      }
    }
    if (previous) {
      previousByMunicipio.set(mun, {
        followers: previous.followers_count,
        engaged: previous.engaged_accounts,
        date: previous.snapshot_date,
      })
    }
  }

  return { latestByMunicipio, previousByMunicipio }
}
