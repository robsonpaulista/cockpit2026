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

/** Classifica proposta FNS para confronto com o teto da mesma modalidade. */
export function inferirModalidadePropostaFns(campos: {
  dsTipoRecurso?: string
  coTipoProposta?: string
}): ModalidadeLimite {
  const texto = `${campos.dsTipoRecurso ?? ''} ${campos.coTipoProposta ?? ''}`.toUpperCase()
  if (texto.includes('COLETIV')) return 'coletiva'
  return 'individual'
}
