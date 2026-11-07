import { selecionarMelhorPorNome } from '@/lib/candidato-nome-correspondencia'
import {
  JADYEL_URNA_DEP_FEDERAL_2022,
  JADYEL_URNA_DEP_FEDERAL_2026,
} from '@/lib/jadyel-federal-2022-pi-votos'
import { chaveMatchFromResumo } from '@/lib/candidato-votacao-secao-match'
import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'
import {
  cargoAnoKey,
  normalizarNomeCargo,
  type VotacaoSecaoAno,
} from '@/lib/votacao-secao'
import type { CandidatoMatrizColuna } from '@/lib/votacao-secao-matriz'

export const ANO_VEREADOR_COMPARACAO = 2024 as const satisfies VotacaoSecaoAno
export const ANO_JADYEL_DEP_FEDERAL = 2026 as const satisfies VotacaoSecaoAno
export const ANO_DEP_ESTADUAL_LIDERANCA = 2026 as const satisfies VotacaoSecaoAno
export const CARGO_JADYEL = 'Deputado Federal'
export const CARGO_VEREADOR = 'Vereador'
export const CARGO_DEP_ESTADUAL = 'Deputado Estadual'

export const ANOS_COMPARACAO_VEREADOR_JADYEL: VotacaoSecaoAno[] = [
  ANO_VEREADOR_COMPARACAO,
  ANO_JADYEL_DEP_FEDERAL,
]

/** Anos necessários para vereador 2024 + Jadyel federal 2026 + dep. estadual 2026. */
export const ANOS_COMPARACAO_VEREADOR_TRIPLA: VotacaoSecaoAno[] = [
  ANO_VEREADOR_COMPARACAO,
  ANO_JADYEL_DEP_FEDERAL,
]

export const CARGOS_COMPARACAO_VEREADOR_JADYEL = [
  cargoAnoKey(ANO_VEREADOR_COMPARACAO, CARGO_VEREADOR),
  cargoAnoKey(ANO_JADYEL_DEP_FEDERAL, CARGO_JADYEL),
] as const

export const CARGOS_COMPARACAO_VEREADOR_TRIPLA = [
  cargoAnoKey(ANO_VEREADOR_COMPARACAO, CARGO_VEREADOR),
  cargoAnoKey(ANO_JADYEL_DEP_FEDERAL, CARGO_JADYEL),
  cargoAnoKey(ANO_DEP_ESTADUAL_LIDERANCA, CARGO_DEP_ESTADUAL),
] as const

export function nmVotavelIndicaJadyel(nmVotavel: string): boolean {
  const n = nmVotavel.trim().toUpperCase()
  if (!n.includes('JADYEL')) return false
  return (
    n === JADYEL_URNA_DEP_FEDERAL_2026.toUpperCase() ||
    n.includes('ALENCAR') ||
    n.includes('JUPI') ||
    n.includes('SILVA') ||
    n === JADYEL_URNA_DEP_FEDERAL_2022.toUpperCase()
  )
}

export function isJadyelDepFederal(
  c: Pick<CandidatoMatrizColuna, 'nmVotavel' | 'dsCargo' | 'anoEleicao'>,
): boolean {
  return (
    c.anoEleicao === ANO_JADYEL_DEP_FEDERAL &&
    normalizarNomeCargo(c.dsCargo) === CARGO_JADYEL &&
    nmVotavelIndicaJadyel(c.nmVotavel)
  )
}

/** @deprecated use isJadyelDepFederal */
export const isJadyelDepFederal2022 = isJadyelDepFederal

export function isVereador2024(
  c: Pick<CandidatoMatrizColuna, 'dsCargo' | 'anoEleicao'>,
): boolean {
  return (
    c.anoEleicao === ANO_VEREADOR_COMPARACAO &&
    normalizarNomeCargo(c.dsCargo) === CARGO_VEREADOR
  )
}

export function isVereadorResumo2024(
  item: Pick<
    ResultadoEleicao,
    'anoEleicao' | 'cargo' | 'codigoCargo' | 'numeroUrna' | 'sequencialCandidato'
  >,
): boolean {
  const chave = chaveMatchFromResumo(item)
  return (
    chave != null &&
    chave.ano === ANO_VEREADOR_COMPARACAO &&
    normalizarNomeCargo(chave.dsCargo) === CARGO_VEREADOR
  )
}

export function deveCompararVereadorComJadyel(
  cargo: string | null | undefined,
  nrPreselecao: number | null | undefined,
): boolean {
  return (
    nrPreselecao != null &&
    nrPreselecao > 0 &&
    normalizarNomeCargo(cargo ?? '') === CARGO_VEREADOR
  )
}

export function encontrarJadyelDepFederal(
  candidatos: readonly CandidatoMatrizColuna[],
): CandidatoMatrizColuna | null {
  return candidatos.find(isJadyelDepFederal) ?? null
}

export function isDepEstadualLideranca(
  c: Pick<CandidatoMatrizColuna, 'dsCargo' | 'anoEleicao'>,
): boolean {
  return (
    c.anoEleicao === ANO_DEP_ESTADUAL_LIDERANCA &&
    normalizarNomeCargo(c.dsCargo) === CARGO_DEP_ESTADUAL
  )
}

/** @deprecated use isDepEstadualLideranca */
export const isDepEstadual2022 = isDepEstadualLideranca

export function encontrarDepEstadualPorNome(
  candidatos: readonly CandidatoMatrizColuna[],
  nomeAlvo: string | null | undefined,
): CandidatoMatrizColuna | null {
  const alvo = String(nomeAlvo ?? '').trim()
  if (!alvo) return null

  const pool = candidatos.filter(isDepEstadualLideranca)
  return selecionarMelhorPorNome(pool, [alvo])
}

export function listarDepEstaduaisLiderancaSecao(
  candidatos: readonly CandidatoMatrizColuna[],
): CandidatoMatrizColuna[] {
  return [...candidatos.filter(isDepEstadualLideranca)].sort(
    (a, b) => b.totalVotos - a.totalVotos || a.nmVotavel.localeCompare(b.nmVotavel, 'pt-BR'),
  )
}

/** @deprecated use listarDepEstaduaisLiderancaSecao */
export const listarDepEstaduais2022Secao = listarDepEstaduaisLiderancaSecao

export function idsComparacaoVereadorComDepId(
  vereadorId: string,
  candidatos: readonly CandidatoMatrizColuna[],
  depEstadualId?: string | null,
): string[] {
  const ids: string[] = [vereadorId]

  const jadyel = encontrarJadyelDepFederal(candidatos)
  if (jadyel) ids.push(jadyel.id)

  if (depEstadualId && !ids.includes(depEstadualId)) ids.push(depEstadualId)

  return ids
}

export function idsComparacaoVereadorTripla(
  vereadorId: string,
  candidatos: readonly CandidatoMatrizColuna[],
  nomeDepEstadualLideranca?: string | null,
): string[] {
  const depEst = encontrarDepEstadualPorNome(candidatos, nomeDepEstadualLideranca)
  return idsComparacaoVereadorComDepId(vereadorId, candidatos, depEst?.id ?? null)
}

export function idsComparacaoVereadorEJadyel(
  vereadorId: string,
  candidatos: readonly CandidatoMatrizColuna[],
): string[] {
  const jadyel = encontrarJadyelDepFederal(candidatos)
  return jadyel ? [vereadorId, jadyel.id] : [vereadorId]
}

export function completarSelecaoVereadorComparativos(
  ids: readonly string[],
  candidatos: readonly CandidatoMatrizColuna[],
  nomeDepEstadualLideranca?: string | null,
): string[] {
  const selecionados = candidatos.filter((c) => ids.includes(c.id))
  if (!selecionados.some(isVereador2024)) return [...ids]

  let next = [...ids]
  const jadyel = encontrarJadyelDepFederal(candidatos)
  if (jadyel && !next.includes(jadyel.id)) next.push(jadyel.id)

  const depEst = encontrarDepEstadualPorNome(candidatos, nomeDepEstadualLideranca)
  if (depEst && !next.includes(depEst.id)) next.push(depEst.id)

  return next
}

/** @deprecated use completarSelecaoVereadorComparativos */
export function completarSelecaoVereadorJadyel(
  ids: readonly string[],
  candidatos: readonly CandidatoMatrizColuna[],
): string[] {
  return completarSelecaoVereadorComparativos(ids, candidatos, null)
}

export function selecaoTemVereadorSemJadyel(
  ids: readonly string[],
  candidatos: readonly CandidatoMatrizColuna[],
): boolean {
  const selecionados = candidatos.filter((c) => ids.includes(c.id))
  if (!selecionados.some(isVereador2024)) return false
  const jadyel = encontrarJadyelDepFederal(candidatos)
  return Boolean(jadyel && !ids.includes(jadyel.id))
}
