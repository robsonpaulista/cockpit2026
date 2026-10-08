/**
 * Candidatos de 2026 que já disputaram alguma eleição anterior em qualquer município do PI.
 * Chave: nome civil normalizado (mesma regra de `movimentosCandidatos`).
 */
export async function fetchCandidatos2026ComHistorico(): Promise<Set<string> | null> {
  const res = await fetch('/api/resumo-eleicoes?totals=candidatos2026ComHistorico')
  if (!res.ok) return null
  const data = (await res.json()) as { chaves?: string[] }
  return new Set(data.chaves ?? [])
}
