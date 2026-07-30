import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  getMunicipiosPorTerritorioDesenvolvimentoPI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'

export const dynamic = 'force-dynamic'

function extrairCidadeAgenda(cities: unknown): { name: string; state: string } | null {
  if (!cities) return null
  if (Array.isArray(cities)) {
    const first = cities[0] as { name?: unknown; state?: unknown } | undefined
    if (!first) return null
    return {
      name: String(first.name ?? '').trim(),
      state: String(first.state ?? '').trim(),
    }
  }
  if (typeof cities === 'object') {
    const o = cities as { name?: unknown; state?: unknown }
    return {
      name: String(o.name ?? '').trim(),
      state: String(o.state ?? '').trim(),
    }
  }
  return null
}

function extrairVisitasAgenda(visits: unknown): { id: string; checkin_time: string | null }[] {
  if (!visits) return []
  if (!Array.isArray(visits)) return []
  return visits.map((v) => ({
    id: String((v as { id?: unknown }).id ?? ''),
    checkin_time: (v as { checkin_time?: string | null }).checkin_time ?? null,
  }))
}

function parseDateOnly(value: string): string {
  const s = value.trim()
  if (!s) return ''
  return s.includes('T') ? (s.split('T')[0] ?? s) : s
}

function isWithinLastDays(dateStr: string, days: number): boolean {
  const normalized = parseDateOnly(dateStr)
  if (!normalized || days <= 0) return true
  const [y, m, d] = normalized.split('-').map(Number)
  if (!y || !m || !d) return false
  const visitDate = new Date(y, m - 1, d)
  visitDate.setHours(0, 0, 0, 0)
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - days)
  return visitDate >= cutoff
}

function isWithinDayWindow(dateStr: string, days: number, offsetDays: number): boolean {
  const normalized = parseDateOnly(dateStr)
  if (!normalized || days <= 0) return true
  const [y, m, d] = normalized.split('-').map(Number)
  if (!y || !m || !d) return false
  const visitDate = new Date(y, m - 1, d)
  visitDate.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() - offsetDays)
  const start = new Date(end)
  start.setDate(start.getDate() - days)
  return visitDate >= start && visitDate < end
}

/** Dias desde hoje (0 = hoje). Null se data inválida. */
function daysAgoFromToday(dateStr: string): number | null {
  const normalized = parseDateOnly(dateStr)
  if (!normalized) return null
  const [y, m, d] = normalized.split('-').map(Number)
  if (!y || !m || !d) return null
  const visitDate = new Date(y, m - 1, d)
  visitDate.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - visitDate.getTime()) / 86_400_000)
}

/**
 * Índice da semana no recorte (0 = semana mais recente).
 * Ex.: weeks=3, weekSize=7 → 0=0–6d, 1=7–13d, 2=14–20d.
 */
function weekBucketIndex(
  dateStr: string,
  weekSize: number,
  weekCount: number,
): number | null {
  const ago = daysAgoFromToday(dateStr)
  if (ago == null || ago < 0) return null
  const totalDays = weekSize * weekCount
  if (ago >= totalDays) return null
  return Math.floor(ago / weekSize)
}

/**
 * Agrega check-ins (registros em `visits` com `checkin_time`) em agendas concluídas,
 * por município oficial do PI (JSON TD) e por Território de Desenvolvimento.
 * Query:
 *   `days=N` janela
 *   `offsetDays=M` desloca a janela para trás (ex.: days=30&offsetDays=30 → 31–60)
 *   `weeks=K` compara K semanas (days = K×7); inclui `visitasPorSemana` (0 = semana atual)
 */
export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()
    const { searchParams } = new URL(request.url)
    const weeksParam = parseInt(searchParams.get('weeks') ?? '0', 10)
    const weeks =
      Number.isFinite(weeksParam) && weeksParam > 1 && weeksParam <= 12 ? weeksParam : 0
    const weekSize = 7
    const daysParam = parseInt(searchParams.get('days') ?? '0', 10)
    const daysFromParam = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 0
    const days = weeks > 0 ? weeks * weekSize : daysFromParam
    const offsetParam = parseInt(searchParams.get('offsetDays') ?? '0', 10)
    const offsetDays =
      weeks > 0 ? 0 : Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0
    const useWeekBuckets = weeks > 1

    const { data: agendasRaw, error } = await supabase
      .from('agendas')
      .select(
        `
        status,
        type,
        date,
        cities ( name, state ),
        visits ( id, checkin_time )
      `
      )
      .eq('status', 'concluida')

    if (error) {
      if (isSupabaseNetworkError(error)) {
        return NextResponse.json(
          {
            error: 'Conexão com o Supabase temporariamente indisponível. Aguarde alguns segundos e tente novamente.',
            retryable: true,
          },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const visitCountByNorm = new Map<string, number>()
    const displayNameByNorm = new Map<string, string>()
    const ultimaVisitaByNorm = new Map<string, string>()
    const weekCountByNorm = new Map<string, number[]>()
    const emptyWeekBuckets = () => Array.from({ length: weeks }, () => 0)

    for (const row of agendasRaw ?? []) {
      const ag = row as { status?: unknown; date?: unknown; cities?: unknown; visits?: unknown }
      if (String(ag.status ?? '') !== 'concluida') continue

      const visitsArr = extrairVisitasAgenda(ag.visits)
      const agendaDate = String(ag.date ?? '')
      let checkinsNoRecorte = 0
      let ultimaNoRecorte = ''
      const weekHits: number[] = useWeekBuckets ? emptyWeekBuckets() : []

      for (const v of visitsArr) {
        if (v.checkin_time == null || String(v.checkin_time).length === 0) continue
        const refDate = parseDateOnly(String(v.checkin_time)) || parseDateOnly(agendaDate)

        if (useWeekBuckets) {
          const bucket = weekBucketIndex(refDate, weekSize, weeks)
          if (bucket == null) continue
          weekHits[bucket] = (weekHits[bucket] ?? 0) + 1
          checkinsNoRecorte += 1
        } else if (days > 0) {
          if (offsetDays > 0) {
            if (!isWithinDayWindow(refDate, days, offsetDays)) continue
          } else if (!isWithinLastDays(refDate, days)) {
            continue
          }
          checkinsNoRecorte += 1
        } else {
          checkinsNoRecorte += 1
        }

        if (refDate && (!ultimaNoRecorte || refDate > ultimaNoRecorte)) {
          ultimaNoRecorte = refDate
        }
      }
      if (checkinsNoRecorte === 0) continue

      const cidade = extrairCidadeAgenda(ag.cities)
      const cityName = cidade?.name
      const state = (cidade?.state ?? '').trim().toUpperCase()
      if (!cityName?.trim()) continue
      if (state && state !== 'PI') continue

      const norm = normalizeMunicipioNome(cityName)
      if (!displayNameByNorm.has(norm)) {
        displayNameByNorm.set(norm, cityName.trim())
      }
      visitCountByNorm.set(norm, (visitCountByNorm.get(norm) ?? 0) + checkinsNoRecorte)
      if (useWeekBuckets) {
        const prev = weekCountByNorm.get(norm) ?? emptyWeekBuckets()
        for (let i = 0; i < weeks; i += 1) {
          prev[i] = (prev[i] ?? 0) + (weekHits[i] ?? 0)
        }
        weekCountByNorm.set(norm, prev)
      }
      if (ultimaNoRecorte) {
        const prev = ultimaVisitaByNorm.get(norm)
        if (!prev || ultimaNoRecorte > prev) {
          ultimaVisitaByNorm.set(norm, ultimaNoRecorte)
        }
      }
    }

    const oficialNorm = new Set<string>()
    for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
      for (const mun of getMunicipiosPorTerritorioDesenvolvimentoPI(td)) {
        oficialNorm.add(normalizeMunicipioNome(mun))
      }
    }

    const porTd: { territorio: TerritorioDesenvolvimentoPI; visitas: number }[] = TERRITORIOS_DESENVOLVIMENTO_PI.map(
      (td) => {
        let visitas = 0
        for (const mun of getMunicipiosPorTerritorioDesenvolvimentoPI(td)) {
          visitas += visitCountByNorm.get(normalizeMunicipioNome(mun)) ?? 0
        }
        return { territorio: td, visitas }
      }
    )

    const municipios: {
      territorio: TerritorioDesenvolvimentoPI
      municipio: string
      visitas: number
      ultimaVisita: string | null
      visitasPorSemana?: number[]
    }[] = []
    for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
      const munis = [...getMunicipiosPorTerritorioDesenvolvimentoPI(td)].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      )
      for (const mun of munis) {
        const norm = normalizeMunicipioNome(mun)
        municipios.push({
          territorio: td,
          municipio: mun,
          visitas: visitCountByNorm.get(norm) ?? 0,
          ultimaVisita: ultimaVisitaByNorm.get(norm) ?? null,
          ...(useWeekBuckets
            ? { visitasPorSemana: weekCountByNorm.get(norm) ?? emptyWeekBuckets() }
            : {}),
        })
      }
    }

    const foraDoMapaTd: {
      cidade: string
      visitas: number
      ultimaVisita: string | null
      visitasPorSemana?: number[]
    }[] = []
    for (const [norm, n] of visitCountByNorm) {
      if (oficialNorm.has(norm)) continue
      foraDoMapaTd.push({
        cidade: displayNameByNorm.get(norm) ?? norm,
        visitas: n,
        ultimaVisita: ultimaVisitaByNorm.get(norm) ?? null,
        ...(useWeekBuckets
          ? { visitasPorSemana: weekCountByNorm.get(norm) ?? emptyWeekBuckets() }
          : {}),
      })
    }
    foraDoMapaTd.sort((a, b) => a.cidade.localeCompare(b.cidade, 'pt-BR', { sensitivity: 'base' }))

    const totalVisitas = [...visitCountByNorm.values()].reduce((a, b) => a + b, 0)
    const totalPorSemana = useWeekBuckets
      ? emptyWeekBuckets().map((_, i) =>
          [...weekCountByNorm.values()].reduce((acc, arr) => acc + (arr[i] ?? 0), 0),
        )
      : null

    return NextResponse.json({
      porTd,
      municipios,
      foraDoMapaTd,
      totalVisitas,
      totalPorSemana,
      days: days > 0 ? days : null,
      weeks: useWeekBuckets ? weeks : null,
      offsetDays: offsetDays > 0 ? offsetDays : null,
    })
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      console.warn('[visitas-resumo-td] Supabase indisponível (rede). Respondendo 503 retryable.')
      return NextResponse.json(
        {
          error: 'Conexão com o Supabase temporariamente indisponível. Aguarde alguns segundos e tente novamente.',
          retryable: true,
        },
        { status: 503 }
      )
    }
    console.error(e)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
