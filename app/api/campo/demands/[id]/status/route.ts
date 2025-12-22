import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const statusSchema = z.object({
  status: z.enum(['nova', 'em-andamento', 'encaminhado', 'resolvido']),
})

export async function PATCH(
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
    const { status } = statusSchema.parse(body)

    const updateData: any = { status }

    // Se mudou para "resolvido", registrar data
    if (status === 'resolvido') {
      updateData.resolved_at = new Date().toISOString()
    } else {
      updateData.resolved_at = null
    }

    const { data, error } = await supabase
      .from('demands')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
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


