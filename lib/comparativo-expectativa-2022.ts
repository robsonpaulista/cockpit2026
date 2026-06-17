import municipiosPiaui from '@/lib/municipios-piaui.json'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'

export type TendenciaExpectativa2022 = 'cresceu' | 'manteve' | 'caiu' | 'sem-dados'

export interface ComparativoExpectativa2022Row {
  cidade: string
  expectativa2026: number
  votos2022: number
  delta: number
  deltaPercentual: number | null
  tendencia: TendenciaExpectativa2022
  liderancas: number
}

const MANTEVE_PCT_LIMIAR = 5
const MANTEVE_DELTA_ABSOLUTO = 50

export function classificarTendenciaExpectativa2022(
  expectativa2026: number,
  votos2022: number
): TendenciaExpectativa2022 {
  if (expectativa2026 <= 0 && votos2022 <= 0) return 'sem-dados'
  if (votos2022 <= 0 && expectativa2026 > 0) return 'cresceu'
  if (expectativa2026 <= 0 && votos2022 > 0) return 'caiu'

  const delta = expectativa2026 - votos2022
  const pct = (delta / votos2022) * 100

  if (Math.abs(pct) <= MANTEVE_PCT_LIMIAR || Math.abs(delta) <= MANTEVE_DELTA_ABSOLUTO) {
    return 'manteve'
  }
  return delta > 0 ? 'cresceu' : 'caiu'
}

export function labelTendenciaExpectativa2022(tendencia: TendenciaExpectativa2022): string {
  switch (tendencia) {
    case 'cresceu':
      return 'Crescimento'
    case 'manteve':
      return 'Estável'
    case 'caiu':
      return 'Queda'
    default:
      return 'Sem dados'
  }
}

export function buildComparativoExpectativa2022Lista(
  expectativaPorCidade: ReadonlyMap<string, number>,
  votos2022PorCidade: ReadonlyMap<string, number>,
  liderancasPorCidade: ReadonlyMap<string, number> = new Map()
): ComparativoExpectativa2022Row[] {
  const municipios = municipiosPiaui as Array<{ nome: string }>

  return municipios
    .map((municipio) => {
      const key = normalizeMunicipioNome(municipio.nome)
      const expectativa2026 = Math.round(expectativaPorCidade.get(key) || 0)
      const votos2022 = Math.round(votos2022PorCidade.get(key) || 0)
      const delta = expectativa2026 - votos2022
      const deltaPercentual = votos2022 > 0 ? (delta / votos2022) * 100 : null
      const tendencia = classificarTendenciaExpectativa2022(expectativa2026, votos2022)

      return {
        cidade: municipio.nome,
        expectativa2026,
        votos2022,
        delta,
        deltaPercentual,
        tendencia,
        liderancas: liderancasPorCidade.get(key) || 0,
      }
    })
    .sort((a, b) => {
      const rank = (t: TendenciaExpectativa2022) =>
        t === 'cresceu' ? 0 : t === 'manteve' ? 1 : t === 'caiu' ? 2 : 3
      const ra = rank(a.tendencia)
      const rb = rank(b.tendencia)
      if (ra !== rb) return ra - rb
      return Math.abs(b.delta) - Math.abs(a.delta)
    })
}

export function filterComparativoExpectativa2022Lista(
  rows: ComparativoExpectativa2022Row[],
  filtro: 'caiu' | 'cresceu' | 'manteve' | 'todos'
): ComparativoExpectativa2022Row[] {
  switch (filtro) {
    case 'caiu':
      return rows.filter((r) => r.expectativa2026 < r.votos2022 && r.votos2022 > 0)
    case 'cresceu':
      return rows.filter((r) => r.expectativa2026 > r.votos2022 && r.expectativa2026 > 0)
    case 'manteve':
      return rows.filter((r) => r.tendencia === 'manteve')
    default:
      return rows
  }
}

export type CenarioExpectativaComparativo = 'legado' | 'aferido' | 'promessa'

export function labelCenarioExpectativaComparativo(cenario: CenarioExpectativaComparativo): string {
  switch (cenario) {
    case 'aferido':
      return 'Expectativa Jadyel 2026 (Aferido)'
    case 'promessa':
      return 'Promessa da Liderança 2026'
    default:
      return 'Expectativa de Votos 2026 (Anterior)'
  }
}

export interface ComparativoExpectativa2022Resumo {
  totalExpectativa2026: number
  totalVotos2022: number
  delta: number
  deltaPercentual: number | null
  municipiosComDados: number
  cresceu: number
  manteve: number
  caiu: number
  semDados: number
}

export function summarizeComparativoExpectativa2022(
  rows: ComparativoExpectativa2022Row[]
): ComparativoExpectativa2022Resumo {
  const totalExpectativa2026 = rows.reduce((s, r) => s + r.expectativa2026, 0)
  const totalVotos2022 = rows.reduce((s, r) => s + r.votos2022, 0)
  const delta = totalExpectativa2026 - totalVotos2022
  const deltaPercentual = totalVotos2022 > 0 ? (delta / totalVotos2022) * 100 : null

  return {
    totalExpectativa2026,
    totalVotos2022,
    delta,
    deltaPercentual,
    municipiosComDados: rows.filter((r) => r.tendencia !== 'sem-dados').length,
    cresceu: rows.filter((r) => r.tendencia === 'cresceu').length,
    manteve: rows.filter((r) => r.tendencia === 'manteve').length,
    caiu: rows.filter((r) => r.tendencia === 'caiu').length,
    semDados: rows.filter((r) => r.tendencia === 'sem-dados').length,
  }
}
export function agregarExpectativaPorCidade(
  liderancas: Array<Record<string, unknown>>,
  cidadeCol: string,
  expectativaCol: string,
  normalizeNumber: (value: unknown) => number
): Map<string, number> {
  const map = new Map<string, number>()

  liderancas.forEach((lider) => {
    const cidade = String(lider[cidadeCol] || '').trim()
    if (!cidade) return
    const key = normalizeMunicipioNome(cidade)
    const valor = normalizeNumber(lider[expectativaCol])
    if (valor <= 0) return
    map.set(key, (map.get(key) || 0) + valor)
  })

  return map
}

/** @deprecated use agregarExpectativaPorCidade */
export const agregarExpectativaJadyelPorCidade = agregarExpectativaPorCidade

export function agregarLiderancasPorCidade(
  liderancas: Array<Record<string, unknown>>,
  cidadeCol: string
): Map<string, number> {
  const map = new Map<string, number>()

  liderancas.forEach((lider) => {
    const cidade = String(lider[cidadeCol] || '').trim()
    if (!cidade) return
    const key = normalizeMunicipioNome(cidade)
    map.set(key, (map.get(key) || 0) + 1)
  })

  return map
}
