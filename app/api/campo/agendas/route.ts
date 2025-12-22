import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const agendaSchema = z.object({
  date: z.string(),
  city_id: z.string().optional(), // Pode ser UUID ou código IBGE (ex: 'ibge-2201000')
  type: z.enum(['visita', 'evento', 'reuniao', 'outro']),
  status: z.enum(['planejada', 'concluida', 'cancelada']).optional(),
  description: z.string().optional(),
})

export async function GET() {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('agendas')
      .select(`
        *,
        cities (
          id,
          name,
          state
        )
      `)
      .order('date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validated = agendaSchema.parse(body)

    const { data, error } = await supabase
      .from('agendas')
      .insert({
        ...validated,
        candidate_id: user.id,
        status: validated.status || 'planejada',
      })
      .select(`
        *,
        cities (
          id,
          name,
          state
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

