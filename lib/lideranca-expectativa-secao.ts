import { scoreCorrespondenciaNomeCandidato } from '@/lib/candidato-nome-correspondencia'
import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'
import type {
  CandidatoMatrizColuna,
  LinhaMatrizSecao,
  MatrizVotacaoSecao,
} from '@/lib/votacao-secao-matriz'

export const CANDIDATO_EXPECTATIVA_LIDERANCA_ID = 'expectativa:lideranca:2026'

export type CenarioVotosLideranca = 'aferido_jadyel' | 'promessa_lideranca' | 'legado_anterior'

export type LiderancaExpectativaSecao = {
  nome: string
  cargo: string
  depEstadual?: string
  projecaoAferida: number
  projecaoPromessa: number
  projecaoLegado: number
}

export function expectativaVotosLideranca(
  lideranca: Pick<
    LiderancaExpectativaSecao,
    'projecaoAferida' | 'projecaoPromessa' | 'projecaoLegado'
  >,
  cenario: CenarioVotosLideranca,
): number {
  if (cenario === 'promessa_lideranca') return Math.round(lideranca.projecaoPromessa || 0)
  if (cenario === 'legado_anterior') return Math.round(lideranca.projecaoLegado || 0)
  return Math.round(lideranca.projecaoAferida || 0)
}

function extrairNomeDoCargo(cargoTexto: string, padrao: RegExp): string | null {
  const match = cargoTexto.match(padrao)
  const nome = match?.[1]?.trim()
  return nome ? nome : null
}

/** Alvos de nome para match vereador ↔ liderança (mesma lógica do botão Marcar). */
export function alvosVereadorLideranca(lideranca: Pick<LiderancaExpectativaSecao, 'nome' | 'cargo'>): string[] {
  const cargoBruto = String(lideranca.cargo || '')
  const alvos: string[] = []

  const verNome = extrairNomeDoCargo(
    cargoBruto,
    /(?:vereador(?:a)?)\s*:?\s*([^|;·]+?)(?=\s{2,}|[|;·]|$)/i,
  )
  if (verNome) alvos.push(verNome)

  const cargoNorm = cargoBruto.toLowerCase()
  if (cargoNorm.includes('vereador') && alvos.length === 0) {
    alvos.push(lideranca.nome)
  }

  if (alvos.length === 0) {
    alvos.push(lideranca.nome)
  }

  return [...new Set(alvos.filter(Boolean))]
}

export function scoreVereadorLideranca(
  vereador: Pick<ResultadoEleicao, 'nomeUrnaCandidato'>,
  lideranca: Pick<LiderancaExpectativaSecao, 'nome' | 'cargo'>,
): number {
  const alvos = alvosVereadorLideranca(lideranca)
  let melhor = 0
  for (const alvo of alvos) {
    melhor = Math.max(melhor, scoreCorrespondenciaNomeCandidato(vereador.nomeUrnaCandidato, alvo))
  }
  return melhor
}

export function encontrarLiderancaDoVereador(
  liderancas: readonly LiderancaExpectativaSecao[],
  vereador: Pick<ResultadoEleicao, 'nomeUrnaCandidato' | 'numeroUrna'>,
  scoreMinimo = 75,
): LiderancaExpectativaSecao | null {
  let melhor: LiderancaExpectativaSecao | null = null
  let melhorScore = 0

  for (const l of liderancas) {
    const score = scoreVereadorLideranca(vereador, l)
    if (score > melhorScore) {
      melhorScore = score
      melhor = l
    }
  }

  return melhorScore >= scoreMinimo ? melhor : null
}

/** Distribui expectativa inteira proporcionalmente aos votos do candidato referência por seção. */
export function distribuirExpectativaProporcionalSecao(
  totalExpectativa: number,
  linhas: readonly LinhaMatrizSecao[],
  candidatoIdReferencia: string,
): Map<string, number> {
  const out = new Map<string, number>()
  if (totalExpectativa <= 0 || linhas.length === 0) return out

  const itens = linhas.map((l) => {
    const peso = l.votos[candidatoIdReferencia] ?? 0
    return { localId: l.localId, peso }
  })

  const totalPeso = itens.reduce((s, i) => s + i.peso, 0)
  if (totalPeso <= 0) return out

  const quotas = itens
    .filter((i) => i.peso > 0)
    .map((i) => {
      const exact = (totalExpectativa * i.peso) / totalPeso
      const floor = Math.floor(exact)
      return { localId: i.localId, floor, remainder: exact - floor }
    })

  let restante = totalExpectativa - quotas.reduce((s, q) => s + q.floor, 0)
  quotas.sort((a, b) => b.remainder - a.remainder)

  for (let i = 0; i < quotas.length; i++) {
    const bonus = i < restante ? 1 : 0
    out.set(quotas[i].localId, quotas[i].floor + bonus)
  }

  for (const i of itens) {
    if (i.peso <= 0) out.set(i.localId, 0)
  }

  return out
}

export function injetarColunaExpectativaLideranca(
  matriz: MatrizVotacaoSecao,
  params: {
    nomeLideranca: string
    totalExpectativa: number
    candidatoIdReferencia: string
    rotuloCargo?: string
  } | null,
): MatrizVotacaoSecao {
  if (!params || params.totalExpectativa <= 0 || !params.candidatoIdReferencia) {
    return matriz
  }

  const porSecao = distribuirExpectativaProporcionalSecao(
    params.totalExpectativa,
    matriz.linhas,
    params.candidatoIdReferencia,
  )

  if (porSecao.size === 0) return matriz

  const totalDistribuido = [...porSecao.values()].reduce((s, v) => s + v, 0)

  const candidatoExtra: CandidatoMatrizColuna = {
    id: CANDIDATO_EXPECTATIVA_LIDERANCA_ID,
    dsCargo: params.rotuloCargo ?? 'Expectativa 2026',
    nrVotavel: 0,
    nmVotavel: params.nomeLideranca,
    totalVotos: totalDistribuido,
    anoEleicao: 2026,
  }

  const linhas = matriz.linhas.map((l) => ({
    ...l,
    votos: {
      ...l.votos,
      [CANDIDATO_EXPECTATIVA_LIDERANCA_ID]: porSecao.get(l.localId) ?? 0,
    },
  }))

  return {
    candidatos: [...matriz.candidatos, candidatoExtra],
    linhas,
  }
}

export function isColunaExpectativaLideranca(candidatoId: string): boolean {
  return candidatoId === CANDIDATO_EXPECTATIVA_LIDERANCA_ID
}
