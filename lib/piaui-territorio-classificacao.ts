import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'

/** Relativo aos demais TDs do Piauí (tercis por score). */
export type ClassificacaoTerritorioTd = 'estrategico' | 'atencao' | 'baixo-impacto'

/**
 * Divide os territórios em três faixas pelo `score` (maior = mais à direita no ranking “estratégico”).
 * Empates: desempate estável por nome do território.
 */
/** Tercis por score para chaves arbitrárias (ex.: municípios no drill do mapa digital IG). */
export function classificarChavesPorScore<K extends string>(
  itens: readonly { chave: K; score: number }[]
): Map<K, ClassificacaoTerritorioTd> {
  const out = new Map<K, ClassificacaoTerritorioTd>()
  if (itens.length === 0) return out

  const sorted = [...itens].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.chave.localeCompare(b.chave, 'pt-BR', { sensitivity: 'base' })
  })

  const n = sorted.length
  const nTop = Math.max(1, Math.ceil(n / 3))
  const nMid = Math.max(1, Math.ceil(n / 3))

  let i = 0
  for (; i < nTop && i < n; i++) {
    out.set(sorted[i].chave, 'estrategico')
  }
  const fimMeio = nTop + nMid
  for (; i < fimMeio && i < n; i++) {
    out.set(sorted[i].chave, 'atencao')
  }
  for (; i < n; i++) {
    out.set(sorted[i].chave, 'baixo-impacto')
  }
  return out
}

export function classificarTerritoriosPorScore(
  itens: readonly { territorio: TerritorioDesenvolvimentoPI; score: number }[]
): Map<TerritorioDesenvolvimentoPI, ClassificacaoTerritorioTd> {
  const mapped = itens.map((x) => ({ chave: x.territorio, score: x.score }))
  return classificarChavesPorScore(mapped)
}
