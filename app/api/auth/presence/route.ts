import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getClientIP } from '@/lib/rate-limit'
import {
  decodeJwtSessionId,
  geoFromRequest,
  parseDeviceLabel,
} from '@/lib/auth-session-meta'
import { AUTH_SESSION_MAX_AGE_INTERVAL } from '@/lib/auth-session-policy'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  path: z.string().trim().max(240).optional(),
})

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    const sessionId = decodeJwtSessionId(session?.access_token)
    if (!sessionId) {
      return NextResponse.json({ ok: true, skipped: 'no_session_id' })
    }

    const { data: ageCheck, error: ageError } = await supabase.rpc(
      'enforce_own_session_max_age',
      {
        p_session_id: sessionId,
        p_max_age: AUTH_SESSION_MAX_AGE_INTERVAL,
      },
    )
    if (!ageError) {
      const expired =
        ageCheck &&
        typeof ageCheck === 'object' &&
        'expired' in ageCheck &&
        (ageCheck as { expired?: unknown }).expired === true
      if (expired) {
        return NextResponse.json(
          { error: 'Sessão encerrada após 3 dias. Entre novamente.', code: 'session_expired' },
          { status: 401 },
        )
      }
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    const path = parsed.success ? parsed.data.path ?? null : null
    const ua = request.headers.get('user-agent')
    const geo = geoFromRequest(request)
    const ip = getClientIP(request)
    const now = new Date().toISOString()

    const { error } = await supabase.from('user_presence').upsert(
      {
        session_id: sessionId,
        user_id: user.id,
        last_seen_at: now,
        last_path: path,
        ip: ip === 'unknown' ? null : ip,
        user_agent: ua,
        city: geo.city,
        region: geo.region,
        country: geo.country,
        device_label: parseDeviceLabel(ua),
      },
      { onConflict: 'session_id' },
    )

    if (error) {
      if (error.code === '42P01' || /user_presence/i.test(error.message)) {
        return NextResponse.json({ ok: true, skipped: 'table_missing' })
      }
      console.error('[auth/presence]', error)
      return NextResponse.json({ error: 'Falha ao registrar presença' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[auth/presence]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
