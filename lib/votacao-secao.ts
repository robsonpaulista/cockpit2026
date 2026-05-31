/** Utilitários para votação por seção (TSE bweb PI). */

export const VOTACAO_SECAO_ANOS = [2024, 2022] as const
export type VotacaoSecaoAno = (typeof VOTACAO_SECAO_ANOS)[number]

export const VOTACAO_SECAO_ANO_PADRAO: VotacaoSecaoAno = 2024
export const VOTACAO_SECAO_TURNO = 1

/** Cargos disponíveis por ano eleitoral. */
export const VOTACAO_SECAO_CARGOS: Record<VotacaoSecaoAno, readonly string[]> = {
  2024: ['Prefeito', 'Vereador'],
  2022: ['Governador', 'Senador', 'Deputado Federal', 'Deputado Estadual'],
}

export function isVotacaoSecaoAno(value: unknown): value is VotacaoSecaoAno {
  return value === 2024 || value === 2022
}

export function parseVotacaoSecaoAno(value: string | null | undefined): VotacaoSecaoAno {
  const n = Number(value)
  return isVotacaoSecaoAno(n) ? n : VOTACAO_SECAO_ANO_PADRAO
}

export function cargosVotacaoSecao(ano: VotacaoSecaoAno): readonly string[] {
  return VOTACAO_SECAO_CARGOS[ano]
}

export function cargoPermiteSelecaoCandidatos(cargo: string): boolean {
  return (
    cargo === 'Vereador' ||
    cargo === 'Deputado Federal' ||
    cargo === 'Deputado Estadual'
  )
}

export type ModoComparacaoSecao = 'cargo' | 'comparar'

export function parseModoComparacaoSecao(value: string | null | undefined): ModoComparacaoSecao {
  if (value === 'comparar' || value === 'dobradinha') return 'comparar'
  return 'cargo'
}

/** Lê cargos selecionados na URL (?cargos=Dep+Federal,Senador). Default: todos do ano. */
export function parseCargosComparacaoParam(
  value: string | null | undefined,
  ano: VotacaoSecaoAno,
): string[] {
  const disponiveis = [...cargosVotacaoSecao(ano)]
  if (!value?.trim()) return disponiveis

  const parsed = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const valid = parsed.filter((c) => disponiveis.includes(c))
  return valid.length > 0 ? valid : disponiveis
}

export function serializarCargosComparacao(cargos: readonly string[]): string {
  return cargos.join(',')
}

/** Normaliza DS_CARGO do bweb (2022 em MAIÚSCULAS) para o rótulo da UI. */
export function normalizarNomeCargo(dsCargo: string): string {
  const texto = (dsCargo || '').trim()
  if (!texto) return texto
  if (texto === texto.toUpperCase()) {
    return texto
      .toLowerCase()
      .split(' ')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ')
  }
  return texto
}

export function cargoMatch(dsCargo: string, cargoUi: string): boolean {
  return normalizarNomeCargo(dsCargo).toLowerCase() === cargoUi.trim().toLowerCase()
}

/** @deprecated use VOTACAO_SECAO_ANO_PADRAO */
export const VOTACAO_SECAO_ANO = VOTACAO_SECAO_ANO_PADRAO

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
