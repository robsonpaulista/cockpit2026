import { isGreetingQuery, isHelpQuery } from '@/lib/agent/greeting-reply'

const LOADING_PHRASES = [
  'Um momento, estou buscando os dados.',
  'Consultando as informações, aguarde.',
  'Deixe-me verificar isso para você.',
  'Só um instante enquanto consulto os dados.',
  'Aguarde, estou processando sua consulta.',
] as const

export function pickJarvisLoadingPhrase(): string {
  const index = Math.floor(Math.random() * LOADING_PHRASES.length)
  return LOADING_PHRASES[index] ?? LOADING_PHRASES[0]
}

export interface JarvisLoadingPhraseContext {
  pesquisaTipoPending: boolean
  agendaScopePending: boolean
  expectativaDetalhePending: boolean
  parsePesquisaTipo?: (query: string) => unknown
  parseAgendaDayScope?: (query: string) => unknown
  isExpectativaAffirmative?: (query: string) => boolean
  isExpectativaNegative?: (query: string) => boolean
}

/** Fala curta enquanto a consulta roda — não em cumprimentos, ajuda ou pedidos de esclarecimento. */
export function shouldPlayJarvisLoadingPhrase(
  query: string,
  ctx: JarvisLoadingPhraseContext
): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false
  if (isGreetingQuery(trimmed) || isHelpQuery(trimmed)) return false

  if (ctx.pesquisaTipoPending) {
    return Boolean(ctx.parsePesquisaTipo?.(trimmed))
  }

  if (ctx.agendaScopePending) {
    return Boolean(ctx.parseAgendaDayScope?.(trimmed))
  }

  if (ctx.expectativaDetalhePending) {
    return Boolean(
      ctx.isExpectativaAffirmative?.(trimmed) || ctx.isExpectativaNegative?.(trimmed)
    )
  }

  if (
    /^(responda|para listar|não entendi|certo\.|ok\.?|sim|não|nao)$/i.test(trimmed) ||
    trimmed.length < 8
  ) {
    return false
  }

  if (/\b(envia|enviar|envie|mand[ae]|resumo\s+operacional|briefing|whatsapp)\b/i.test(trimmed)) {
    return true
  }

  return true
}
