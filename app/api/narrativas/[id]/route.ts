import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const narrativeUpdateSchema = z.object({
  theme: z.string().min(1).optional(),
  target_audience: z.string().min(1).optional(),
  key_message: z.string().min(1).optional(),
  arguments: z.array(z.string()).optional(),
  proofs: z.array(z.any()).optional(),
  tested_phrases: z.array(z.string()).optional(),
  usage_count: z.number().int().min(0).optional(),
  performance_score: z.number().int().min(0).max(100).optional(),
  status: z.enum(['ativa', 'rascunho', 'arquivada']).optional(),
  phase_id: z.string().uuid().nullable().optional(),
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
      .from('narratives')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Narrativa não encontrada' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Erro ao buscar narrativa:', error)
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
    const validatedData = narrativeUpdateSchema.parse(body)

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (validatedData.theme !== undefined) updateData.theme = validatedData.theme
    if (validatedData.target_audience !== undefined) updateData.target_audience = validatedData.target_audience
    if (validatedData.key_message !== undefined) updateData.key_message = validatedData.key_message
    if (validatedData.arguments !== undefined) updateData.arguments = validatedData.arguments
    if (validatedData.proofs !== undefined) updateData.proofs = validatedData.proofs
    if (validatedData.tested_phrases !== undefined) updateData.tested_phrases = validatedData.tested_phrases
    // Não atualizar usage_count e performance_score via API manual - eles são calculados automaticamente
    // if (validatedData.usage_count !== undefined) updateData.usage_count = validatedData.usage_count
    // if (validatedData.performance_score !== undefined) updateData.performance_score = validatedData.performance_score
    if (validatedData.status !== undefined) updateData.status = validatedData.status
    if (validatedData.phase_id !== undefined) updateData.phase_id = validatedData.phase_id

    const { data, error } = await supabase
      .from('narratives')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Narrativa não encontrada' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Erro ao atualizar narrativa:', error)
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

    const { error } = await supabase
      .from('narratives')
      .delete()
      .eq('id', params.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao deletar narrativa:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

