import municipiosPiaui from '@/lib/municipios-piaui.json'
import {
  classificarSinalDigital,
  normalizeIptMunicipio,
  type IptMunicipio,
} from '@/lib/ipt'
import {
  classificarEvolucaoDigital,
  classificarEvolucaoVisitas,
  type IptEvolucao,
} from '@/lib/ipt-evolucao'
import type { PesquisaIptEvolucaoMunicipio } from '@/lib/ipt-pesquisa'

export type IptPresencaDigitalMunicipio = {
  /** Nome oficial no mapa (municípios-piaui.json). */
  municipio: string
  seguidores: number
  /** % sobre o total de seguidores da conta. */
  seguidoresPct: number | null
  /** Contas engajadas no período (~30 dias / this_month). */
  contasEngajadas: number
  seguidoresAnterior: number | null
  contasEngajadasAnterior: number | null
}

export type IptPresencaDigitalMatchRow = {
  labelInstagram: string
  cityPart: string
  chave: string
  matched: boolean
  municipioOficial: string | null
  seguidores: number
  contasEngajadas: number
}

export type IptPresencaDigitalCobertura = {
  totalLabels: number
  matchedPi: number
  unmatched: IptPresencaDigitalMatchRow[]
  matched: IptPresencaDigitalMatchRow[]
  /** true quando todas as labels Instagram casaram com algum município do PI. */
  todasNormalizadasNoMapa: boolean
}

type MunicipioPi = { nome: string }

const MUNICIPIOS_PI = municipiosPiaui as MunicipioPi[]

const PI_BY_KEY = new Map<string, string>(
  MUNICIPIOS_PI.map((m) => [normalizeIptMunicipio(m.nome), m.nome])
)

/** Extrai o nome da cidade de labels Meta ("Teresina, Piauí", "Teresina, Brazil"). */
export function extractInstagramCityName(label: string): string {
  const raw = label.trim()
  if (!raw) return ''
  const beforeComma = raw.split(',')[0]?.trim() ?? raw
  return beforeComma
}

/**
 * Resolve label Instagram → município oficial do PI.
 * Retorna null se for cidade fora do PI ou sem match.
 */
export function matchInstagramCityToPiMunicipio(label: string): string | null {
  const cityPart = extractInstagramCityName(label)
  if (!cityPart) return null
  const key = normalizeIptMunicipio(cityPart)
  return PI_BY_KEY.get(key) ?? null
}

export function buildIptPresencaDigitalPorMunicipio(input: {
  topLocations?: Record<string, number> | null
  engagedTopLocations?: Record<string, number> | null
  followersTotal?: number | null
  previousByMunicipio?: Record<string, { followers: number; engaged: number; date: string }> | null
}): {
  porMunicipio: Map<string, IptPresencaDigitalMunicipio>
  cobertura: IptPresencaDigitalCobertura
} {
  const followersTotal =
    typeof input.followersTotal === 'number' && input.followersTotal > 0
      ? input.followersTotal
      : null

  const labels = new Set<string>([
    ...Object.keys(input.topLocations ?? {}),
    ...Object.keys(input.engagedTopLocations ?? {}),
  ])

  const matched: IptPresencaDigitalMatchRow[] = []
  const unmatched: IptPresencaDigitalMatchRow[] = []
  const porMunicipio = new Map<string, IptPresencaDigitalMunicipio>()

  for (const label of labels) {
    const cityPart = extractInstagramCityName(label)
    const chave = normalizeIptMunicipio(cityPart)
    const oficial = matchInstagramCityToPiMunicipio(label)
    const seguidores = Number(input.topLocations?.[label] ?? 0) || 0
    const contasEngajadas = Number(input.engagedTopLocations?.[label] ?? 0) || 0

    const row: IptPresencaDigitalMatchRow = {
      labelInstagram: label,
      cityPart,
      chave,
      matched: Boolean(oficial),
      municipioOficial: oficial,
      seguidores,
      contasEngajadas,
    }

    if (!oficial) {
      unmatched.push(row)
      continue
    }

    matched.push(row)
    const key = normalizeIptMunicipio(oficial)
    const prev = input.previousByMunicipio?.[key]
    const cur = porMunicipio.get(key) ?? {
      municipio: oficial,
      seguidores: 0,
      seguidoresPct: null,
      contasEngajadas: 0,
      seguidoresAnterior: prev?.followers ?? null,
      contasEngajadasAnterior: prev?.engaged ?? null,
    }
    cur.seguidores += seguidores
    cur.contasEngajadas += contasEngajadas
    cur.seguidoresPct =
      followersTotal != null && followersTotal > 0
        ? (cur.seguidores / followersTotal) * 100
        : null
    if (prev) {
      cur.seguidoresAnterior = prev.followers
      cur.contasEngajadasAnterior = prev.engaged
    }
    porMunicipio.set(key, cur)
  }

  matched.sort((a, b) => b.seguidores - a.seguidores || a.labelInstagram.localeCompare(b.labelInstagram))
  unmatched.sort((a, b) => b.seguidores - a.seguidores || a.labelInstagram.localeCompare(b.labelInstagram))

  const totalLabels = labels.size
  const matchedPi = matched.length

  return {
    porMunicipio,
    cobertura: {
      totalLabels,
      matchedPi,
      unmatched,
      matched,
      todasNormalizadasNoMapa: totalLabels > 0 && unmatched.length === 0,
    },
  }
}

export function mergePresencaDigitalNosMunicipiosIpt(
  municipios: IptMunicipio[],
  porMunicipio: Map<string, IptPresencaDigitalMunicipio>
): IptMunicipio[] {
  return municipios.map((m) => {
    const digital = porMunicipio.get(normalizeIptMunicipio(m.municipio))
    if (!digital) {
      return {
        ...m,
        sinais: {
          ...m.sinais,
          digital: classificarSinalDigital(null, null),
        },
        detalhes: {
          ...m.detalhes,
          digitalSeguidores: null,
          digitalSeguidoresPct: null,
          digitalContasEngajadas: null,
          digitalSeguidoresAnterior: null,
          digitalContasEngajadasAnterior: null,
        },
        evolucao: {
          ...m.evolucao,
          digitalSeguidores: 'sem_dado' as IptEvolucao,
          digitalEngajamento: 'sem_dado' as IptEvolucao,
        },
      }
    }
    return {
      ...m,
      sinais: {
        ...m.sinais,
        digital: classificarSinalDigital(digital.seguidores, digital.contasEngajadas),
      },
      detalhes: {
        ...m.detalhes,
        digitalSeguidores: digital.seguidores,
        digitalSeguidoresPct: digital.seguidoresPct,
        digitalContasEngajadas: digital.contasEngajadas,
        digitalSeguidoresAnterior: digital.seguidoresAnterior,
        digitalContasEngajadasAnterior: digital.contasEngajadasAnterior,
      },
      evolucao: {
        ...m.evolucao,
        digitalSeguidores: classificarEvolucaoDigital(
          digital.seguidores,
          digital.seguidoresAnterior
        ),
        digitalEngajamento: classificarEvolucaoDigital(
          digital.contasEngajadas,
          digital.contasEngajadasAnterior
        ),
      },
    }
  })
}

export function mergePesquisaEvolucaoNosMunicipiosIpt(
  municipios: IptMunicipio[],
  evolucaoPorMunicipio: Map<string, PesquisaIptEvolucaoMunicipio>
): IptMunicipio[] {
  return municipios.map((m) => {
    const evo = evolucaoPorMunicipio.get(normalizeIptMunicipio(m.municipio))
    if (!evo) return m
    return {
      ...m,
      detalhes: {
        ...m.detalhes,
        pesquisaMediaPct: evo.mediaPct,
        pesquisaRecentePct: evo.recentePct,
        pesquisaAnteriorPct: evo.anteriorPct,
        pesquisaDeltaPp: evo.deltaPp,
      },
      evolucao: {
        ...m.evolucao,
        pesquisa: evo.evolucao,
      },
    }
  })
}

export function mergeVisitasEvolucaoNosMunicipiosIpt(
  municipios: IptMunicipio[],
  visitasAnteriorPorMunicipio: Map<string, number>
): IptMunicipio[] {
  return municipios.map((m) => {
    const key = normalizeIptMunicipio(m.municipio)
    const anterior = visitasAnteriorPorMunicipio.get(key) ?? 0
    const atual = m.detalhes.visitasNoPeriodo
    return {
      ...m,
      detalhes: {
        ...m.detalhes,
        visitasPeriodoAnterior: anterior,
      },
      evolucao: {
        ...m.evolucao,
        visitas: classificarEvolucaoVisitas(atual, anterior),
      },
    }
  })
}
