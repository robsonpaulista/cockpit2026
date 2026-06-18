import {
  JARVIS_SAUDACAO_LINES,
  pickJarvisForaDeEscopo,
  pickJarvisSaudacao,
  pickJarvisSaudacaoPorHorario,
} from '@/lib/agent/jarvis-phrases'

function normalize(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const ASSISTANT_NAMES = /\b(jarvis|cockpit|assistente|copilot)\b/

const DATA_INTENT =
  /\b(agenda|noticia|notícias|expectativa|pesquisa|demanda|pedido|teresina|picos|lideranca|liderança|chapa|alerta|instagram|territorio|território|compromisso|destaque|whatsapp|resumo\s+operacional|briefing)\b/

const ACTION_INTENT =
  /\b(envia|enviar|envie|mand[ae]|dispar[ae]|resumo\s+operacional|briefing)\b/

const GREETING_ONLY =
  /^(?:oi|ola|hey|e\s*ai|eai|hello|hi|bom\s+dia|boa\s+tarde|boa\s+noite|tudo\s+bem|beleza|fala|fala\s+ai)(?:\s+(?:jarvis|cockpit|assistente))?[!.?\s]*$/i

function normalizeGreetingText(query: string): string {
  return normalize(query)
    .replace(/[,.!?;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** @deprecated use JARVIS_SAUDACAO_LINES */
export const JARVIS_GREETING_LINES = JARVIS_SAUDACAO_LINES

export function pickJarvisGreetingLine(): string {
  return pickJarvisSaudacao()
}

export function isHelpQuery(query: string): boolean {
  const q = normalize(query)
  return (
    q === '?' ||
    /\b(ajuda|comandos|exemplos|help|menu|funcionalidades|capacidades)\b/.test(q) ||
    /\b(o que (?:voce|você) (?:faz|consegue|sabe|pode fazer|pode responder|responde))\b/.test(q) ||
    /\b(o que posso (?:perguntar|fazer|pedir))\b/.test(q) ||
    /\b(quais? (?:sao|são) (?:suas?|as) (?:funcoes|funções|capacidades))\b/.test(q) ||
    /\b(me (?:ajuda|ajude)|preciso de ajuda)\b/.test(q)
  )
}

/** Cumprimento simples — não confundir com consulta de dados. */
export function isGreetingQuery(query: string): boolean {
  const raw = query.trim()
  if (!raw || raw.length > 60) return false
  if (isHelpQuery(raw)) return false

  const stripped = normalizeGreetingText(stripAssistantMention(raw))
  if (!stripped) return false
  if (DATA_INTENT.test(stripped)) return false
  if (ACTION_INTENT.test(stripped)) return false

  if (GREETING_ONLY.test(stripped)) return true

  if (stripped.length > 35) return false
  return /^(oi|ola|bom dia|boa tarde|boa noite|tudo bem|beleza|fala)\b/.test(stripped)
}

/** Resposta social curta — saudação por horário ou frase do catálogo. */
export function buildGreetingReply(query?: string): string {
  const q = normalizeGreetingText(stripAssistantMention(query ?? ''))
  if (/\bbom dia\b/.test(q)) {
    return pickJarvisSaudacaoPorHorario()
  }
  if (/\bboa tarde\b/.test(q)) {
    return pickJarvisSaudacaoPorHorario()
  }
  if (/\bboa noite\b/.test(q)) {
    return pickJarvisSaudacaoPorHorario()
  }
  return pickJarvisGreetingLine()
}

export function buildUnknownQueryReply(): string {
  return pickJarvisForaDeEscopo()
}

export function buildOutOfScopeReply(): string {
  return pickJarvisForaDeEscopo()
}

export function buildHelpReply(): string {
  return `**O que posso fazer:**\n\n**Navegação:**\n› abrir agenda\n› ir para território e base\n› mostrar WhatsApp\n› voltar para visão geral\n\n**Por cidade:**\n› expectativa em Teresina\n› lideranças em Picos\n› visitas em Picos\n› demandas em Parnaíba\n\n**Campo & Agenda:**\n› quais cidades importantes preciso visitar\n› últimas visitas de campo\n› quantas viagens em maio de 2026\n› descrição da visita a Teresina\n› cidades visitadas
› qual cidade eu mais visitei\n\n**Agenda (Google):**\n› compromissos de hoje\n› agenda de amanhã\n\n**Geral:**\n› notícias em destaque\n› projeção chapa federal\n› alertas críticos\n› territórios frios\n\n**WhatsApp:**\n› envia o resumo operacional para o CEO\n› manda briefing de Picos para Maria e João\n› (sempre diga o destinatário — não envia para todos sem você pedir)\n\n**Pesquisas:**\n› como evoluiu a intenção do Jadyel\n› tendência em Teresina\n› ranking estimulada dep federal
› com base nas pesquisas estimuladas, quem seriam os 10 eleitos para dep. federal\n› pesquisa em Teresina\n\n**Redes:**\n› métricas do Instagram\n› qual post teve maior engajamento\n› posts mais curtidos\n› seguidores por dia\n› evolução diária de seguidores nos últimos 7 dias`
}

/** Remove menção ao assistente para não virar "cidade". */
export function stripAssistantMention(query: string): string {
  return query.replace(ASSISTANT_NAMES, ' ').replace(/\s+/g, ' ').trim()
}
