export type AuthSessionRow = {
  sessionId: string
  userId: string
  userName: string
  userEmail: string
  sessionCreatedAt: string | null
  sessionRefreshedAt: string | null
  lastSeenAt: string | null
  lastPath: string | null
  location: string
  deviceLabel: string
  ip: string | null
  status: 'online' | 'ausente' | 'sem_pulso'
  isCurrent: boolean
}

export type AuthSessionsPayload = {
  currentSessionId: string | null
  sessions: AuthSessionRow[]
}

export async function fetchAuthSessions(): Promise<AuthSessionsPayload> {
  const res = await fetch('/api/auth/sessions', { cache: 'no-store' })
  const json = (await res.json().catch(() => ({}))) as {
    error?: string
    currentSessionId?: string | null
    sessions?: AuthSessionRow[]
  }
  if (!res.ok) {
    throw new Error(json.error || 'Não foi possível listar as sessões')
  }
  return {
    currentSessionId: json.currentSessionId ?? null,
    sessions: json.sessions ?? [],
  }
}

export async function revokeAuthSession(sessionId: string): Promise<void> {
  const res = await fetch(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' })
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(json.error || 'Não foi possível encerrar a sessão')
  }
}

export async function revokeUserAuthSessions(userId: string): Promise<void> {
  const res = await fetch('/api/auth/sessions/revoke-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(json.error || 'Não foi possível encerrar as sessões')
  }
}

export async function pingSessionPresence(
  path: string,
): Promise<'ok' | 'expired'> {
  const res = await fetch('/api/auth/presence', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
    keepalive: true,
  })
  if (res.status === 401) {
    const json = (await res.json().catch(() => ({}))) as { code?: string }
    if (json.code === 'session_expired') return 'expired'
  }
  return 'ok'
}
