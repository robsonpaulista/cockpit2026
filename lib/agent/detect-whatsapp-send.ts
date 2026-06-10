import type { AgentClassifiedIntent } from '@/lib/agent/types'
import { extractCityNameFromQuery } from '@/lib/agent/city-extract'

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function stripCidadeFromRecipientPhrase(alvo: string, cidade?: string): string {
  if (!cidade) return alvo
  const cityNorm = norm(cidade)
  return alvo
    .replace(new RegExp(`\\bde\\s+${cityNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '')
    .replace(new RegExp(cityNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '')
    .replace(/\s+/g, ' ')
    .trim()
}

const SEND_VERB =
  /\b(envia|enviar|envie|mand[ae]|dispar[ae]|whatsapp|zap)\b/

/** Detecta pedidos de envio WhatsApp sem depender só do Groq. */
export function detectWhatsAppSendIntent(message: string): AgentClassifiedIntent | null {
  const q = norm(message)
  if (!SEND_VERB.test(q)) {
    return null
  }

  const args: Record<string, string> = {}

  if (/resumo\s+operacional|resumo\s+da\s+semana|resumo\s+semanal/.test(q)) {
    args.conteudo = 'resumo_operacional'
  } else if (/\bbriefing\b/.test(q)) {
    args.conteudo = 'briefing_territorio'
  } else if (/\bresumo\b/.test(q)) {
    args.conteudo = 'resumo_operacional'
  } else {
    return null
  }

  const diasMatch = q.match(/\b(\d{1,2})\s*dias?\b/)
  if (diasMatch?.[1]) args.dias = diasMatch[1]

  const cidade = extractCityNameFromQuery(message)
  if (cidade) args.cidade = cidade

  if (args.conteudo === 'briefing_territorio' && !args.cidade) {
    return null
  }

  // Grupo por categoria — só com pedido explícito («para os executivos»), nunca por «briefing de território»
  if (/\b(?:para|aos|à)\s+(?:os\s+)?executivos?\b/.test(q)) {
    args.grupo_categoria = 'executivo'
  } else if (/\b(?:para|à)\s+(?:a\s+)?assessoria\b/.test(q)) {
    args.grupo_categoria = 'assessoria'
  } else if (/\b(?:para|ao)\s+(?:time\s+de\s+)?territ[oó]rio\b/.test(q)) {
    args.grupo_categoria = 'territorio'
  }

  if (/\b(?:para\s+)?todos\s+(?:os\s+)?contatos?\b/.test(q) || /\btodos\s+cadastrados?\b/.test(q)) {
    args.destinatario = 'todos'
    args.enviar_todos = 'sim'
  }

  if (/\b(ceo|padrao|padrão|presidente|candidato)\b/.test(q) && /\b(?:para|pro|pra)\b/.test(q)) {
    args.destinatario = 'padrao'
  }

  const paraMatches = [...message.matchAll(/\b(?:para|pro|pra)\s+(.+?)(?:\.|$)/gi)]
  const paraMatch = paraMatches.length > 0 ? paraMatches[paraMatches.length - 1] : null
  if (paraMatch?.[1]) {
    let alvo = paraMatch[1].trim()
    alvo = stripCidadeFromRecipientPhrase(alvo, args.cidade)

    if (/^(o\s+)?(ceo|padrao|padrão)$/i.test(alvo)) {
      args.destinatario = 'padrao'
    } else if (/^todos(\s+os)?\s+contatos?$/i.test(alvo)) {
      args.destinatario = 'todos'
      args.enviar_todos = 'sim'
    } else if (
      !/^(os\s+)?executivos?$/i.test(alvo) &&
      !/^assessoria$/i.test(alvo) &&
      !/^(o\s+)?time\s+de\s+territ[oó]rio$/i.test(alvo) &&
      alvo.length >= 2
    ) {
      if (alvo.includes(',') || /\s+e\s+/i.test(alvo)) {
        args.destinatarios = alvo
      } else {
        args.destinatario = alvo
      }
    }
  }

  const hasRecipient =
    Boolean(args.destinatario) ||
    Boolean(args.destinatarios) ||
    Boolean(args.grupo_categoria) ||
    args.enviar_todos === 'sim'

  if (!hasRecipient) {
    return null
  }

  return { intent: 'enviar_whatsapp', args }
}

/** Groq às vezes responde «estou enviando… aguarde» sem executar — reexecutar o envio real. */
export function isFakeWhatsAppDirectReply(text: string): boolean {
  const q = norm(text)
  return (
    /\b(estou enviando|enviando agora|vou enviar|por favor aguarde|aguarde um instante|um momento)\b/.test(
      q
    ) && /\b(resumo|briefing|whatsapp|zap)\b/.test(q)
  )
}

export function isWhatsAppSendQuery(message: string): boolean {
  return SEND_VERB.test(norm(message)) && detectWhatsAppSendIntent(message) !== null
}
