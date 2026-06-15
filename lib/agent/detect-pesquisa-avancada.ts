import type { AgentClassifiedIntent } from '@/lib/agent/types'
import { extractCityNameFromQuery, isInvalidCityCandidate } from '@/lib/agent/city-extract'
import { queryMentionsJadyelAlencar } from '@/lib/agent/format-pesquisas'
import { CANDIDATO_RESUMO_PESQUISAS } from '@/lib/resumo-operacional-pesquisas'

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Evolução temporal / gráfico de intenção de voto. */
export function isPesquisaTendenciaQuery(query: string): boolean {
  const q = norm(query)
  if (/\b(instagram|insta|seguidor|rede\s+social)\b/.test(q)) return false

  const temMarcadorTendencia =
    /\b(tendencia|evolucao|grafico|historico|linha|serie|curva)\b/.test(q) ||
    /\bcomo\s+(esta|esta|evoluiu|mudou|cresceu|andou)\b/.test(q) ||
    /\b(subiu|caiu|cresceu|oscilou|melhorou|piorou)\b/.test(q)

  if (!temMarcadorTendencia) return false

  const temContextoPesquisa =
    /\b(pesquisa|pesquisas|intencao|intencao|voto|votos)\b/.test(q) ||
    queryMentionsJadyelAlencar(query)

  if (temContextoPesquisa) return true

  // «evolução em Teresina» sem citar «intenção» explicitamente
  return /\b(em|na|no)\s+[a-z]/.test(q)
}

/** Ranking estimulada dep. federal (API dedicada). */
export function isRankingEstimuladaFederalQuery(query: string): boolean {
  const q = norm(query)
  if (/\branking\s+estimulada\b/.test(q)) return true
  if (!/\b(ranking|colocacao|posicao|lugar)\b/.test(q)) return false
  return /\b(estimulada|federal|dep\.?\s*federal)\b/.test(q)
}

function resolveCandidatoArg(query: string): string | undefined {
  if (queryMentionsJadyelAlencar(query)) return CANDIDATO_RESUMO_PESQUISAS
  return undefined
}

/** Cidade na mesma frase ou em args (Groq). */
export function resolveCidadeTendenciaPesquisa(query: string, argsCidade?: string): string | undefined {
  const fromArgs = argsCidade?.trim()
  if (fromArgs && !isInvalidCityCandidate(fromArgs)) return fromArgs

  const extracted = extractCityNameFromQuery(query)
  if (extracted && !isInvalidCityCandidate(extracted)) return extracted

  return undefined
}

export function detectPesquisaTendenciaIntent(message: string): AgentClassifiedIntent | null {
  if (!isPesquisaTendenciaQuery(message)) return null

  const args: Record<string, string> = { termo: message.slice(0, 120) }
  const candidato = resolveCandidatoArg(message)
  if (candidato) args.candidato = candidato

  const cidade = resolveCidadeTendenciaPesquisa(message)
  if (cidade) args.cidade = cidade

  return { intent: 'consultar_pesquisa_tendencia', args }
}

export function detectRankingEstimuladaFederalIntent(message: string): AgentClassifiedIntent | null {
  if (!isRankingEstimuladaFederalQuery(message)) return null

  const args: Record<string, string> = { termo: message.slice(0, 120) }
  const candidato = resolveCandidatoArg(message)
  if (candidato) args.candidato = candidato

  return { intent: 'consultar_ranking_estimulada_federal', args }
}
