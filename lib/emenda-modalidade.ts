/** Modalidade de emenda parlamentar (teto MAC/PAP). */

export type ModalidadeLimite = 'individual' | 'coletiva'

export const MODALIDADES_LIMITE: ModalidadeLimite[] = ['individual', 'coletiva']

export const MODALIDADE_LIMITE_LABEL: Record<ModalidadeLimite, string> = {
  individual: 'Individual',
  coletiva: 'Coletiva',
}

export function isModalidadeLimite(v: string): v is ModalidadeLimite {
  return v === 'individual' || v === 'coletiva'
}

function normalizarTextoEmenda(valor: string): string {
  return valor
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Classifica proposta (coluna Recurso) para confronto com o teto da mesma modalidade. */
export function inferirModalidadePropostaFns(campos: {
  dsTipoRecurso?: string
  coTipoProposta?: string
}): ModalidadeLimite | null {
  const recurso = normalizarTextoEmenda(campos.dsTipoRecurso ?? '')
  if (!recurso) return null
  if (recurso.includes('COMISSAO') || recurso.includes('BANCADA')) return 'coletiva'
  if (recurso.includes('INDIVIDUAL')) return 'individual'
  return null
}

export function isPropostaTipoMac(coTipoProposta?: string): boolean {
  const tipo = normalizarTextoEmenda(coTipoProposta ?? '')
  return tipo.includes('MAC')
}

export function isPropostaTipoPap(coTipoProposta?: string): boolean {
  const tipo = normalizarTextoEmenda(coTipoProposta ?? '')
  return tipo.includes('PAP')
}
