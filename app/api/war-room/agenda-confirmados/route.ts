import { NextResponse } from 'next/server'
import { aggregateEventAttendances } from '@/lib/agenda/aggregate-event-attendances'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRouteUser } from '@/lib/supabase/route-auth'

function parseEventIds(request: Request): string[] {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')
  const eventIdsRaw = searchParams.get('eventIds')
  return [
    ...(eventId ? [eventId] : []),
    ...(eventIdsRaw ? eventIdsRaw.split(',') : []),
  ]
    .map((id) => id.trim())
    .filter(Boolean)
}

export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const uniqueIds = [...new Set(parseEventIds(request))].slice(0, 80)
    if (uniqueIds.length === 0) {
      return NextResponse.json({ error: 'eventId é obrigatório' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('calendar_attendances')
      .select('event_id, attended, arrival_time')
      .in('event_id', uniqueIds)

    if (error) {
      console.error('[war-room/agenda-confirmados GET]', error)
      return NextResponse.json(
        { error: 'Erro ao buscar confirmados da agenda' },
        { status: 500 },
      )
    }

    const attendances = aggregateEventAttendances(data ?? [])
    return NextResponse.json({ attendances })
  } catch (error: unknown) {
    console.error('[war-room/agenda-confirmados GET]', error)
    const message =
      error instanceof Error ? error.message : 'Erro ao buscar confirmados da agenda'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
