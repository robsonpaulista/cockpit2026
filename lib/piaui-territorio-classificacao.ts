import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'

/** Relativo aos demais TDs do Piauí (tercis por score). */
export type ClassificacaoTerritorioTd = 'estrategico' | 'atencao' | 'baixo-impacto'

/**
 * Divide os territórios em três faixas pelo `score` (maior = mais à direita no ranking “estratégico”).
 * Empates: desempate estável por nome do território.
 */
export function classificarTerritoriosPorScore(
  itens: readonly { territorio: TerritorioDesenvolvimentoPI; score: number }[]
): Map<TerritorioDesenvolvimentoPI, ClassificacaoTerritorioTd> {
  const out = new Map<TerritorioDesenvolvimentoPI, ClassificacaoTerritorioTd>()
  if (itens.length === 0) return out

  const sorted = [...itens].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.territorio.localeCompare(b.territorio, 'pt-BR', { sensitivity: 'base' })
  })

  const n = sorted.length
  const nTop = Math.max(1, Math.ceil(n / 3))
  const nMid = Math.max(1, Math.ceil(n / 3))

  let i = 0
  for (; i < nTop && i < n; i++) {
    out.set(sorted[i].territorio, 'estrategico')
  }
  const fimMeio = nTop + nMid
  for (; i < fimMeio && i < n; i++) {
    out.set(sorted[i].territorio, 'atencao')
  }
  for (; i < n; i++) {
    out.set(sorted[i].territorio, 'baixo-impacto')
  }
  return out
}
