import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureAdmin } from '@/lib/auth-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { decodeJwtSessionId, formatLocation } from '@/lib/auth-session-meta'
import { AUTH_SESSION_MAX_AGE_INTERVAL } from '@/lib/auth-session-policy'
import type { AuthSessionRow } from '@/lib/services/auth-sessions'

export const dynamic = 'force-dynamic'

const ONLINE_MS = 5 * 60 * 1000

type RpcRow = {
  session_id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  session_created_at: string | null
  session_refreshed_at: string | null
  session_ip: string | null
  session_user_agent: string | null
  last_seen_at: string | null
  last_path: string | null
  city: string | null
  region: string | null
  country: string | null
  device_label: string | null
  presence_ip: string | null
}

function statusOf(lastSeenAt: string | null): AuthSessionRow['status'] {
  if (!lastSeenAt) return 'sem_pulso'
  const t = Date.parse(lastSeenAt)
  if (!Number.isFinite(t)) return 'sem_pulso'
  return Date.now() - t <= ONLINE_MS ? 'online' : 'ausente'
}

export async function GET() {
  try {
    const supabase = createClient()
    const adminCheck = await ensureAdmin(supabase)
    if (adminCheck instanceof NextResponse) return adminCheck

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const currentSessionId = decodeJwtSessionId(session?.access_token)

    const admin = createAdminClient()
    const { error: staleError } = await admin.rpc('revoke_stale_auth_sessions', {
      p_max_age: AUTH_SESSION_MAX_AGE_INTERVAL,
    })
    if (staleError) {
      console.warn('[auth/sessions] revoke_stale', staleError.message)
    }

    const { data, error } = await supabase.rpc('admin_list_auth_sessions')
    if (error) {
      if (error.code === '42883' || /admin_list_auth_sessions/i.test(error.message)) {
        return NextResponse.json({
          currentSessionId,
          sessions: [],
          setupRequired: true,
          error: 'Execute database/create-user-presence-sessions.sql no Supabase.',
        })
      }
      console.error('[auth/sessions GET]', error)
      return NextResponse.json({ error: 'Erro ao listar sessões' }, { status: 500 })
    }

    const rows = (data ?? []) as RpcRow[]
    const sessions: AuthSessionRow[] = rows.map((row) => ({
      sessionId: row.session_id,
      userId: row.user_id,
      userName: row.user_name?.trim() || '—',
      userEmail: row.user_email?.trim() || '—',
      sessionCreatedAt: row.session_created_at,
      sessionRefreshedAt: row.session_refreshed_at,
      lastSeenAt: row.last_seen_at,
      lastPath: row.last_path,
      location: formatLocation({
        city: row.city,
        region: row.region,
        country: row.country,
      }),
      deviceLabel: row.device_label?.trim() || 'Desconhecido',
      ip: row.presence_ip || row.session_ip,
      status: statusOf(row.last_seen_at),
      isCurrent: Boolean(currentSessionId && currentSessionId === row.session_id),
    }))

    return NextResponse.json({ currentSessionId, sessions })
  } catch (error) {
    console.error('[auth/sessions GET]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
