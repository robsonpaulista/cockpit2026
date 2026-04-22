import {
  getTerritorioDesenvolvimentoPI,
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'

export type LiderancaPlanilha = Record<string, unknown>

export type ColunasLiderancaTerritorio = {
  nomeCol?: string
  cargoCol?: string
  liderancaAtualCol?: string
  expectativaJadyelCol?: string
  promessaLiderancaCol?: string
  expectativaLegadoCol?: string
  cidadeCol?: string
  /** Coluna de @ do Instagram na planilha (vínculo com comentários no mapa digital). */
  instagramCol?: string
}

/** Mesma lógica de normalização da página `/dashboard/territorio`. */
export function normalizarNumeroPlanilhaTerritorio(value: unknown): number {
  if (typeof value === 'number') return value

  const str = String(value).trim()
  if (!str) return 0

  let cleaned = str.replace(/[^\d.,]/g, '')

  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    if (parts.length === 2) {
      if (parts[1].length === 3) {
        cleaned = cleaned.replace(/,/g, '')
      } else if (parts[1].length <= 2) {
        cleaned = cleaned.replace(',', '.')
      } else {
        cleaned = cleaned.replace(/,/g, '')
      }
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  }

  const numValue = parseFloat(cleaned)
  return Number.isNaN(numValue) ? 0 : numValue
}

export function resolverColunasLiderancaTerritorio(headers: string[]): ColunasLiderancaTerritorio {
  const liderancaAtualCol = headers.find((h) => /liderança atual|lideranca atual|atual\?/i.test(h))
  const expectativaJadyelCol = headers.find((h) => {
    const normalized = h.toLowerCase().trim()
    return (
      /expectativa.*jadyel.*2026/i.test(normalized) ||
      /expectativa.*2026.*jadyel/i.test(normalized) ||
      /aferid[oa].*2026/i.test(normalized)
    )
  })
  const promessaLiderancaCol = headers.find((h) => /promessa.*lideran[cç]a.*2026/i.test(h))
  const expectativaLegadoCol = headers.find((h) => {
    const normalized = h.toLowerCase().trim()
    return (
      /^expectativa\s+de\s+votos\s+2026$/i.test(h) ||
      (/expectativa.*votos.*2026/i.test(h) &&
        !/jadyel/i.test(normalized) &&
        !/promessa/i.test(normalized) &&
        !/aferid[oa]/i.test(normalized))
    )
  })
  const cidadeCol =
    headers.find((h) => /cidade|city|município|municipio/i.test(h)) || headers[1] || undefined
  const instagramCol = headers.find((h) => {
    const t = h.toLowerCase().trim()
    return (
      /^instagram$/i.test(h.trim()) ||
      /^insta$/i.test(h.trim()) ||
      /instagram|insta\s*[@:]|arroba.*insta/i.test(t)
    )
  })
  const nomeCol = headers.find((h) => /nome|name|lider|pessoa/i.test(h)) || headers[0] || undefined
  const cargoCol = (() => {
    const cargo2024 = headers.find((h) => /cargo.*2024/i.test(h))
    if (cargo2024) return cargo2024
    return headers.find((h) => {
      const normalized = h.toLowerCase().trim()
      return (
        /cargo.*atual|cargo/i.test(normalized) &&
        !/cargo.*2020/i.test(normalized) &&
        !/expectativa|votos|telefone|email|whatsapp|contato|endereco|endereço/i.test(normalized)
      )
    })
  })()

  return {
    nomeCol,
    cargoCol,
    liderancaAtualCol,
    expectativaJadyelCol,
    promessaLiderancaCol,
    expectativaLegadoCol,
    cidadeCol,
    instagramCol,
  }
}

/**
 * Inclui quem tem “Liderança Atual?” = SIM ou valor &gt; 0 em qualquer coluna de votos conhecida
 * (alinhado ao espírito da página Território sem depender do seletor de cenário).
 */
export function filtrarLiderancasRelevantesPlanilha(
  liderancas: LiderancaPlanilha[],
  cols: ColunasLiderancaTerritorio
): LiderancaPlanilha[] {
  if (liderancas.length === 0) return []

  const { liderancaAtualCol, expectativaJadyelCol, promessaLiderancaCol, expectativaLegadoCol } = cols
  const colunasVotos = [expectativaLegadoCol, expectativaJadyelCol, promessaLiderancaCol].filter(
    (c): c is string => Boolean(c)
  )

  if (!liderancaAtualCol && colunasVotos.length === 0) {
    return liderancas
  }

  return liderancas.filter((l) => {
    if (liderancaAtualCol) {
      const value = String(l[liderancaAtualCol] ?? '').trim().toUpperCase()
      if (value === 'SIM' || value === 'YES' || value === 'TRUE' || value === '1') {
        return true
      }
    }
    for (const c of colunasVotos) {
      if (normalizarNumeroPlanilhaTerritorio(l[c]) > 0) return true
    }
    return false
  })
}

export type AgregadoPlanilhaPorTd = {
  liderancas: number
  votosAnterior: number
  votosAferido: number
  votosPromessa: number
}

const vazio: AgregadoPlanilhaPorTd = {
  liderancas: 0,
  votosAnterior: 0,
  votosAferido: 0,
  votosPromessa: 0,
}

function tdInicial(): Map<TerritorioDesenvolvimentoPI, AgregadoPlanilhaPorTd> {
  const m = new Map<TerritorioDesenvolvimentoPI, AgregadoPlanilhaPorTd>()
  for (const t of TERRITORIOS_DESENVOLVIMENTO_PI) {
    m.set(t, { ...vazio })
  }
  return m
}

/** Soma lideranças e votos (por coluna) por TD, a partir do nome do município na planilha. */
export function agregarLiderancasPorTdPlanilha(
  filtradas: LiderancaPlanilha[],
  cidadeCol: string,
  cols: ColunasLiderancaTerritorio
): Map<TerritorioDesenvolvimentoPI, AgregadoPlanilhaPorTd> {
  const mapa = tdInicial()
  const { expectativaLegadoCol, expectativaJadyelCol, promessaLiderancaCol } = cols

  for (const l of filtradas) {
    const cidade = String(l[cidadeCol] ?? '').trim()
    if (!cidade) continue
    const td = getTerritorioDesenvolvimentoPI(cidade)
    if (!td) continue

    const agg = mapa.get(td)
    if (!agg) continue

    agg.liderancas += 1
    if (expectativaLegadoCol) {
      agg.votosAnterior += normalizarNumeroPlanilhaTerritorio(l[expectativaLegadoCol])
    }
    if (expectativaJadyelCol) {
      agg.votosAferido += normalizarNumeroPlanilhaTerritorio(l[expectativaJadyelCol])
    }
    if (promessaLiderancaCol) {
      agg.votosPromessa += normalizarNumeroPlanilhaTerritorio(l[promessaLiderancaCol])
    }
  }

  return mapa
}

export function somarAgregadosPlanilhaTd(
  mapa: Map<TerritorioDesenvolvimentoPI, AgregadoPlanilhaPorTd>
): AgregadoPlanilhaPorTd {
  let liderancas = 0
  let votosAnterior = 0
  let votosAferido = 0
  let votosPromessa = 0
  for (const v of mapa.values()) {
    liderancas += v.liderancas
    votosAnterior += v.votosAnterior
    votosAferido += v.votosAferido
    votosPromessa += v.votosPromessa
  }
  return { liderancas, votosAnterior, votosAferido, votosPromessa }
}

/** Alternância só entre colunas de votos no mapa TD (lideranças ficam em coluna própria). */
export type CenarioVotosPainelMapaTd = 'anterior' | 'aferido'

export type MetricasCidadePlanilha = {
  lid: number
  ant: number
  afr: number
}

const METRICA_VAZIA: MetricasCidadePlanilha = { lid: 0, ant: 0, afr: 0 }

/**
 * Agrega, por nome normalizado de município, contagens no TD informado
 * (chave = `normalizeMunicipioNome` do texto da planilha).
 */
export function agregarMetricasPorCidadeNormalizadoNoTd(
  filtradas: LiderancaPlanilha[],
  td: TerritorioDesenvolvimentoPI,
  cidadeCol: string,
  cols: ColunasLiderancaTerritorio
): Map<string, MetricasCidadePlanilha> {
  const mapa = new Map<string, MetricasCidadePlanilha>()
  const { expectativaLegadoCol, expectativaJadyelCol } = cols

  for (const l of filtradas) {
    const cidade = String(l[cidadeCol] ?? '').trim()
    if (!cidade) continue
    if (getTerritorioDesenvolvimentoPI(cidade) !== td) continue

    const k = normalizeMunicipioNome(cidade)
    let row = mapa.get(k)
    if (!row) {
      row = { lid: 0, ant: 0, afr: 0 }
      mapa.set(k, row)
    }
    row.lid += 1
    if (expectativaLegadoCol) {
      row.ant += normalizarNumeroPlanilhaTerritorio(l[expectativaLegadoCol])
    }
    if (expectativaJadyelCol) {
      row.afr += normalizarNumeroPlanilhaTerritorio(l[expectativaJadyelCol])
    }
  }
  return mapa
}

export function obterMetricasCidadeOficial(
  mapa: ReadonlyMap<string, MetricasCidadePlanilha>,
  nomeOficialMunicipio: string
): MetricasCidadePlanilha {
  return mapa.get(normalizeMunicipioNome(nomeOficialMunicipio)) ?? METRICA_VAZIA
}

export function valorVotosCidade(
  m: MetricasCidadePlanilha,
  cenario: CenarioVotosPainelMapaTd
): number {
  return cenario === 'anterior' ? m.ant : m.afr
}

export function valorVotosAgregadoTd(
  ag: AgregadoPlanilhaPorTd,
  cenario: CenarioVotosPainelMapaTd
): number {
  return cenario === 'anterior' ? ag.votosAnterior : ag.votosAferido
}

/** Votos de uma linha da planilha conforme o cenário (mesma coluna exibida no painel do mapa TD). */
export function valorVotosLinhaPlanilha(
  l: LiderancaPlanilha,
  cols: ColunasLiderancaTerritorio,
  cenario: CenarioVotosPainelMapaTd
): number {
  if (cenario === 'anterior' && cols.expectativaLegadoCol) {
    return normalizarNumeroPlanilhaTerritorio(l[cols.expectativaLegadoCol])
  }
  if (cenario === 'aferido' && cols.expectativaJadyelCol) {
    return normalizarNumeroPlanilhaTerritorio(l[cols.expectativaJadyelCol])
  }
  return 0
}

/** Filtra lideranças cuja coluna de cidade casa com o nome oficial do município (normalizado). */
export function filtrarLiderancasPorMunicipioNomeOficial(
  filtradas: LiderancaPlanilha[],
  cidadeCol: string,
  nomeOficialMunicipio: string
): LiderancaPlanilha[] {
  const alvo = normalizeMunicipioNome(nomeOficialMunicipio)
  if (!alvo) return []
  return filtradas.filter((linha) => {
    const cidade = String(linha[cidadeCol] ?? '').trim()
    if (!cidade) return false
    return normalizeMunicipioNome(cidade) === alvo
  })
}
