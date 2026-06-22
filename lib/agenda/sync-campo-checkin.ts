import type { SupabaseClient } from '@supabase/supabase-js'

export type CampoCheckinSyncResult = {
  synced: boolean
  agendaId?: string
  visitId?: string
  reason?: 'no_link' | 'already_checked_in' | 'column_missing' | 'error'
  error?: string
}

export type AgendaArrivalSyncResult = {
  synced: boolean
  eventId?: string
  reason?: 'no_link' | 'already_confirmed' | 'column_missing' | 'error'
  error?: string
}

function isGoogleEventIdColumnMissing(message: string): boolean {
  return message.includes('google_event_id')
}

/** Agenda Google → check-in em Campo & Agenda (quando há vínculo). */
export async function syncCampoCheckinFromGoogleEvent(
  supabase: SupabaseClient,
  googleEventId: string,
  checkinTime: string = new Date().toISOString()
): Promise<CampoCheckinSyncResult> {
  const { data: agenda, error: agendaError } = await supabase
    .from('agendas')
    .select('id, status')
    .eq('google_event_id', googleEventId)
    .maybeSingle()

  if (agendaError) {
    if (isGoogleEventIdColumnMissing(agendaError.message)) {
      return { synced: false, reason: 'column_missing' }
    }
    return { synced: false, reason: 'error', error: agendaError.message }
  }

  if (!agenda) return { synced: false, reason: 'no_link' }

  const { data: existingVisit, error: visitLookupError } = await supabase
    .from('visits')
    .select('id, checkin_time')
    .eq('agenda_id', agenda.id)
    .maybeSingle()

  if (visitLookupError) {
    return { synced: false, reason: 'error', error: visitLookupError.message }
  }

  if (existingVisit?.checkin_time) {
    if (agenda.status !== 'concluida') {
      await supabase.from('agendas').update({ status: 'concluida' }).eq('id', agenda.id)
    }
    return {
      synced: true,
      agendaId: agenda.id,
      visitId: existingVisit.id,
      reason: 'already_checked_in',
    }
  }

  let visitId: string

  if (existingVisit) {
    const { data, error } = await supabase
      .from('visits')
      .update({ checkin_time: checkinTime })
      .eq('id', existingVisit.id)
      .select('id')
      .single()

    if (error) return { synced: false, reason: 'error', error: error.message }
    visitId = data.id
  } else {
    const { data, error } = await supabase
      .from('visits')
      .insert({ agenda_id: agenda.id, checkin_time: checkinTime })
      .select('id')
      .single()

    if (error) return { synced: false, reason: 'error', error: error.message }
    visitId = data.id
  }

  await supabase.from('agendas').update({ status: 'concluida' }).eq('id', agenda.id)

  return { synced: true, agendaId: agenda.id, visitId }
}

/** Check-in em Campo → confirmação de chegada na agenda Google (quando há vínculo). */
export async function syncAgendaArrivalFromCampoCheckin(
  supabase: SupabaseClient,
  agendaId: string,
  userId: string,
  arrivalTime: string = new Date().toISOString()
): Promise<AgendaArrivalSyncResult> {
  const { data: agenda, error: agendaError } = await supabase
    .from('agendas')
    .select('google_event_id')
    .eq('id', agendaId)
    .maybeSingle()

  if (agendaError) {
    if (isGoogleEventIdColumnMissing(agendaError.message)) {
      return { synced: false, reason: 'column_missing' }
    }
    return { synced: false, reason: 'error', error: agendaError.message }
  }

  const eventId = agenda?.google_event_id
  if (!eventId) return { synced: false, reason: 'no_link' }

  const { data: existing } = await supabase
    .from('calendar_attendances')
    .select('id, arrival_time')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.arrival_time) {
    return { synced: true, eventId, reason: 'already_confirmed' }
  }

  if (existing) {
    const { error } = await supabase
      .from('calendar_attendances')
      .update({ arrival_time: arrivalTime, updated_at: arrivalTime })
      .eq('id', existing.id)

    if (error) return { synced: false, reason: 'error', error: error.message }
  } else {
    const { error } = await supabase.from('calendar_attendances').insert({
      event_id: eventId,
      user_id: userId,
      arrival_time: arrivalTime,
      attended: false,
    })

    if (error) return { synced: false, reason: 'error', error: error.message }
  }

  return { synced: true, eventId }
}
