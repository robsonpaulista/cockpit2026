/**
 * Critério alinhado ao filtro "perfil militar" do histórico federal (nome de urna / lista).
 */

export function normalizarBuscaNomePerfilMilitar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const TERMINOS_PERFIL_MILITAR = [
  'coronel',
  'tenente-coronel',
  'tenente coronel',
  'tenente',
  'major',
  'capitão',
  'capitao',
  'aspirante',
  'subtenente',
  'sargento',
  'cabo',
  'soldado',
  'delegado',
  'almirante',
  'brigadeiro',
  'general',
  'marechal',
  'comandante',
  'policial militar',
  'policial federal',
  'bombeiro militar',
  'guarda municipal',
  'exercito',
  'marinha',
  'aeronautica',
  'pm ',
  ' p.m.',
] as const

const TERMINOS_NORMALIZADOS = TERMINOS_PERFIL_MILITAR.map(normalizarBuscaNomePerfilMilitar)

export function nomeIndicaPerfilMilitar(nome: string): boolean {
  const n = normalizarBuscaNomePerfilMilitar(nome)
  return TERMINOS_NORMALIZADOS.some((termo) => n.includes(termo))
}

/** Planilha 2022: considera urna ou nome civil. */
export function candidatoEleicaoIndicaPerfilMilitar(nomeUrna: string, nomeCivil: string): boolean {
  return nomeIndicaPerfilMilitar(nomeUrna) || nomeIndicaPerfilMilitar(nomeCivil)
}
