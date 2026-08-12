import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureAdmin } from '@/lib/auth-admin'
import {
  hasGoogleCalendarEnvCredentials,
  toPublicGoogleCalendarConfig,
} from '@/lib/agenda/google-calendar-fetch'

export const dynamic = 'force-dynamic'

function publicConfigResponse(row: {
  calendar_id: string
  service_account_email: string | null
  credentials: unknown
  subject_user: string | null
}) {
  return {
    config: toPublicGoogleCalendarConfig(row),
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from('google_calendar_config')
      .select('calendar_id, service_account_email, credentials, subject_user')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar configuração:', error)
      return NextResponse.json({ error: 'Erro ao buscar configuração' }, { status: 500 })
    }

    if (!data?.calendar_id) {
      return NextResponse.json({
        config: null,
        hasEnvCredentials: hasGoogleCalendarEnvCredentials(),
      })
    }

    return NextResponse.json({
      ...publicConfigResponse(data),
      hasEnvCredentials: hasGoogleCalendarEnvCredentials(),
    })
  } catch (error: unknown) {
    console.error('Erro ao buscar configuração:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const adminCheck = await ensureAdmin(supabase)
    if (adminCheck instanceof NextResponse) return adminCheck

    const user = adminCheck.profile
    const body = await request.json()
    const { calendarId, serviceAccountEmail, credentials, subjectUser } = body as {
      calendarId?: string
      serviceAccountEmail?: string
      credentials?: string
      subjectUser?: string
    }

    if (!calendarId?.trim()) {
      return NextResponse.json({ error: 'calendarId é obrigatório' }, { status: 400 })
    }

    if (!subjectUser?.trim()) {
      return NextResponse.json(
        { error: 'subjectUser (e-mail Workspace) é obrigatório' },
        { status: 400 },
      )
    }

    const adminSupabase = createAdminClient()
    const { data: existing } = await adminSupabase
      .from('google_calendar_config')
      .select('id, credentials, service_account_email')
      .limit(1)
      .maybeSingle()

    const hasEnv = hasGoogleCalendarEnvCredentials()
    const nextCredentials =
      typeof credentials === 'string' && credentials.trim()
        ? credentials.trim()
        : existing?.credentials ?? null

    if (!nextCredentials && !hasEnv) {
      return NextResponse.json(
        {
          error:
            'Informe as credenciais JSON ou configure GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY no ambiente.',
        },
        { status: 400 },
      )
    }

    const nextEmail =
      (typeof serviceAccountEmail === 'string' && serviceAccountEmail.trim()) ||
      existing?.service_account_email ||
      process.env.GOOGLE_SERVICE_ACCOUNT_CALENDAR_EMAIL ||
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      null

    const payload = {
      calendar_id: calendarId.trim(),
      service_account_email: nextEmail,
      subject_user: subjectUser.trim(),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
      ...(typeof credentials === 'string' && credentials.trim()
        ? { credentials: credentials.trim() }
        : nextCredentials
          ? {}
          : { credentials: null }),
    }

    if (existing?.id) {
      const { data, error } = await adminSupabase
        .from('google_calendar_config')
        .update(payload)
        .eq('id', existing.id)
        .select('calendar_id, service_account_email, credentials, subject_user')
        .single()

      if (error) {
        console.error('Erro ao atualizar configuração:', error)
        return NextResponse.json({ error: 'Erro ao atualizar configuração' }, { status: 500 })
      }

      return NextResponse.json({ success: true, ...publicConfigResponse(data) })
    }

    const { data, error } = await adminSupabase
      .from('google_calendar_config')
      .insert({
        calendar_id: calendarId.trim(),
        service_account_email: nextEmail,
        credentials: typeof credentials === 'string' && credentials.trim() ? credentials.trim() : null,
        subject_user: subjectUser.trim(),
        created_by: user.id,
        updated_by: user.id,
      })
      .select('calendar_id, service_account_email, credentials, subject_user')
      .single()

    if (error) {
      console.error('Erro ao criar configuração:', error)
      return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 })
    }

    return NextResponse.json({ success: true, ...publicConfigResponse(data) })
  } catch (error: unknown) {
    console.error('Erro ao salvar configuração:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
