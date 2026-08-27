/**
 * Comparativo de emendas — bancada federal do Piauí.
 * Fonte: Portal da Transparência (CSV Dados Abertos) × elenco Câmara.
 */

export type EmendasComparativoAnoKey = '2023' | '2024' | '2025' | '2026'

export type EmendasComparativoAnoBloc = {
  valorEmpenhado: number
  valorPago: number
  valorPix: number
  qtd: number
}

export type EmendasComparativoMunicipio = {
  municipio: string
  valorPago: number
  valorEmpenhado: number
  qtd: number
}

export type EmendasComparativoDeputado = {
  id: number
  nome: string
  partido: string
  foto: string
  rank: number
  /** Indicado/autorizado — só quando a fonte trouxer; Portal CSV atual não tem. */
  valorIndicado?: number
  valorEmpenhado: number
  valorLiquidado: number
  valorPago: number
  valorPix: number
  valorProjeto: number
  qtdEmendas: number
  porAno: Record<string, EmendasComparativoAnoBloc>
  municipiosTop: EmendasComparativoMunicipio[]
}

export type EmendasComparativoOrdenacao = 'pago' | 'empenhado' | 'indicado'

export function valorOrdenacaoEmenda(
  dep: EmendasComparativoDeputado,
  ordenacao: EmendasComparativoOrdenacao,
): number {
  if (ordenacao === 'empenhado') return dep.valorEmpenhado
  if (ordenacao === 'indicado') return dep.valorIndicado ?? 0
  return dep.valorPago
}

export function temValorIndicadoNoRanking(ranking: EmendasComparativoDeputado[]): boolean {
  return ranking.some((d) => (d.valorIndicado ?? 0) > 0)
}

/** Reordena o ranking e renumera a posição. */
export function sortEmendasComparativoRanking(
  ranking: EmendasComparativoDeputado[],
  ordenacao: EmendasComparativoOrdenacao,
): EmendasComparativoDeputado[] {
  return [...ranking]
    .sort((a, b) => {
      const by = valorOrdenacaoEmenda(b, ordenacao) - valorOrdenacaoEmenda(a, ordenacao)
      if (by !== 0) return by
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
    .map((dep, i) => ({ ...dep, rank: i + 1 }))
}

export type EmendasComparativoKpis = {
  valorPago: number
  valorEmpenhado: number
  valorPix: number
  valorProjeto: number
  qtdEmendas: number
  parlamentares: number
  valorMedio: number
}

export type EmendasComparativoPayload = {
  geradoEm: string
  fonte: string
  fonteUrl: string
  anos: string[]
  /** Ex.: Mandato 2023–2026 */
  periodoLabel?: string
  uf: string
  kpis: EmendasComparativoKpis
  ranking: EmendasComparativoDeputado[]
  disclaimer: string
}

export function formatEmendaBrl(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function formatEmendaBrlCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) {
    return `R$ ${(value / 1_000_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`
  }
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  }
  if (abs >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  }
  return formatEmendaBrl(value)
}

/** Filtra ranking por um ou mais anos (recalcula totais do período). */
export function filterEmendasComparativoPorAnos(
  payload: EmendasComparativoPayload,
  anos: string[],
): EmendasComparativoPayload {
  const anosDisponiveis = payload.anos.length > 0 ? payload.anos : Object.keys(payload.ranking[0]?.porAno ?? {})
  const selecionados =
    anos.length === 0
      ? anosDisponiveis
      : anos.filter((a) => anosDisponiveis.includes(a) || a in (payload.ranking[0]?.porAno ?? {}))

  const todosSelecionados =
    selecionados.length === anosDisponiveis.length &&
    anosDisponiveis.every((a) => selecionados.includes(a))

  if (todosSelecionados || selecionados.length === 0) {
    return { ...payload, anos: anosDisponiveis }
  }

  const empty = { valorEmpenhado: 0, valorPago: 0, valorPix: 0, qtd: 0 }

  const ranking = payload.ranking
    .map((dep) => {
      const bloco = selecionados.reduce(
        (acc, ano) => {
          const y = dep.porAno[ano] ?? empty
          return {
            valorEmpenhado: acc.valorEmpenhado + y.valorEmpenhado,
            valorPago: acc.valorPago + y.valorPago,
            valorPix: acc.valorPix + y.valorPix,
            qtd: acc.qtd + y.qtd,
          }
        },
        { ...empty },
      )
      return {
        ...dep,
        valorEmpenhado: bloco.valorEmpenhado,
        valorPago: bloco.valorPago,
        valorPix: bloco.valorPix,
        valorProjeto: Math.max(0, bloco.valorPago - bloco.valorPix),
        qtdEmendas: bloco.qtd,
      }
    })
    .sort((a, b) => b.valorPago - a.valorPago)
    .map((dep, i) => ({ ...dep, rank: i + 1 }))

  const qtd = ranking.reduce((s, r) => s + r.qtdEmendas, 0)
  const valorPago = ranking.reduce((s, r) => s + r.valorPago, 0)

  return {
    ...payload,
    anos: [...selecionados].sort(),
    ranking,
    kpis: {
      valorPago,
      valorEmpenhado: ranking.reduce((s, r) => s + r.valorEmpenhado, 0),
      valorPix: ranking.reduce((s, r) => s + r.valorPix, 0),
      valorProjeto: ranking.reduce((s, r) => s + r.valorProjeto, 0),
      qtdEmendas: qtd,
      parlamentares: ranking.filter((r) => r.qtdEmendas > 0).length,
      valorMedio: qtd > 0 ? valorPago / qtd : 0,
    },
  }
}

/** @deprecated Prefer filterEmendasComparativoPorAnos */
export function filterEmendasComparativoPorAno(
  payload: EmendasComparativoPayload,
  ano: string | 'todos',
): EmendasComparativoPayload {
  if (ano === 'todos') return filterEmendasComparativoPorAnos(payload, [])
  return filterEmendasComparativoPorAnos(payload, [ano])
}

export const EMENDAS_COMPARATIVO_ANOS_MANDATO: EmendasComparativoAnoKey[] = [
  '2023',
  '2024',
  '2025',
  '2026',
]
