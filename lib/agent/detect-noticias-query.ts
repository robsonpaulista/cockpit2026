import type { AgentClassifiedIntent } from '@/lib/agent/types'
import {
  queryAsksNoticiasCriticas,
  queryAsksNoticiasDestaque,
} from '@/lib/agent/format-noticias'

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function hasNoticiaContext(q: string): boolean {
  return /\b(noticias?|materias?|manchete|imprensa|feed|inbox|radar|monitor)\b/.test(q)
}

const MENCIONA_SENTIMENTO =
  /\b(negativ\w*|positiv\w*|neutr\w*|tom\s+(negativ|positiv)\w*|desfavorav\w*|favorav\w*)\b/

const SENTIMENTO_NEGATIVO =
  /\b(negativ\w*|desfavorav\w*|critica\s+da\s+imprensa|tom\s+negativ\w*)\b/

const SENTIMENTO_POSITIVO = /\b(positiv\w*|favorav\w*|bom\s+tom|tom\s+positiv\w*)\b/

const SENTIMENTO_NEUTRO = /\bneutr\w*\b/

function isCountOrSummaryQuestion(q: string): boolean {
  return (
    /\b(quantas?|quanto|total|resumo|indicadores?|como\s+est[aá]|panorama|situac[aã]o|status|numeros?|balanco)\b/.test(
      q
    ) || /\b(me\s+)?(d[aá]|fala|conta)\s+(o\s+)?(resumo|panorama|status)\b/.test(q)
  )
}

/** Resumo dos indicadores da barra superior (hoje · risco alto · destacadas). */
export function isNoticiasResumoQuery(query: string): boolean {
  const q = norm(query)

  if (queryAsksNoticiasCriticas(q) || queryAsksNoticiasDestaque(q)) {
    if (!isCountOrSummaryQuestion(q)) return false
  }

  if (/\bnoticias?\s+hoje\b/.test(q) && isCountOrSummaryQuestion(q)) return true
  if (/\bquantas?\s+noticias?\b/.test(q)) return true
  if (/\bquantas?\s+(com\s+)?(risco\s+alt|destacad)/.test(q)) return true
  if (/\b(resumo|panorama|indicadores?|status)\s+(das?\s+)?(noticias?|imprensa|monitor)\b/.test(q)) {
    return true
  }
  if (/\bcomo\s+est[aá]\s+(o\s+)?(monitor|inbox|radar)\s+(de\s+)?(noticias?|imprensa)\b/.test(q)) {
    return true
  }
  if (/\b(radar|monitor)\s+de\s+(noticias?|imprensa)\b/.test(q) && isCountOrSummaryQuestion(q)) {
    return true
  }

  return false
}

export function parseNoticiasResumoFoco(query: string): string {
  const q = norm(query)
  if (/\bnoticias?\s+hoje\b/.test(q) || /\bhoje\b/.test(q)) return 'hoje'
  if (/\brisco\s+alt/.test(q)) return 'risco_alto'
  if (/\bdestacad/.test(q)) return 'destacadas'
  return 'geral'
}

export function parseNoticiasSentimento(query: string): 'positive' | 'negative' | 'neutral' | null {
  const q = norm(query)
  if (!hasNoticiaContext(q) && !MENCIONA_SENTIMENTO.test(q)) return null

  if (SENTIMENTO_NEGATIVO.test(q)) return 'negative'
  if (SENTIMENTO_POSITIVO.test(q)) return 'positive'
  if (SENTIMENTO_NEUTRO.test(q)) return 'neutral'

  return null
}

export function isNoticiasSentimentoQuery(query: string): boolean {
  const q = norm(query)
  if (isCountOrSummaryQuestion(q) && !MENCIONA_SENTIMENTO.test(q)) return false
  if (queryAsksNoticiasCriticas(q) || queryAsksNoticiasDestaque(q)) return false
  return parseNoticiasSentimento(query) !== null
}

export function parseNoticiasRiscoNivel(query: string): 'medium' | 'low' | null {
  const q = norm(query)
  if (!hasNoticiaContext(q)) return null
  if (/\brisco\s+alt/.test(q) || /\balerta\s*crit/.test(q)) return null

  if (/\brisco\s+m[eé]di/.test(q)) return 'medium'
  if (/\brisco\s+baix/.test(q)) return 'low'
  return null
}

export function isNoticiasRiscoQuery(query: string): boolean {
  return parseNoticiasRiscoNivel(query) !== null
}

export function parseNoticiasBuscaTermo(query: string): string | null {
  const q = norm(query)

  const sobre = q.match(
    /\b(?:noticias?|materias?|manchetes?)\s+(?:sobre|de|do|da|relacionad[ao]s?\s+a)\s+(.+?)(?:\?|$)/
  )
  if (sobre?.[1]) return sobre[1].trim().slice(0, 80)

  const buscar = q.match(/\b(?:buscar?|procurar?|achar?)\s+(?:noticias?|materias?)\s+(?:sobre\s+)?(.+?)(?:\?|$)/)
  if (buscar?.[1]) return buscar[1].trim().slice(0, 80)

  const tema = q.match(/\btema\s+(.+?)(?:\?|$)/)
  if (tema?.[1] && hasNoticiaContext(q)) return tema[1].trim().slice(0, 80)

  return null
}

export function isNoticiasBuscaQuery(query: string): boolean {
  const q = norm(query)
  if (queryAsksNoticiasCriticas(q) || queryAsksNoticiasDestaque(q)) return false
  if (isNoticiasResumoQuery(query)) return false
  return parseNoticiasBuscaTermo(query) !== null
}

export function isNoticiasRecentesQuery(query: string): boolean {
  const q = norm(query)
  if (!hasNoticiaContext(q)) return false
  if (
    queryAsksNoticiasCriticas(q) ||
    queryAsksNoticiasDestaque(q) ||
    isNoticiasResumoQuery(query) ||
    isNoticiasSentimentoQuery(query) ||
    isNoticiasRiscoQuery(query) ||
    isNoticiasBuscaQuery(query)
  ) {
    return false
  }

  return (
    /\b(ultim[ao]s?|recentes?|novas?)\s+(noticias?|materias?)\b/.test(q) ||
    /\b(o\s+)?que\s+saiu\s+(na\s+)?imprensa\b/.test(q) ||
    /\bfeed\s+de\s+noticias?\b/.test(q) ||
    /\blistar?\s+noticias?\b/.test(q) ||
    (/\bmostr(ar?|e)\s+(as\s+)?noticias?\b/.test(q) && !MENCIONA_SENTIMENTO.test(q))
  )
}

export function detectNoticiasIntent(query: string): AgentClassifiedIntent | null {
  const q = norm(query)

  if (queryAsksNoticiasCriticas(q)) {
    return {
      intent: 'consultar_noticias_criticas',
      args: { risco: 'high', termo: query.slice(0, 160) },
    }
  }

  if (queryAsksNoticiasDestaque(q)) {
    return {
      intent: 'consultar_noticias_destaque',
      args: { termo: query.slice(0, 160) },
    }
  }

  if (isNoticiasResumoQuery(query)) {
    return {
      intent: 'consultar_noticias_resumo',
      args: { foco: parseNoticiasResumoFoco(query), termo: query.slice(0, 160) },
    }
  }

  const sentimento = parseNoticiasSentimento(query)
  if (sentimento && isNoticiasSentimentoQuery(query)) {
    return {
      intent: 'consultar_noticias_filtradas',
      args: { sentimento, filtro: 'sentimento', termo: query.slice(0, 160) },
    }
  }

  const risco = parseNoticiasRiscoNivel(query)
  if (risco) {
    return {
      intent: 'consultar_noticias_filtradas',
      args: { risco, filtro: 'risco', termo: query.slice(0, 160) },
    }
  }

  const termoBusca = parseNoticiasBuscaTermo(query)
  if (termoBusca) {
    return {
      intent: 'consultar_noticias_filtradas',
      args: { termo_busca: termoBusca, filtro: 'busca', termo: query.slice(0, 160) },
    }
  }

  if (isNoticiasRecentesQuery(query)) {
    return {
      intent: 'consultar_noticias_filtradas',
      args: { filtro: 'recentes', termo: query.slice(0, 160) },
    }
  }

  return null
}
