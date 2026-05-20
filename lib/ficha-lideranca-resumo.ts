import {
  calcularResumoMac,
  calcularResumoPap,
  calcularResumoSuas,
  filtrarPropostasFns,
  type PropostaFns,
  type ResumoTeto,
} from '@/lib/fns-tetos-saldo'
import type { EmendaRegistro } from '@/lib/emendas-filtro'
import type { LimitesMunicipioResponse } from '@/lib/limites-tetos-types'
import {
  filtrarDeputadoEstadual2022,
  filtrarDeputadoFederal2022,
  filtrarPrefeito2024,
  filtrarVereador2024,
  includesNormalizedCargo,
  parseVotosEleicao,
  type ResultadoEleicao,
} from '@/lib/resumo-eleicoes-dados'
import type { ClassificacaoSuas } from '@/lib/suas-porte'
import {
  resolverCargoFotoCandidato,
  type CargoFotoCandidato,
} from '@/lib/candidatos-foto-divulgacand'

export interface LinhaRecursoFns {
  descricao: string
  tipoRecurso: string
  valor: number
  situacao: string
  mac: boolean
}

export interface TotaisEmendaExercicio {
  exercicio: number
  valorIndicado: number
  valorEmpenhado: number
  valorPago: number
  itens: EmendaRegistro[]
}

export const EXERCICIOS_EMENDAS_FICHA = [2025, 2026] as const

function somarCampoEmendas(
  itens: EmendaRegistro[],
  campo: 'valor_indicado' | 'valor_empenhado' | 'valor_pago',
): number {
  return itens.reduce((acc, e) => {
    const n = Number(e[campo])
    return Number.isFinite(n) ? acc + n : acc
  }, 0)
}

export interface DadosFichaLideranca {
  resumoMac: ResumoTeto
  resumoPap: ResumoTeto
  resumoSuas: ResumoTeto
  classificacaoSuas: ClassificacaoSuas
  populacao: number | null
  exercicioAtivo: number
  prefeitos: ResultadoEleicao[]
  vereadores: ResultadoEleicao[]
  depFederal: ResultadoEleicao[]
  depEstadual: ResultadoEleicao[]
  emendasMunicipio: EmendaRegistro[]
  propostasFns: PropostaFns[]
  linhasFns: LinhaRecursoFns[]
  totaisEmendasPorExercicio: TotaisEmendaExercicio[]
}

export function formatarMoedaFicha(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarSaldoFicha(saldo: number | null): string {
  if (saldo == null) return '—'
  if (saldo <= 0) return 'ATINGIU TETO'
  return formatarMoedaFicha(saldo)
}

export function rotuloCargoFicha(
  cargo: CargoFotoCandidato,
  candidato?: Pick<ResultadoEleicao, 'cargo' | 'anoEleicao'> | null,
): string {
  const cargoEfetivo = candidato
    ? resolverCargoFotoCandidato(candidato, cargo)
    : cargo
  const ano = candidato?.anoEleicao?.trim() || '2024'
  const base = cargoEfetivo === 'prefeito' ? 'PREFEITO(A)' : 'VEREADOR(A)'
  return `${base} ${ano}`
}

export function situacaoEleicaoCandidato(item: ResultadoEleicao): string {
  if (includesNormalizedCargo(item.situacao, 'eleito')) return 'Eleito'
  if (includesNormalizedCargo(item.situacao, 'suplente')) return 'Suplente'
  return 'Oposição'
}

export function percentualVotosCandidato(
  candidato: ResultadoEleicao,
  listaMesmoCargo: ResultadoEleicao[],
): string {
  const raw = candidato.percentualVotosValidos?.trim()
  if (raw) {
    return raw.includes('%') ? raw : `${raw}%`
  }
  const total = listaMesmoCargo.reduce(
    (acc, c) => acc + parseVotosEleicao(c.quantidadeVotosNominais),
    0,
  )
  const votos = parseVotosEleicao(candidato.quantidadeVotosNominais)
  if (total <= 0) return '—'
  return `${((votos / total) * 100).toFixed(2).replace('.', ',')}%`
}

export function agruparEmendasPorExercicio(emendas: EmendaRegistro[]): TotaisEmendaExercicio[] {
  const map = new Map<number, EmendaRegistro[]>()
  for (const e of emendas) {
    const ex = e.exercicio ?? 0
    if (!ex) continue
    const arr = map.get(ex) ?? []
    arr.push(e)
    map.set(ex, arr)
  }
  return Array.from(map.entries())
    .map(([exercicio, itens]) => ({
      exercicio,
      valorIndicado: somarCampoEmendas(itens, 'valor_indicado'),
      valorEmpenhado: somarCampoEmendas(itens, 'valor_empenhado'),
      valorPago: somarCampoEmendas(itens, 'valor_pago'),
      itens,
    }))
    .sort((a, b) => a.exercicio - b.exercicio)
}

/** Totais por exercício para a ficha (2025 e 2026, com zeros se vazio). */
export function totaisEmendasFichaPorExercicio(
  emendas: EmendaRegistro[],
  exercicios: readonly number[] = EXERCICIOS_EMENDAS_FICHA,
): TotaisEmendaExercicio[] {
  const agrupados = agruparEmendasPorExercicio(emendas)
  const porEx = new Map(agrupados.map((t) => [t.exercicio, t]))
  return exercicios.map((exercicio) => {
    const found = porEx.get(exercicio)
    if (found) return found
    return {
      exercicio,
      valorIndicado: 0,
      valorEmpenhado: 0,
      valorPago: 0,
      itens: [],
    }
  })
}

export function listarLinhasPropostasFns(propostas: PropostaFns[]): LinhaRecursoFns[] {
  return filtrarPropostasFns(propostas)
    .map((p) => ({
      descricao: p.coTipoProposta || p.nuProposta,
      tipoRecurso: p.dsTipoRecurso || '—',
      valor: p.vlProposta || 0,
      situacao: p.dsSituacaoProposta || '—',
      mac: Boolean(p.coTipoProposta?.toUpperCase().includes('MAC')),
    }))
    .sort((a, b) => b.valor - a.valor)
}

export function montarDadosFichaLideranca(params: {
  resultadosEleicao: ResultadoEleicao[]
  limitesDb: LimitesMunicipioResponse | null
  propostasFns: PropostaFns[]
  emendasMunicipio: EmendaRegistro[]
  classificacaoSuas: ClassificacaoSuas
  populacao: number | null
  exercicioAtivo: number | null
  totalSuasPropostas: number
  totalSuasPagar: number
}): DadosFichaLideranca {
  const exercicioAtivo = params.exercicioAtivo ?? 2025
  const limites = params.limitesDb
  const propostas = filtrarPropostasFns(params.propostasFns)
  const limiteMac = limites?.mac?.valor ?? null
  const limitePap = limites?.pap?.valor ?? null
  const tetoSuas = params.classificacaoSuas.valorNumerico

  return {
    resumoMac: calcularResumoMac(propostas, limiteMac),
    resumoPap: calcularResumoPap(propostas, limitePap),
    resumoSuas: calcularResumoSuas(tetoSuas, params.totalSuasPropostas, params.totalSuasPagar),
    classificacaoSuas: params.classificacaoSuas,
    populacao: params.populacao,
    exercicioAtivo,
    prefeitos: filtrarPrefeito2024(params.resultadosEleicao),
    vereadores: filtrarVereador2024(params.resultadosEleicao),
    depFederal: filtrarDeputadoFederal2022(params.resultadosEleicao),
    depEstadual: filtrarDeputadoEstadual2022(params.resultadosEleicao),
    emendasMunicipio: params.emendasMunicipio,
    propostasFns: propostas,
    linhasFns: listarLinhasPropostasFns(params.propostasFns),
    totaisEmendasPorExercicio: totaisEmendasFichaPorExercicio(params.emendasMunicipio),
  }
}
