function normalize(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const ASSISTANT_NAMES = /\b(jarvis|cockpit|assistente|copilot)\b/

const GREETING_ONLY =
  /^(?:oi|ola|hey|e\s*ai|eai|hello|hi|bom\s+dia|boa\s+tarde|boa\s+noite)(?:\s+(?:jarvis|cockpit|assistente))?[!.?\s]*$/i

const DATA_INTENT =
  /\b(agenda|noticia|notícias|expectativa|pesquisa|demanda|pedido|teresina|picos|lideranca|liderança|chapa|alerta|instagram|territorio|território|compromisso|destaque|whatsapp|resumo\s+operacional|briefing)\b/

const ACTION_INTENT =
  /\b(envia|enviar|envie|mand[ae]|dispar[ae]|resumo\s+operacional|briefing)\b/

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
  if (DATA_INTENT.test(normalize(raw))) return false
  if (ACTION_INTENT.test(normalize(raw))) return false

  if (GREETING_ONLY.test(raw)) return true

  const q = normalize(raw)
  if (q.length > 35) return false
  return /^(oi|ola|bom dia|boa tarde|boa noite)\b/.test(q)
}

function greetingFromQuery(query: string): 'manha' | 'tarde' | 'noite' | null {
  const q = normalize(query)
  if (/\bbom\s+dia\b/.test(q)) return 'manha'
  if (/\bboa\s+tarde\b/.test(q)) return 'tarde'
  if (/\bboa\s+noite\b/.test(q)) return 'noite'
  return null
}

function greetingFromClock(): 'manha' | 'tarde' | 'noite' {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'manha'
  if (hour >= 12 && hour < 18) return 'tarde'
  return 'noite'
}

const JARVIS_RETURNING_KEY = 'jarvis-has-chatted'

function markJarvisGreeted(): boolean {
  if (typeof window === 'undefined') return false
  const returning = localStorage.getItem(JARVIS_RETURNING_KEY) === '1'
  localStorage.setItem(JARVIS_RETURNING_KEY, '1')
  return returning
}

function buildGreetingOpener(query: string): string {
  const explicit = greetingFromQuery(query)
  if (explicit === 'manha') return 'Bom dia!'
  if (explicit === 'tarde') return 'Boa tarde!'
  if (explicit === 'noite') return 'Boa noite!'

  const q = normalize(query)
  if (/^(oi|ola|hey|e\s*ai|eai|hello|hi)\b/.test(q)) return 'Olá!'

  const period = greetingFromClock()
  return period === 'manha' ? 'Bom dia!' : period === 'tarde' ? 'Boa tarde!' : 'Boa noite!'
}

/** Resposta social curta — sem listar funcionalidades (isso fica em buildHelpReply). */
export function buildGreetingReply(query?: string): string {
  const opener = buildGreetingOpener(query ?? '')
  const returning = markJarvisGreeted()
  const followUp = returning
    ? 'Bom falar com você novamente. Em que posso te ajudar?'
    : 'Em que posso ajudar hoje?'

  return `${opener} ${followUp}`
}

export function buildUnknownQueryReply(): string {
  return 'Não entendi bem. Posso ajudar com **agenda**, **notícias em destaque**, **expectativa em uma cidade**, **pesquisas** e mais. Diga **ajuda** para ver exemplos.'
}

export function buildHelpReply(): string {
  return `**O que posso fazer:**\n\n**Navegação:**\n› abrir agenda\n› ir para território e base\n› mostrar WhatsApp\n› voltar para visão geral\n\n**Por cidade:**\n› expectativa em Teresina\n› lideranças em Picos\n› visitas em Picos\n› demandas em Parnaíba\n\n**Campo & Agenda:**\n› últimas visitas de campo\n› quantas viagens em maio de 2026\n› descrição da visita a Teresina\n› cidades visitadas
› qual cidade eu mais visitei\n\n**Agenda (Google):**\n› compromissos de hoje\n› agenda de amanhã\n\n**Geral:**\n› notícias em destaque\n› projeção chapa federal\n› alertas críticos\n› territórios frios\n\n**WhatsApp:**\n› envia o resumo operacional para o CEO\n› manda briefing de Picos para Maria e João\n› (sempre diga o destinatário — não envia para todos sem você pedir)\n\n**Redes:**\n› métricas do Instagram`
}

/** Remove menção ao assistente para não virar "cidade". */
export function stripAssistantMention(query: string): string {
  return query.replace(ASSISTANT_NAMES, ' ').replace(/\s+/g, ' ').trim()
}
