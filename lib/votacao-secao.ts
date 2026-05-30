/** Utilitários para votação por seção (TSE 2024 PI). */

export const VOTACAO_SECAO_ANO = 2024
export const VOTACAO_SECAO_TURNO = 1

/** Mesma regra do import Python: remove acentos e pontuação, colapsa espaços. */
export function normalizeMunicipioChaveVotacao(nome: string): string {
  return (nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function normalizeMunicipioComparacao(nome: string): string {
  return normalizeMunicipioChaveVotacao(nome)
}

export type VotacaoSecaoResultado = {
  cdCargo: number
  dsCargo: string
  nrVotavel: number
  nmVotavel: string
  sqCandidato: number | null
  qtVotos: number
}

export type VotacaoSecaoItem = {
  localId: string
  nrZona: number
  nrSecao: number
  nrLocalVotacao: number | null
  nmLocalVotacao: string | null
  dsEndereco: string | null
  nmBairro: string | null
  totalVotos: number
  resultados: VotacaoSecaoResultado[]
}

export type VotacaoSecaoResumo = {
  municipio: string
  anoEleicao: number
  nrTurno: number
  totalSecoes: number
  totalVotos: number
  cargos: string[]
}

export type MunicipioVotacaoSecaoRef = {
  chave: string
  nome: string
}
