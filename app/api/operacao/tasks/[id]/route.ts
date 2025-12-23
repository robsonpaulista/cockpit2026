import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['backlog', 'em-andamento', 'em-revisao', 'concluido', 'cancelado']).optional(),
  priority: z.enum(['baixa', 'media', 'alta', 'urgente']).optional(),
  due_date: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  leader_id: z.string().uuid().optional().nullable(),
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
    const validatedData = updateTaskSchema.parse(body)

    const updateData: any = { ...validatedData }
    
    // Se status mudou para concluido, marcar completed_at
    if (validatedData.status === 'concluido') {
      updateData.completed_at = new Date().toISOString()
    } else if (validatedData.status && validatedData.status !== 'concluido') {
      updateData.completed_at = null
    }

    if (validatedData.assigned_to === null) {
      updateData.assigned_to = null
    }
    if (validatedData.leader_id === null) {
      updateData.leader_id = null
    }
    if (validatedData.due_date === null) {
      updateData.due_date = null
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        territory:territories(*),
        leader:territory_leaders!tasks_leader_id_fkey(*),
        assigned_leader:territory_leaders!tasks_assigned_to_fkey(*)
      `)
      .single()

    if (error) {
      console.error('Erro ao atualizar tarefa:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Erro ao atualizar tarefa:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar tarefa' },
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
      .from('tasks')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Erro ao excluir tarefa:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao excluir tarefa:', error)
    return NextResponse.json(
      { error: 'Erro ao excluir tarefa' },
      { status: 500 }
    )
  }
}


