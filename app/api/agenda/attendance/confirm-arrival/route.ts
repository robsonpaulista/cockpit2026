import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncCampoCheckinFromGoogleEvent } from '@/lib/agenda/sync-campo-checkin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { eventId } = body

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const userId = user.id

    // Verificar se já existe registro de atendimento
    const { data: existing } = await supabase
      .from('calendar_attendances')
      .select('id, arrival_time')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      // Se já tem arrival_time, não atualizar (não permitir múltiplas confirmações)
      if (existing.arrival_time) {
        const campoSync = await syncCampoCheckinFromGoogleEvent(
          supabase,
          eventId,
          existing.arrival_time
        )
        return NextResponse.json({
          attendance: existing,
          message: 'Chegada já confirmada anteriormente',
          campoSync,
        })
      }

      // Atualizar registro existente com arrival_time
      const { data, error } = await supabase
        .from('calendar_attendances')
        .update({
          arrival_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('Erro ao confirmar chegada:', error)
        return NextResponse.json(
          { error: 'Erro ao confirmar chegada' },
          { status: 500 }
        )
      }

      const arrivalTime = data.arrival_time ?? new Date().toISOString()
      const campoSync = await syncCampoCheckinFromGoogleEvent(supabase, eventId, arrivalTime)

      return NextResponse.json({ attendance: data, campoSync })
    } else {
      // Criar novo registro com arrival_time
      const { data, error } = await supabase
        .from('calendar_attendances')
        .insert({
          event_id: eventId,
          user_id: userId,
          arrival_time: new Date().toISOString(),
          attended: false, // Default, pode ser atualizado depois
        })
        .select()
        .single()

      if (error) {
        console.error('Erro ao confirmar chegada:', error)
        return NextResponse.json(
          { error: 'Erro ao confirmar chegada' },
          { status: 500 }
        )
      }

      const arrivalTime = data.arrival_time ?? new Date().toISOString()
      const campoSync = await syncCampoCheckinFromGoogleEvent(supabase, eventId, arrivalTime)

      return NextResponse.json({ attendance: data, campoSync })
    }
  } catch (error: unknown) {
    console.error('Erro ao confirmar chegada:', error)
    const message = error instanceof Error ? error.message : 'Erro ao confirmar chegada'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
