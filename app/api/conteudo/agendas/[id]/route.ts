import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateSchema = z.object({
  date: z.string().optional(),
  city_id: z.string().optional().nullable(),
  type: z.enum(['visita', 'evento', 'reuniao', 'outro']).optional(),
  status: z.enum(['planejada', 'concluida', 'cancelada']).optional(),
  description: z.string().optional().nullable(),
  obra_id: z.string().uuid().optional().nullable(),
  hora_evento: z.string().optional().nullable(),
  territorio: z.string().optional().nullable(),
})

export async function GET(_request: Request, { params }: { params: { id: string } }) {
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
      .select(
        `
        *,
        cities ( id, name, state ),
        obras ( id, obra, municipio )
      `
      )
      .eq('id', params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const json = await request.json()
    const validated = updateSchema.parse(json)

    const { data, error } = await supabase
      .from('agendas')
      .update(validated)
      .eq('id', params.id)
      .select(
        `
        *,
        cities ( id, name, state ),
        obras ( id, obra, municipio )
      `
      )
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: e.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { error } = await supabase.from('agendas').delete().eq('id', params.id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
