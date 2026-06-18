import { getAgentSessionId } from '@/lib/agent/client-session'

export interface AgentChatLogPayload {
  userMessage: string
  assistantMessage: string
  source?: string
  intent?: string
  sessionId?: string
  pagePath?: string
}

export function logAgentExchangeClient(payload: AgentChatLogPayload): void {
  const userMessage = payload.userMessage.trim()
  const assistantMessage = payload.assistantMessage.trim()
  if (!userMessage || !assistantMessage) return

  void fetch('/api/agent/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userMessage: userMessage.slice(0, 1200),
      assistantMessage: assistantMessage.slice(0, 8000),
      source: payload.source ?? 'client',
      intent: payload.intent,
      sessionId: payload.sessionId ?? getAgentSessionId(),
      pagePath: payload.pagePath,
    }),
  }).catch(() => {
    /* falha silenciosa — não bloqueia o Jarvis */
  })
}
