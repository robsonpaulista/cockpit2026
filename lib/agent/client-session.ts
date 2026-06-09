const STORAGE_KEY = 'cockpit2026.agent.sessionId'

/** Identificador estável por navegador — usado no rate limit da API do agente. */
export function getAgentSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}
