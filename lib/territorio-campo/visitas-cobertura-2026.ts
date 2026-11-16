import { normalizeMunicipioNome } from '@/lib/piaui-regiao'

/** Check-ins de campo entram na Cobertura 2026 só a partir desta data (inclusive). */
export const VISITAS_COBERTURA_2026_DESDE = '2026-10-05'

export type VisitasCobertura2026Status = 'visitada' | 'sem_visita'

export type VisitasCobertura2026Row = {
  municipio: string
  municipioKey: string
  votos2026: number
  visitada: boolean
  status: VisitasCobertura2026Status
  visitas: number
  ultimaVisita: string | null
}

export type VisitasCobertura2026VisitaInfo = {
  municipio: string
  visitas: number
  ultimaVisita: string | null
}

export type VisitasCobertura2026Model = {
  totalVotos2026: number
  votosCobertos: number
  votosSemVisita: number
  pctVotosCobertos: number
  municipiosComVotos: number
  municipiosVisitados: number
  municipiosSemVisita: number
  pctMunicipiosVisitados: number
  rows: VisitasCobertura2026Row[]
}

export type VisitasCobertura2026Filtro = 'todas' | 'sem_visita' | 'visitadas'

function pct(parte: number, total: number): number {
  if (!Number.isFinite(parte) || !Number.isFinite(total) || total <= 0) return 0
  return (parte / total) * 100
}

/** Monta o cruzamento votos Jadyel 2026 × check-ins de campo (qualquer data). */
export function buildVisitasCobertura2026Model(opts: {
  municipios: readonly string[]
  votosPorMunicipio: ReadonlyMap<string, number>
  visitas: readonly VisitasCobertura2026VisitaInfo[]
  totalVotosApi?: number | null
}): VisitasCobertura2026Model {
  const visitasByKey = new Map<string, { visitas: number; ultimaVisita: string | null }>()
  for (const v of opts.visitas) {
    const key = normalizeMunicipioNome(v.municipio)
    if (!key) continue
    const prev = visitasByKey.get(key)
    if (!prev) {
      visitasByKey.set(key, {
        visitas: Math.max(0, v.visitas),
        ultimaVisita: v.ultimaVisita,
      })
      continue
    }
    visitasByKey.set(key, {
      visitas: prev.visitas + Math.max(0, v.visitas),
      ultimaVisita:
        !prev.ultimaVisita || (v.ultimaVisita != null && v.ultimaVisita > prev.ultimaVisita)
          ? v.ultimaVisita
          : prev.ultimaVisita,
    })
  }

  const rows: VisitasCobertura2026Row[] = []
  let votosCobertos = 0
  let votosSemVisita = 0
  let municipiosComVotos = 0
  let municipiosVisitados = 0
  let municipiosSemVisita = 0
  let somaVotosMapa = 0

  for (const municipio of opts.municipios) {
    const municipioKey = normalizeMunicipioNome(municipio)
    if (!municipioKey) continue
    const votos2026 = opts.votosPorMunicipio.get(municipioKey) ?? 0
    const info = visitasByKey.get(municipioKey)
    const visitas = info?.visitas ?? 0
    const visitada = visitas > 0
    const status: VisitasCobertura2026Status = visitada ? 'visitada' : 'sem_visita'

    if (votos2026 > 0) {
      municipiosComVotos += 1
      somaVotosMapa += votos2026
      if (visitada) {
        municipiosVisitados += 1
        votosCobertos += votos2026
      } else {
        municipiosSemVisita += 1
        votosSemVisita += votos2026
      }
    } else if (visitada) {
      // Visitada sem votos 2026 no mapa — conta só na lista, não nos KPIs de peso.
    }

    rows.push({
      municipio,
      municipioKey,
      votos2026,
      visitada,
      status,
      visitas,
      ultimaVisita: info?.ultimaVisita ?? null,
    })
  }

  rows.sort(
    (a, b) =>
      b.votos2026 - a.votos2026 ||
      Number(a.visitada) - Number(b.visitada) ||
      a.municipio.localeCompare(b.municipio, 'pt-BR'),
  )

  const totalVotos2026 =
    typeof opts.totalVotosApi === 'number' && opts.totalVotosApi > 0
      ? opts.totalVotosApi
      : somaVotosMapa

  return {
    totalVotos2026,
    votosCobertos,
    votosSemVisita,
    pctVotosCobertos: pct(votosCobertos, totalVotos2026),
    municipiosComVotos,
    municipiosVisitados,
    municipiosSemVisita,
    pctMunicipiosVisitados: pct(municipiosVisitados, municipiosComVotos),
    rows,
  }
}

export function filtrarVisitasCobertura2026Rows(
  rows: readonly VisitasCobertura2026Row[],
  opts: {
    filtro: VisitasCobertura2026Filtro
    busca?: string
    municipioKey?: string | null
  },
): VisitasCobertura2026Row[] {
  const q = normalizeMunicipioNome(opts.busca ?? '')
  return rows.filter((row) => {
    if (opts.municipioKey && row.municipioKey !== opts.municipioKey) return false
    if (opts.filtro === 'sem_visita' && row.visitada) return false
    if (opts.filtro === 'visitadas' && !row.visitada) return false
    if (q && !row.municipioKey.includes(q) && !normalizeMunicipioNome(row.municipio).includes(q)) {
      return false
    }
    return true
  })
}
