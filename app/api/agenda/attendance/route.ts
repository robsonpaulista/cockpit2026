import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

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

    const { data, error } = await supabase
      .from('calendar_attendances')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Erro ao buscar atendimento:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar status de atendimento' },
        { status: 500 }
      )
    }

    return NextResponse.json({ attendance: data || null })
  } catch (error: any) {
    console.error('Erro ao buscar atendimento:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar status de atendimento' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { eventId, attended, notes } = body

    if (!eventId || attended === undefined) {
      return NextResponse.json(
        { error: 'eventId e attended são obrigatórios' },
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

    // Verificar se já existe registro
    const { data: existing } = await supabase
      .from('calendar_attendances')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .single()

    if (existing) {
      // Atualizar registro existente
      const { data, error } = await supabase
        .from('calendar_attendances')
        .update({
          attended,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('Erro ao atualizar atendimento:', error)
        return NextResponse.json(
          { error: 'Erro ao atualizar status de atendimento' },
          { status: 500 }
        )
      }

      return NextResponse.json({ attendance: data })
    } else {
      // Criar novo registro
      const { data, error } = await supabase
        .from('calendar_attendances')
        .insert({
          event_id: eventId,
          user_id: userId,
          attended,
          notes: notes || null,
        })
        .select()
        .single()

      if (error) {
        console.error('Erro ao criar atendimento:', error)
        return NextResponse.json(
          { error: 'Erro ao salvar status de atendimento' },
          { status: 500 }
        )
      }

      return NextResponse.json({ attendance: data })
    }
  } catch (error: any) {
    console.error('Erro ao salvar atendimento:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar status de atendimento' },
      { status: 500 }
    )
  }
}
