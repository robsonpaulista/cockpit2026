import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchGoogleCalendarEvents } from '@/lib/agenda/google-calendar-fetch'

export const dynamic = 'force-dynamic'

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
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Erro ao buscar configuração do calendário' }, { status: 500 })
    }

    if (!data?.calendar_id || !data.credentials) {
      return NextResponse.json(
        { error: 'Google Calendar não configurado. Acesse a página Agenda para configurar.' },
        { status: 404 }
      )
    }

    const events = await fetchGoogleCalendarEvents({
      calendarId: data.calendar_id,
      serviceAccountEmail: data.service_account_email || undefined,
      credentials: data.credentials,
      subjectUser: data.subject_user,
    })

    return NextResponse.json({
      events,
      total: events.length,
      source: 'google-calendar',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar eventos da agenda'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
