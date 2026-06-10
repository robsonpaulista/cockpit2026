export const EXPECTATIVA_DETALHE_FOLLOWUP_QUESTION =
  'Quer que eu detalhe a expectativa por liderança?'

export const EXPECTATIVA_DETALHE_DISMISS_REPLY =
  'Ok! Se surgir outra dúvida, é só chamar.'

function normalize(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Resposta afirmativa ao follow-up de detalhar lideranças. */
export function isExpectativaDetalheAffirmative(query: string): boolean {
  const q = normalize(query)
  return /\b(sim|quero|pode|detalha|detalhe|detalhada|detalhado|por lideranca|liste|listar|mostra|mostre|manda|claro|com certeza|vai em frente|pode sim)\b/.test(
    q
  )
}

/** Resposta negativa / encerramento — checar antes da afirmativa no follow-up. */
export function isExpectativaDetalheNegative(query: string): boolean {
  const q = normalize(query)
  if (!q) return false

  if (
    /\b(nao|nao precisa|nao preciso|nao quero|negativo|dispensa|deixa|deixa pra la|pode deixar|sem necessidade|tranquilo|tudo bem|ta bom|ta otimo|so isso|era so isso|so queria saber|por enquanto nao)\b/.test(
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

export function extractCidadeFromExpectativaReply(content: string): string | null {
  const match = /^\s*\*\*([^*]+)\*\*/m.exec(content)
  return match?.[1]?.trim() || null
}

export interface ExpectativaDetalheFollowUpContext {
  cidade: string
  kind: 'affirmative' | 'negative'
}

/** Fallback quando o estado pendente se perdeu — usa a última pergunta no histórico. */
export function detectExpectativaDetalheFollowUp(
  history: Array<{ role: string; content: string }>,
  query: string
): ExpectativaDetalheFollowUpContext | null {
  const lastAssistant = [...history].reverse().find((m) => m.role === 'assistant')
  if (!lastAssistant?.content.includes(EXPECTATIVA_DETALHE_FOLLOWUP_QUESTION)) {
    return null
  }

  const cidade = extractCidadeFromExpectativaReply(lastAssistant.content)
  if (!cidade) return null

  if (isExpectativaDetalheNegative(query)) {
    return { cidade, kind: 'negative' }
  }
  if (isExpectativaDetalheAffirmative(query)) {
    return { cidade, kind: 'affirmative' }
  }

  return null
}
