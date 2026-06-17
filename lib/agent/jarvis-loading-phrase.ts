import { detectSidebarNavigate } from '@/lib/agent/detect-sidebar-navigate'
import { isGreetingQuery, isHelpQuery } from '@/lib/agent/greeting-reply'
import { isJarvisDismissUiQuery } from '@/lib/agent/jarvis-ui-dismiss'
import { pickJarvisLoadingPhrase, pickJarvisProcessandoPhrase } from '@/lib/agent/jarvis-phrases'

export { pickJarvisLoadingPhrase, pickJarvisProcessandoPhrase }

export interface JarvisLoadingPhraseContext {
  pesquisaTipoPending: boolean
  agendaScopePending: boolean
  expectativaDetalhePending: boolean
  currentPath?: string
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
  if (isJarvisDismissUiQuery(trimmed)) return false

  if (detectSidebarNavigate(trimmed, ctx.currentPath)) return false

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
