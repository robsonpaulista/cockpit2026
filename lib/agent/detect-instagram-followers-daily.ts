import type { AgentClassifiedIntent } from '@/lib/agent/types'

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function clampDays(value: number): number {
  if (!Number.isFinite(value)) return 7
  return Math.min(90, Math.max(1, Math.round(value)))
}

/** Extrai janela de dias pedida na pergunta (padrão: 7). */
export function parseInstagramFollowersDailyDays(query: string): number {
  const q = norm(query)

  const explicit = q.match(/\b(?:ultim[oa]s?|nos?)\s+(\d{1,3})\s+dias?\b/)
  if (explicit) return clampDays(Number(explicit[1]))

  const short = q.match(/\b(7|14|30|90)\s*dias?\b/)
  if (short) return clampDays(Number(short[1]))

  if (/\bultima\s+semana\b/.test(q)) return 7
  if (/\bultimo\s+mes\b/.test(q)) return 30
  if (/\bultimos?\s+dias?\b/.test(q)) return 7

  return 7
}

/**
 * Perguntas sobre variação/crescimento de seguidores com recorte diário.
 * Cobre variações como: por dia, ganhei/perdi, últimos dias, evolução, histórico.
 */
export function isInstagramFollowersDailyQuery(query: string): boolean {
  const q = norm(query)

  if (/\b(seguidor(?:es)?\s+por\s+cidade|cidades?|municipio|localizacao|demografic)\b/.test(q)) {
    return false
  }

  const mentionsFollowers =
    /\b(seguidor(?:es)?|followers?)\b/.test(q) ||
    (/\b(instagram|insta|perfil|rede\s+social)\b/.test(q) &&
      /\b(ganhei|perdi|perd[ei]|cresci|crescimento|evolucao|variacao)\b/.test(q))

  if (!mentionsFollowers) return false

  const isCurrentCountOnly =
    /\b(quant[oa]s?\s+seguidor(?:es)?\s+(?:eu\s+)?tenho|total\s+de\s+seguidor|numero\s+de\s+seguidor)\b/.test(
      q
    ) &&
    !/\b(por\s+dia|dia\s+a\s+dia|ultim|ganhei|perdi|evolucao|variacao|crescimento|historico)\b/.test(q)

  if (isCurrentCountOnly) return false

  const wantsDailyBreakdown =
    /\b(por\s+dia|dia\s+a\s+dia|diari[ao]s?|cada\s+dia|ao\s+dia|quebrado\s+por\s+dia)\b/.test(q) ||
    /\b(ultim[oa]s?\s+\d*\s*dias?|ultima\s+semana|ultimo\s+mes)\b/.test(q) ||
    /\b(historico|evolucao)\s+(de\s+)?seguidor/.test(q) ||
    /\bseguidor(?:es)?\s+(ganhei|perdi|perd[ei]|novos?|a\s+mais|a\s+menos)\b/.test(q) ||
    /\b(ganhei|perdi|perd[ei]|novos?|a\s+mais|a\s+menos)\s+.*\bseguidor/.test(q) ||
    /\bquant[oa]s?\s+seguidor(?:es)?\s+(?:eu\s+)?(?:ganhei|perdi|novos?)/.test(q) ||
    /\bquant[oa]s?\s+seguidor.*\b(por\s+dia|dia|ultim|semana|mes)\b/.test(q) ||
    /\b(crescimento|variacao)\s+(de\s+)?seguidor/.test(q) ||
    /\bseguidor(?:es)?\s+.*\b(crescimento|variacao|evolucao)\b/.test(q)

  return wantsDailyBreakdown
}

export function detectInstagramFollowersDailyIntent(query: string): AgentClassifiedIntent | null {
  if (!isInstagramFollowersDailyQuery(query)) return null

  return {
    intent: 'consultar_instagram_seguidores_diario',
    args: {
      dias: String(parseInstagramFollowersDailyDays(query)),
      termo: query.slice(0, 160),
    },
  }
}
