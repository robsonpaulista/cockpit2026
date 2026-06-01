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

/** Lê um ou mais anos (?anos=2024,2022 ou ?ano=2024). */
export function parseVotacaoSecaoAnos(
  anosParam: string | null | undefined,
  anoLegacyParam?: string | null | undefined,
): VotacaoSecaoAno[] {
  const raw = anosParam?.trim() || anoLegacyParam?.trim()
  if (!raw) return [VOTACAO_SECAO_ANO_PADRAO]

  const parsed = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter(isVotacaoSecaoAno)

  const unique = [...new Set(parsed)].sort((a, b) => b - a) as VotacaoSecaoAno[]
  return unique.length > 0 ? unique : [VOTACAO_SECAO_ANO_PADRAO]
}

export function serializarAnosVotacaoSecao(anos: readonly VotacaoSecaoAno[]): string {
  return [...anos].sort((a, b) => b - a).join(',')
}

export function cargosVotacaoSecao(ano: VotacaoSecaoAno): readonly string[] {
  return VOTACAO_SECAO_CARGOS[ano]
}

/** Todos os pares ano+cargo para comparação multi-ano. */
export function listarCargosAno(anos: readonly VotacaoSecaoAno[]): { ano: VotacaoSecaoAno; cargo: string }[] {
  return anos.flatMap((ano) =>
    cargosVotacaoSecao(ano).map((cargo) => ({ ano, cargo })),
  )
}

export function cargoAnoKey(ano: VotacaoSecaoAno, cargo: string): string {
  return `${ano}|${cargo}`
}

export function parseCargoAnoKey(key: string): { ano: VotacaoSecaoAno; cargo: string } | null {
  const idx = key.indexOf('|')
  if (idx <= 0) return null
  const ano = parseVotacaoSecaoAno(key.slice(0, idx))
  const cargo = key.slice(idx + 1).trim()
  if (!cargo) return null
  return { ano, cargo }
}

export function rotuloCargoAno(key: string): string {
  const ref = parseCargoAnoKey(key)
  return ref ? `${ref.cargo} (${ref.ano})` : key
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

/** Lê cargos selecionados na URL. Chaves `ano|cargo` (multi) ou nome do cargo (ano único). */
export function parseCargosComparacaoParam(
  value: string | null | undefined,
  anos: readonly VotacaoSecaoAno[],
): string[] {
  const disponiveis =
    anos.length > 1
      ? listarCargosAno(anos).map(({ ano, cargo }) => cargoAnoKey(ano, cargo))
      : [...cargosVotacaoSecao(anos[0] ?? VOTACAO_SECAO_ANO_PADRAO)]

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
  /** Preenchido ao mesclar dados de vários anos na mesma seção. */
  anoEleicao?: number
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
  anosEleicao?: number[]
  nrTurno: number
  totalSecoes: number
  totalVotos: number
  cargos: string[]
}

export type MunicipioVotacaoSecaoRef = {
  chave: string
  nome: string
}
