import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchGoogleCalendarEvents } from '@/lib/agenda/google-calendar-fetch'

export const dynamic = 'force-dynamic'

/**
 * Busca eventos do Google Calendar.
 * Credenciais vêm só do ambiente ou da tabela no servidor — nunca do body do browser.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      calendarId?: string
      subjectUser?: string
    }

    const adminSupabase = createAdminClient()
    const { data: stored } = await adminSupabase
      .from('google_calendar_config')
      .select('calendar_id, service_account_email, credentials, subject_user')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const calendarId = body.calendarId?.trim() || stored?.calendar_id
    const subjectUser = body.subjectUser?.trim() || stored?.subject_user || undefined

    if (!calendarId) {
      return NextResponse.json(
        { error: 'Calendário não configurado. Informe calendarId ou salve a config na Agenda.' },
        { status: 400 },
      )
    }

    const events = await fetchGoogleCalendarEvents({
      calendarId,
      serviceAccountEmail: stored?.service_account_email,
      credentials: stored?.credentials,
      subjectUser,
    })

    return NextResponse.json({
      events,
      total: events.length,
    })
  } catch (error: unknown) {
    console.error('Erro ao buscar eventos do Google Calendar:', error)

    const err = error as { code?: number; message?: string }
    if (err.code === 403) {
      return NextResponse.json(
        {
          error:
            'Acesso negado. Verifique Domain-Wide Delegation no Admin Console e o e-mail do usuário Workspace.',
        },
        { status: 403 },
      )
    }

    if (err.code === 404) {
      return NextResponse.json(
        { error: 'Calendário não encontrado. Verifique o ID do calendário.' },
        { status: 404 },
      )
    }

    return NextResponse.json(
      { error: err.message || 'Erro ao conectar com Google Calendar' },
      { status: 500 },
    )
  }
}
