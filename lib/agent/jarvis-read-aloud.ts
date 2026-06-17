import { isGreetingQuery } from '@/lib/agent/greeting-reply'
import { parseJarvisResultContent } from '@/lib/agent/jarvis-result-view'

function normalize(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^#+\s*/, '')
    .replace(/^[›>•\-]\s*/, '')
    .trim()
}

/** Linha de dado bruto (datas, séries, bases) — não entra na leitura em voz. */
function isDataDetailLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (/^\d{2}\/\d{2}\/\d{4}\s*[—–-]/.test(t)) return true
  if (/^[•\-*]\s*\d{2}\/\d{2}\/\d{4}/.test(t)) return true
  if (/^base:\s*\d+\s*pesquisa/i.test(t)) return true
  if (/m[eé]dia:\s*[\d,.]+%/i.test(t)) return true
  if (/^\*\*[A-Za-zÀ-ú\s]{2,28}\*\*\s*$/.test(t)) return true
  if (/^\d+\.\s+\d{2}\/\d{2}\/\d{4}/.test(t)) return true
  return false
}

const INSIGHT_LABEL =
  /(?:conclus[aã]o(?:\s+r[aá]pida)?|resumo|s[ií]ntese|em\s+resumo|insight|leitura|ressalva|recomenda[cç][aã]o|pontos?\s+principais?|destaque|pr[oó]ximos?\s+passos?)/i

const INLINE_INSIGHT =
  /\*\*((?:conclus[aã]o(?:\s+r[aá]pida)?|resumo|s[ií]ntese|em\s+resumo|insight|leitura))\*\*:?\s*(.+)/i

const LABELED_INSIGHT =
  /^(?:[-•*]\s*)?\*\*((?:ressalva|recomenda[cç][aã]o|insight|destaque|alerta|pr[oó]ximos?\s+passos?):)\s*\*\*\s*(.+)/i

const HEADING_INSIGHT = /^#{1,3}\s*(.+)$/

export interface JarvisSpeechBrief {
  text: string
  segments: string[]
}

/** Texto curto para TTS — foco em conclusão, ressalvas e recomendações. */
export function buildJarvisSpeechBrief(content: string, userQuery?: string): JarvisSpeechBrief {
  const rawLines = content.split('\n')
  const segments: string[] = []
  let title = ''
  let collectingSection = false
  let sectionBuffer: string[] = []

  const flushSection = () => {
    if (sectionBuffer.length > 0) {
      segments.push(sectionBuffer.join(' '))
      sectionBuffer = []
    }
    collectingSection = false
  }

  for (const raw of rawLines) {
    const trimmed = raw.trim()
    if (!trimmed) {
      if (collectingSection) flushSection()
      continue
    }

    if (!title && /^#{1,3}\s+/.test(trimmed)) {
      title = stripMarkdown(trimmed)
      continue
    }

    if (isDataDetailLine(trimmed)) {
      if (collectingSection) flushSection()
      continue
    }

    const inline = trimmed.match(INLINE_INSIGHT)
    if (inline?.[2]) {
      flushSection()
      segments.push(stripMarkdown(inline[2]))
      continue
    }

    const labeled = trimmed.match(LABELED_INSIGHT)
    if (labeled?.[1] && labeled[2]) {
      flushSection()
      const label = stripMarkdown(labeled[1].replace(/:$/, ''))
      segments.push(`${label}: ${stripMarkdown(labeled[2])}`)
      continue
    }

    const heading = trimmed.match(HEADING_INSIGHT)
    if (heading?.[1] && INSIGHT_LABEL.test(heading[1])) {
      flushSection()
      collectingSection = true
      const rest = heading[1].replace(INSIGHT_LABEL, '').trim()
      if (rest) sectionBuffer.push(stripMarkdown(rest))
      continue
    }

    if (collectingSection) {
      if (/^#{1,3}\s/.test(trimmed) || isDataDetailLine(trimmed)) {
        flushSection()
        continue
      }
      sectionBuffer.push(stripMarkdown(trimmed))
      continue
    }

    if (INSIGHT_LABEL.test(trimmed) && !/^\*\*[^*]+\*\*\s*$/.test(trimmed)) {
      flushSection()
      const cleaned = stripMarkdown(trimmed.replace(/^[^:]+:\s*/, (m) => (INSIGHT_LABEL.test(m) ? '' : m)))
      if (cleaned.length > 12) segments.push(cleaned)
    }
  }

  flushSection()

  if (segments.length > 0) {
    const intro = title ? `${title}.` : ''
    const all = intro ? [intro, ...segments] : segments
    return { text: all.join(' '), segments: all }
  }

  const view = parseJarvisResultContent(content, userQuery)
  const fallback: string[] = []

  if (view.title) fallback.push(view.title)
  for (const stat of view.stats.filter((s) => s.highlight).slice(0, 3)) {
    fallback.push(`${stat.label}: ${stat.value}`)
  }
  if (view.bullets.length > 0) {
    fallback.push(...view.bullets.slice(0, 4).map(stripMarkdown))
  }
  for (const section of view.sections) {
    if (!section.heading || !INSIGHT_LABEL.test(section.heading)) continue
    const lines = section.lines.filter((l) => !isDataDetailLine(l)).map(stripMarkdown)
    if (lines.length) fallback.push(...lines)
  }
  if (view.footer) fallback.push(stripMarkdown(view.footer))

  if (fallback.length === 0) {
    const prose = rawLines
      .map((l) => l.trim())
      .filter((l) => l && !isDataDetailLine(l) && !/^#{1,3}\s/.test(l))
      .map(stripMarkdown)
      .filter((l) => l.length > 20)
      .slice(0, 3)
    fallback.push(...prose)
  }

  if (fallback.length === 0) {
    const short = stripMarkdown(content).slice(0, 320)
    return { text: short, segments: [short] }
  }

  return { text: fallback.join(' '), segments: fallback }
}

/** Usuário pede para ouvir a última resposta (economia: TTS só sob demanda). */
export function isJarvisReadAloudRequest(query: string): boolean {
  const raw = query.trim()
  if (!raw || raw.length > 80) return false
  if (isGreetingQuery(raw)) return false

  const q = normalize(raw)

  if (/^(ler|leia|leie|fale|fala|repita|repete|ouca|ouça|narre|narrar)$/.test(q)) return true
  if (/\b(diz|diga)\s+(de\s+)?novo\b/.test(q)) return true
  if (/\b(repete|repita)\s+(de\s+)?novo\b/.test(q)) return true

  const wantsSpeech =
    /\b(ler|leia|leie|fale|fala|repita|repete|ouca|ouça|narre|narrar)\b/.test(q)
  const refersResult =
    /\b(resultado|resposta|relatorio|relatório|conteudo|conteúdo|isso|ai|aí|tela|modal|painel|noticias?|materia|matéria|agenda|destaque)\b/.test(
      q
    )

  if (wantsSpeech && refersResult) return true
  if (/\bme\s+(ler|leia|fale|fala|repita)\b/.test(q)) return true
  if (/\b(fale|fala|ler|leia)\s+(pra|para)\s+(mim|nos|nós)\b/.test(q)) return true

  return false
}

export function shouldAutoSpeakJarvisAnswer(
  userQuery: string,
  response: { skipAnswerSpeech?: boolean; speakAnswer?: boolean }
): boolean {
  if (response.skipAnswerSpeech) return false
  if (response.speakAnswer) return true
  return isGreetingQuery(userQuery)
}

export interface JarvisReadableReply {
  id: string
  content: string
  speechSegments?: string[]
  action?: {
    type: 'navigate' | 'link'
    url: string
    label: string
  }
}

export function findLastJarvisReadableReply(
  messages: Array<{
    id: string
    role: string
    content: string
    speechSegments?: string[]
    skipAnswerSpeech?: boolean
    action?: JarvisReadableReply['action']
  }>
): JarvisReadableReply | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]
    if (msg.role !== 'assistant') continue
    const content = msg.content.trim()
    if (!content) continue
    if (content === 'Pronto.') continue
    if (isGreetingQuery(content)) continue
    if (/^não há modal/i.test(content)) continue
    if (msg.skipAnswerSpeech && !msg.speechSegments?.length) continue

    return {
      id: msg.id,
      content: msg.content,
      speechSegments: msg.speechSegments,
      action: msg.action,
    }
  }
  return null
}

export function resolveJarvisSpeechForReadAloud(
  reply: Pick<JarvisReadableReply, 'content' | 'speechSegments'>,
  userQuery?: string
): JarvisSpeechBrief {
  if (reply.speechSegments?.length) {
    return { text: reply.speechSegments.join(' '), segments: reply.speechSegments }
  }
  return buildJarvisSpeechBrief(reply.content, userQuery)
}

export const JARVIS_READ_ALOUD_HINT =
  'Diga «ler» para ouvir só o resumo e os insights do relatório.'
