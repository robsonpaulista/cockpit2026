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

function isChapaSimulationQuery(q: string): boolean {
  return /\b(chapa|d'?hondt|dhondt|simulad|vagas?\s+(na|da|de)?\s*chapa|projecao\s+chapa)\b/.test(q)
}

function hasFederalDeputyContext(q: string): boolean {
  return (
    /\bdeputad[oa]s?\s+federais?\b/.test(q) ||
    /\bdep\.?\s*federais?\b/.test(q) ||
    (/\bfederais?\b/.test(q) && /\b(eleitos?|eleger|deputad|dep\.?)\b/.test(q))
  )
}

function hasEstimuladaContext(q: string): boolean {
  return (
    /\bestimulad[ao]s?\b/.test(q) ||
    /\bpesquisas?\s+eleitorais?\s+estimulad/.test(q) ||
    /\bpesquisas?\s+estimulad/.test(q) ||
    /\beleitorais?\s+estimulad/.test(q)
  )
}

function asksTopFederalFromPolls(q: string): boolean {
  return (
    /\b(eleitos?|eleger|bancada)\b/.test(q) ||
    /\b(top\s*\d+|dez\s+primeir|\d+\s+primeir|\d+\s+deputad)/.test(q) ||
    /\bquem\s+(seria|seriam|serao|serão|sao|são|estao|estão|vai|vão|vao)\b/.test(q)
  )
}

/**
 * Ranking / top candidatos na estimulada dep. federal — NÃO é simulador de chapa (D'Hondt).
 * Ex.: «com base nas pesquisas estimuladas, quem seriam os 10 eleitos para dep. federal»
 */
export function isRankingEstimuladaFederalQuery(query: string): boolean {
  const q = norm(query)
  if (isChapaSimulationQuery(q)) return false

  if (/\branking\s+estimulada\b/.test(q)) return true

  const temFederal = hasFederalDeputyContext(q)
  const temEstimulada = hasEstimuladaContext(q)

  if (temEstimulada && temFederal) return true

  if (temFederal && asksTopFederalFromPolls(q)) {
    return temEstimulada || /\bpesquisas?\b/.test(q)
  }

  if (temEstimulada && asksTopFederalFromPolls(q) && /\b(deputad|dep\.?|federais?)\b/.test(q)) {
    return true
  }

  if (!/\b(ranking|colocacao|posicao|lugar)\b/.test(q)) return false
  return temEstimulada || temFederal
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
  const candidato = resolveCandidatoArg(message) ?? CANDIDATO_RESUMO_PESQUISAS
  args.candidato = candidato

  return { intent: 'consultar_ranking_estimulada_federal', args }
}
