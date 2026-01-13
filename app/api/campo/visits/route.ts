import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const visitSchema = z.object({
  agenda_id: z.string().uuid(),
  checkin_time: z.string().optional(),
  checkout_time: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  photos: z.array(z.string()).optional(),
  videos: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

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
    const validated = visitSchema.parse(body)

    const { data, error } = await supabase
      .from('visits')
      .insert(validated)
      .select()
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




