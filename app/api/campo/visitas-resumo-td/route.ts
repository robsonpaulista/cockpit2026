import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
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

/**
 * Agrega check-ins (registros em `visits` com `checkin_time`) em agendas concluídas,
 * por município oficial do PI (JSON TD) e por Território de Desenvolvimento.
 */
export async function GET() {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: agendasRaw, error } = await supabase
      .from('agendas')
      .select(
        `
        status,
        type,
        cities ( name, state ),
        visits ( id, checkin_time )
      `
      )
      .eq('status', 'concluida')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const visitCountByNorm = new Map<string, number>()
    const displayNameByNorm = new Map<string, string>()

    for (const row of agendasRaw ?? []) {
      const ag = row as { status?: unknown; cities?: unknown; visits?: unknown }
      if (String(ag.status ?? '') !== 'concluida') continue

      const visitsArr = extrairVisitasAgenda(ag.visits)
      const comCheckin = visitsArr.filter((v) => v.checkin_time != null && String(v.checkin_time).length > 0).length
      if (comCheckin === 0) continue

      const cidade = extrairCidadeAgenda(ag.cities)
      const cityName = cidade?.name
      const state = (cidade?.state ?? '').trim().toUpperCase()
      if (!cityName?.trim()) continue
      if (state && state !== 'PI') continue

      const norm = normalizeMunicipioNome(cityName)
      if (!displayNameByNorm.has(norm)) {
        displayNameByNorm.set(norm, cityName.trim())
      }
      visitCountByNorm.set(norm, (visitCountByNorm.get(norm) ?? 0) + comCheckin)
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

    const municipios: { territorio: TerritorioDesenvolvimentoPI; municipio: string; visitas: number }[] = []
    for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
      const munis = [...getMunicipiosPorTerritorioDesenvolvimentoPI(td)].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      )
      for (const mun of munis) {
        municipios.push({
          territorio: td,
          municipio: mun,
          visitas: visitCountByNorm.get(normalizeMunicipioNome(mun)) ?? 0,
        })
      }
    }

    const foraDoMapaTd: { cidade: string; visitas: number }[] = []
    for (const [norm, n] of visitCountByNorm) {
      if (oficialNorm.has(norm)) continue
      foraDoMapaTd.push({
        cidade: displayNameByNorm.get(norm) ?? norm,
        visitas: n,
      })
    }
    foraDoMapaTd.sort((a, b) => a.cidade.localeCompare(b.cidade, 'pt-BR', { sensitivity: 'base' }))

    const totalVisitas = [...visitCountByNorm.values()].reduce((a, b) => a + b, 0)

    return NextResponse.json({
      porTd,
      municipios,
      foraDoMapaTd,
      totalVisitas,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
