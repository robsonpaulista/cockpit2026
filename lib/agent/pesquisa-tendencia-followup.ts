import { extractCityNameFromQuery, isInvalidCityCandidate } from '@/lib/agent/city-extract'

export interface PesquisaTendenciaCidadePending {
  candidato: string
}

function normalize(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Follow-up curto com município após tendência geral («em Teresina», «e Picos?»). */
export function isPesquisaTendenciaCidadeFollowUpQuery(query: string): boolean {
  const q = normalize(query)
  if (q.length > 80) return false
  if (/\b(pesquisa|intencao|intencao|ranking|expectativa|agenda|instagram)\b/.test(q)) {
    return false
  }
  if (/^(e\s+)?(em|na|no|para)\s+/.test(q)) return true
  if (/^(e\s+)?[a-z][a-z\s]{2,28}\??$/.test(q)) return true
  return false
}

export function detectPesquisaTendenciaCidadeFollowUp(
  message: string,
  pending: PesquisaTendenciaCidadePending | null
): { candidato: string; cidade: string } | null {
  if (!pending?.candidato?.trim()) return null
  if (!isPesquisaTendenciaCidadeFollowUpQuery(message)) return null

  const cidade = extractCityNameFromQuery(message)
  if (!cidade || isInvalidCityCandidate(cidade)) return null

  return { candidato: pending.candidato.trim(), cidade }
}

export const PESQUISA_TENDENCIA_CIDADE_HINT =
  '\n\n› Para filtrar um município: «em Teresina», «tendência em Picos» ou só «em Parnaíba».'
