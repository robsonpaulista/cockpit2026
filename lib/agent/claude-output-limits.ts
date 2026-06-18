import {
  ANTHROPIC_MAX_OUTPUT_TOKENS,
  ANTHROPIC_MAX_OUTPUT_TOKENS_EXTENDED,
} from '@/lib/agent/claude-config'
import { isPlanoVisitasCampoQuery } from '@/lib/agent/detect-plano-visitas'

export function resolveAnthropicMaxOutputTokens(message: string): number {
  if (isPlanoVisitasCampoQuery(message)) {
    return ANTHROPIC_MAX_OUTPUT_TOKENS_EXTENDED
  }

  const q = message.toLowerCase()
  if (
    /\b(cronograma|plano\s+de\s+visitas?|programacao|programação|roteiro)\b/.test(q) &&
    /\b(\d+\s*dias?|semanas?|mes)\b/.test(q)
  ) {
    return ANTHROPIC_MAX_OUTPUT_TOKENS_EXTENDED
  }

  return ANTHROPIC_MAX_OUTPUT_TOKENS
}
