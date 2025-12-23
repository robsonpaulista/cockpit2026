import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { latitude, longitude } = body

    // Buscar ou criar visita
    const { data: existingVisit } = await supabase
      .from('visits')
      .select('*')
      .eq('agenda_id', params.id)
      .single()

    let visitData

    if (existingVisit) {
      // Atualizar visita existente
      const { data, error } = await supabase
        .from('visits')
        .update({
          checkin_time: new Date().toISOString(),
          latitude,
          longitude,
        })
        .eq('id', existingVisit.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      visitData = data
    } else {
      // Criar nova visita
      const { data, error } = await supabase
        .from('visits')
        .insert({
          agenda_id: params.id,
          checkin_time: new Date().toISOString(),
          latitude,
          longitude,
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      visitData = data
    }

    // Atualizar status da agenda para "concluida"
    await supabase
      .from('agendas')
      .update({ status: 'concluida' })
      .eq('id', params.id)

    return NextResponse.json(visitData)
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}




