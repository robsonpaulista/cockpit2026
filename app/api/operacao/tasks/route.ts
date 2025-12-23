import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const taskSchema = z.object({
  territory_id: z.string().uuid(),
  leader_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['backlog', 'em-andamento', 'em-revisao', 'concluido', 'cancelado']).default('backlog'),
  priority: z.enum(['baixa', 'media', 'alta', 'urgente']).default('media'),
  due_date: z.string().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const user = await supabase.auth.getUser()

    if (!user.data.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        territory:territories(*),
        leader:territory_leaders!tasks_leader_id_fkey(*),
        assigned_leader:territory_leaders!tasks_assigned_to_fkey(*)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar tarefas:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao buscar tarefas:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar tarefas' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await supabase.auth.getUser()

    if (!user.data.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = taskSchema.parse(body)

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...validatedData,
        leader_id: validatedData.leader_id || null,
        assigned_to: validatedData.assigned_to || null,
        due_date: validatedData.due_date || null,
        created_by: user.data.user.id,
      })
      .select(`
        *,
        territory:territories(*),
        leader:territory_leaders!tasks_leader_id_fkey(*),
        assigned_leader:territory_leaders!tasks_assigned_to_fkey(*)
      `)
      .single()

    if (error) {
      console.error('Erro ao criar tarefa:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Erro ao criar tarefa:', error)
    return NextResponse.json(
      { error: 'Erro ao criar tarefa' },
      { status: 500 }
    )
  }
}


