import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateLeaderSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  role: z.string().optional(),
  status: z.enum(['ativo', 'inativo']).optional(),
  notes: z.string().optional(),
  user_id: z.string().uuid().optional().nullable(),
})

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const user = await supabase.auth.getUser()

    if (!user.data.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateLeaderSchema.parse(body)

    const updateData: any = { ...validatedData }
    if (validatedData.email === '') {
      updateData.email = null
    }
    if (validatedData.user_id === null) {
      updateData.user_id = null
    }

    const { data, error } = await supabase
      .from('territory_leaders')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        territory:territories(*)
      `)
      .single()

    if (error) {
      console.error('Erro ao atualizar líder:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Erro ao atualizar líder:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar líder' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const user = await supabase.auth.getUser()

    if (!user.data.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { error } = await supabase
      .from('territory_leaders')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Erro ao excluir líder:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir líder:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir líder' },
      { status: 500 }
    )
  }
}


