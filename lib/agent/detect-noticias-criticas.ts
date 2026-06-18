import { queryAsksNoticiasCriticas } from '@/lib/agent/format-noticias'
import { detectNoticiasIntent } from '@/lib/agent/detect-noticias-query'

export function isNoticiasCriticasQuery(query: string): boolean {
  return queryAsksNoticiasCriticas(query)
}

export { detectNoticiasIntent }

export function detectNoticiasCriticasIntent(query: string) {
  const intent = detectNoticiasIntent(query)
  if (intent?.intent === 'consultar_noticias_criticas') return intent
  return null
}