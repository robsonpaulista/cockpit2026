/** Detecta o partido Republicanos na chapa (nome completo, sigla REPUB, coligações). */

const NOME_COMPLETO = 'REPUBLICANOS'

export function normalizarNomePartidoChapa(nome: string | null | undefined): string {
  return (nome ?? '').trim().toUpperCase()
}

export function nomePartidoEhRepublicanos(nome: string): boolean {
  const n = normalizarNomePartidoChapa(nome)
  if (!n || n === 'LEGENDA' || n === 'VOTOS LEGENDA') return false

  const comPrefixoColigacao = (sigla: string) =>
    n === sigla ||
    n.startsWith(`${sigla}/`) ||
    n.startsWith(`${sigla} /`) ||
    n.startsWith(`${sigla}-`) ||
    n.startsWith(`${sigla} -`)

  if (comPrefixoColigacao('REPUB')) return true
  if (comPrefixoColigacao(NOME_COMPLETO)) return true
  if (n === 'REPUBLICANO' || n.startsWith('REPUBLICANO ')) return true
  return false
}

export function encontrarPartidoRepublicanos<T extends { nome: string }>(partidos: T[]): T | undefined {
  return partidos.find((p) => nomePartidoEhRepublicanos(p.nome))
}
