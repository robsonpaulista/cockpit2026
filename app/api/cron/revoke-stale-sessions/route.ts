import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertCronAuthorized } from '@/lib/cron-auth'
import { AUTH_SESSION_MAX_AGE_DAYS, AUTH_SESSION_MAX_AGE_INTERVAL } from '@/lib/auth-session-policy'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const denied = assertCronAuthorized(request)
    if (denied) return denied

    const admin = createAdminClient()
    const { data, error } = await admin.rpc('revoke_stale_auth_sessions', {
      p_max_age: AUTH_SESSION_MAX_AGE_INTERVAL,
    })
    if (error) {
      console.error('[cron/revoke-stale-sessions]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      maxAgeDays: AUTH_SESSION_MAX_AGE_DAYS,
      revoked: typeof data === 'number' ? data : 0,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Falha ao encerrar sessões antigas'
    console.error('[cron/revoke-stale-sessions]', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
