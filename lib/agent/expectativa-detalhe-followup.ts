import { extractCityNameFromQuery, isInvalidCityCandidate } from '@/lib/agent/city-extract'

/** Liderança completa ou abreviada («lider», «líderes»). */
const LIDERANCA_TERM = String.raw`(?:liderancas?|liders?)`

/** «por lider», «de liderança», etc. */
const POR_LIDER_PHRASE = new RegExp(String.raw`\b(?:por|de)\s+${LIDERANCA_TERM}\b`)

/** Ação pedindo quebra por liderança. */
const ACAO_LIDERANCA = String.raw`\b(?:detalh(?:e|a|ar|amento)?|mostr(?:a|ar|e)|list(?:a|ar|e)|exib(?:e|ir)|ver|abrir|quebr(?:a|ar)|separ(?:a|ar|e))\b`

/** Métrica de voto/expectativa junto com liderança. */
const METRICA_VOTOS = String.raw`\b(?:expectativa|votos?|projec(?:a|ao|oes)?)\b`

const MAX_FOLLOWUP_REPLY_LEN = 55

function normalize(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function mentionsLiderancaTerm(query: string): boolean {
  return new RegExp(String.raw`\b${LIDERANCA_TERM}\b`).test(normalize(query))
}

/** Pedido de expectativa/votos detalhados por liderança (pergunta completa ou follow-up). */
export function pedeExpectativaDetalhePorLideranca(query: string): boolean {
  const q = normalize(query)
  if (!mentionsLiderancaTerm(q)) return false
  if (/\bpor\s+cargo\b/.test(q)) return false

  if (POR_LIDER_PHRASE.test(q)) return true

  if (new RegExp(METRICA_VOTOS).test(q) && new RegExp(`${ACAO_LIDERANCA}`).test(q)) return true

  if (new RegExp(METRICA_VOTOS).test(q) && POR_LIDER_PHRASE.test(q)) return true

  return false
}

export function querExpectativaPorLideranca(query: string): boolean {
  return pedeExpectativaDetalhePorLideranca(query)
}

/** Follow-up curto pedindo detalhamento da última cidade consultada. */
export function isExpectativaLiderancaFollowUpQuery(query: string): boolean {
  const q = normalize(query)
  if (/\bpor\s+cargo\b/.test(q)) return false
  if (/\b(quadro|tabela)\s+resumo\b/.test(q) || /\bresumo\b.*\bpor\s+cargo\b/.test(q)) return false

  if (pedeExpectativaDetalhePorLideranca(query)) return true
  if (new RegExp(`${ACAO_LIDERANCA}`).test(q) && mentionsLiderancaTerm(q)) {
    return true
  }

  return isExpectativaDetalheAffirmative(query) && mentionsLiderancaTerm(q)
}

/** Resposta curta «sim» / «detalha» ao follow-up — não vale em frases longas de outro assunto. */
export function isExpectativaDetalheAffirmative(query: string): boolean {
  const q = normalize(query)
  if (q.length > MAX_FOLLOWUP_REPLY_LEN) return false

  if (POR_LIDER_PHRASE.test(q)) return true

  if (
    /^(sim|quero|pode|claro|com certeza|pode sim|vai em frente|detalha|detalhe|detalhar|detalhamento)\.?$/i.test(
      q
    )
  ) {
    return true
  }

  if (q.length <= 28 && /\b(sim|quero|detalh)\b/.test(q)) return true

  return false
}

/** Encerramento do follow-up — «não» isolado, não «ainda não visitei». */
export function isExpectativaDetalheNegative(query: string): boolean {
  const q = normalize(query)
  if (!q) return false

  if (q.length > MAX_FOLLOWUP_REPLY_LEN) {
    return /\b(nao precisa|nao quero|deixa pra la|so isso|era so isso|so queria saber)\b/.test(q)
  }

  if (/^(nao|nao obrigado|nao valeu|negativo)\.?$/i.test(q)) return true

  if (
    /\b(nao precisa|nao preciso|nao quero|negativo|dispensa|deixa|deixa pra la|pode deixar|sem necessidade|tranquilo|tudo bem|ta bom|ta otimo|so isso|era so isso|so queria saber|por enquanto nao)\b/.test(
      q
    )
  ) {
    return true
  }

  if (/\b(obrigad[oa]|valeu|brigad[oa])\b/.test(q) && !/\b(sim|quero|detalh|list|mostr)\b/.test(q)) {
    return true
  }

  if (/^(ok|beleza|blz|show|perfeito|certo|entendi)(?:\s+(obrigad[oa]|valeu|jaques?|jarvis))?\.?$/i.test(q)) {
    return true
  }

  return false
}

/** Gate único: só entra no fluxo de follow-up de expectativa com esta função. */
export function isExpectativaDetalheFollowUpQuery(query: string): boolean {
  return (
    isExpectativaLiderancaFollowUpQuery(query) ||
    isExpectativaDetalheAffirmative(query) ||
    isExpectativaDetalheNegative(query)
  )
}

/** @deprecated follow-up automático removido — use querExpectativaPorLideranca na pergunta. */
export const EXPECTATIVA_DETALHE_FOLLOWUP_QUESTION =
  'Quer que eu detalhe a expectativa por liderança?'

export const EXPECTATIVA_DETALHE_DISMISS_REPLY =
  'Ok! Se surgir outra dúvida, é só chamar.'

export function extractCidadeFromExpectativaReply(content: string): string | null {
  const match = /^\s*\*\*([^*]+)\*\*/m.exec(content)
  const raw = match?.[1]?.trim()
  if (!raw || isInvalidCityCandidate(raw)) return null
  if (isComparativoExpectativaJarvisReply(content)) return null
  return raw
}

/** Relatório comparativo 2026 × 2022 — não é resumo de cidade. */
export function isComparativoExpectativaJarvisReply(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  return (
    /\bexpectativa\s+2026\s*[×x]\s*federal\s+2022\b/i.test(trimmed) ||
    /\bcomparativo\s+expectativa\b/i.test(trimmed) ||
    /\*\*totais\s+gerais\*\*/i.test(trimmed) ||
    /\bmunicip[ií]pios\*\*\s*\(\d+/i.test(trimmed)
  )
}

export function looksLikeExpectativaCidadeReply(content: string): boolean {
  const trimmed = content.trim()
  if (!trimmed) return false
  if (isComparativoExpectativaJarvisReply(trimmed)) return false
  if (/^\s*\*\*[^*]+\*\*/m.test(trimmed) && /\b(pior cen[aá]rio|expectativa|votos?)\b/i.test(trimmed)) {
    return true
  }
  if (EXPECTATIVA_DETALHE_FOLLOWUP_QUESTION && trimmed.includes(EXPECTATIVA_DETALHE_FOLLOWUP_QUESTION)) {
    return true
  }
  return /\b(jipe capotando|pior cen[aá]rio)\b/i.test(trimmed) && /\bvotos?\b/i.test(trimmed)
}

export function isExpectativaComDetalheLiderancaReply(content: string): boolean {
  return /\*\*lideranças:\*\*|\*\*top \d+ liderança|Lideranças:\s+\*\*\d+/i.test(content)
}

function formatCidadeNome(cidade: string): string {
  return cidade.charAt(0).toUpperCase() + cidade.slice(1).toLowerCase()
}

function extractCidadeFromExpectativaTurn(
  history: Array<{ role: string; content: string }>,
  assistantIndex: number,
  assistantContent: string
): string | null {
  const fromReply = extractCidadeFromExpectativaReply(assistantContent)
  if (fromReply) return fromReply

  for (let i = assistantIndex - 1; i >= 0; i--) {
    if (history[i].role !== 'user') continue
    const extracted = extractCityNameFromQuery(history[i].content)
    return extracted ? formatCidadeNome(extracted) : null
  }

  return null
}

function findLastExpectativaSummaryIndex(
  history: Array<{ role: string; content: string }>
): number {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i]
    if (msg.role !== 'assistant' || !looksLikeExpectativaCidadeReply(msg.content)) continue
    if (isExpectativaComDetalheLiderancaReply(msg.content)) continue
    return i
  }
  return -1
}

export interface ExpectativaDetalheFollowUpContext {
  cidade: string
  kind: 'affirmative' | 'negative'
}

/** Usa a última resposta de expectativa (sem detalhe) + pedido curto do usuário. */
export function detectExpectativaDetalheFollowUp(
  history: Array<{ role: string; content: string }>,
  query: string
): ExpectativaDetalheFollowUpContext | null {
  if (!isExpectativaDetalheFollowUpQuery(query)) return null

  const assistantIndex = findLastExpectativaSummaryIndex(history)
  if (assistantIndex < 0) return null

  const lastExpectativa = history[assistantIndex]
  const cidade = extractCidadeFromExpectativaTurn(history, assistantIndex, lastExpectativa.content)
  if (!cidade) return null

  if (isExpectativaDetalheNegative(query)) {
    return { cidade, kind: 'negative' }
  }

  return { cidade, kind: 'affirmative' }
}

/** Cidade da última consulta de expectativa — só quando o pedido é follow-up legítimo. */
export function resolveExpectativaCidadeContext(
  history: Array<{ role: string; content: string }>,
  query: string,
  pendingCidade?: string | null
): string | null {
  const followUp = detectExpectativaDetalheFollowUp(history, query)
  if (followUp) return followUp.cidade

  if (pendingCidade?.trim() && isExpectativaLiderancaFollowUpQuery(query)) {
    return pendingCidade.trim()
  }

  return null
}
