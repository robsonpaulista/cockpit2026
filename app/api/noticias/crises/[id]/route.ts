import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateCrisisSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'monitoring', 'resolved', 'archived']).optional(),
  narrative_id: z.string().uuid().optional().nullable(),
  resolved_at: z.string().optional().nullable(),
})

export async function GET(
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

    const { data, error } = await supabase
      .from('crises')
      .select(`
        *,
        narratives (
          id,
          theme,
          key_message
        )
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Crise não encontrada' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const validated = updateCrisisSchema.parse(body)

    const updateData: any = { ...validated }

    // Se mudou para "resolved", calcular tempo de resposta e registrar data
    if (validated.status === 'resolved' && !validated.resolved_at) {
      // Buscar crise atual para calcular tempo de resposta
      const { data: currentCrisis } = await supabase
        .from('crises')
        .select('detected_at')
        .eq('id', params.id)
        .single()

      if (currentCrisis?.detected_at) {
        const detectedAt = new Date(currentCrisis.detected_at)
        const now = new Date()
        const responseTimeMinutes = Math.round((now.getTime() - detectedAt.getTime()) / (1000 * 60))
        updateData.response_time = responseTimeMinutes
        updateData.resolved_at = now.toISOString()
      }
    }

    const { data, error } = await supabase
      .from('crises')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        narratives (
          id,
          theme,
          key_message
        )
      `)
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

export async function DELETE(
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

    const { error } = await supabase.from('crises').delete().eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}


