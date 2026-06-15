import { isGreetingQuery } from '@/lib/agent/greeting-reply'

function normalize(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
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

export const JARVIS_READ_ALOUD_HINT = 'Diga «ler» ou «fale o resultado» para ouvir em voz alta.'
