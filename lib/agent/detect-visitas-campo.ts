import type { AgentClassifiedIntent } from '@/lib/agent/types'
import { extractCityNameFromQuery, isInvalidCityCandidate } from '@/lib/agent/city-extract'
import { isPrioridadeVisitasCampoQuery } from '@/lib/agent/detect-prioridade-visitas'
import { isMonthName, parseMesAnoFromText } from '@/lib/agent/parse-visitas-mes'
import {
  isCidadeMaisVisitadaQuery,
  isCidadeMenosVisitadasQuery,
  isUltimaSingularQuery,
  type VisitasCampoModo,
} from '@/lib/agent/format-visitas-campo'

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Visitas ao perfil do Instagram — não confundir com campo. */
export function isInstagramVisitaQuery(query: string): boolean {
  const q = norm(query)
  return (
    /\b(instagram|insta|perfil|rede social)\b/.test(q) &&
    /\b(visita|visualiza|view)\b/.test(q)
  )
}

/** Consulta sobre visitas/viagens de campo (Campo & Agenda). */
export function isCampoVisitasQuery(query: string): boolean {
  if (isPrioridadeVisitasCampoQuery(query)) return true
  if (isInstagramVisitaQuery(query)) return false
  const q = norm(query)
  return (
    /\b(visita?s?|visitar|viagem|viagens|check-?in|checkin|visitei)\b/.test(q) ||
    /\bultim[ao]s?\s+(visitas?|viagens?|cidades?)\b/.test(q) ||
    /\bultim[ao]\s+cidade\b/.test(q) ||
    /\bque\s+eu\s+visitei\b/.test(q) ||
    /\bcidades?\s+visitadas?\b/.test(q) ||
    (/\b(descricao|detalhe)\b/.test(q) && /\bvisita\b/.test(q)) ||
    (/\bquantas?\b/.test(q) && /\b(viagens?|visitas?)\b/.test(q)) ||
    /\bagenda\s+de\s+campo\b/.test(q) ||
    /\bcampo\s+e\s+agenda\b/.test(q) ||
    isUltimaSingularQuery(query) ||
    isCidadeMaisVisitadaQuery(query) ||
    isCidadeMenosVisitadasQuery(query)
  )
}

function detectModo(
  message: string,
  q: string,
  cidade?: string,
  mesAno?: { month: number; year: number } | null
): VisitasCampoModo {
  if (isPrioridadeVisitasCampoQuery(message)) return 'prioridade_visitas'
  if (isUltimaSingularQuery(message)) return 'ultima'
  if (isCidadeMenosVisitadasQuery(message)) return 'cidade_menos_visitadas'
  if (isCidadeMaisVisitadaQuery(message)) return 'cidade_mais_visitada'
  if (/\bultim[ao]s\b/.test(q) && /\b(visitas?|viagens?|cidades?)\b/.test(q)) return 'ultimas'
  if (/\bquantas?\b/.test(q) && /\b(viagens?|visitas?)\b/.test(q)) return 'contagem_mes'
  if (/\b(descricao|detalhe|o que foi)\b/.test(q) && /\bvisita\b/.test(q)) return 'descricao'
  if (/\bcidades?\s+visitadas?\b/.test(q)) return 'cidades'
  if (cidade) return 'lista_cidade'
  if (mesAno) return 'contagem_mes'
  return 'ultimas'
}

/** Detecta pedidos sobre visitas de campo sem depender só do Groq. */
export function detectVisitasCampoIntent(message: string): AgentClassifiedIntent | null {
  if (!isCampoVisitasQuery(message)) return null

  const q = norm(message)
  const args: Record<string, string> = {}
  const mesAno = parseMesAnoFromText(message)

  let cidade = extractCityNameFromQuery(message)
  if (cidade && isInvalidCityCandidate(cidade)) cidade = null
  if (cidade && isMonthName(cidade)) cidade = null
  // «última cidade que eu visitei» — frase genérica, sem município alvo
  if (/\bcidade\s+que\s+eu\s+visitei\b/.test(q)) cidade = null
  // «mês de abril» — mês não é cidade
  if (mesAno && cidade && isMonthName(cidade)) cidade = null

  const modo = detectModo(message, q, cidade ?? undefined, mesAno)
  if (modo === 'contagem_mes' && cidade && isMonthName(cidade)) cidade = null
  if (modo === 'cidade_mais_visitada' || modo === 'cidade_menos_visitadas') cidade = null
  if (cidade) args.cidade = cidade

  if (mesAno) {
    args.mes = String(mesAno.month + 1).padStart(2, '0')
    args.ano = String(mesAno.year)
  }
  args.modo = modo
  args.termo = message.trim()

  return {
    intent: 'consultar_visitas_campo',
    args,
    direct_reply: null,
  }
}
