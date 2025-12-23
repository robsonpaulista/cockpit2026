import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const phaseSchema = z.object({
  name: z.string().min(1),
  start_date: z.string(),
  end_date: z.string(),
  active: z.boolean().optional(),
  indicators: z.array(z.string()).optional(),
  restrictions: z.array(z.string()).optional(),
  automations: z.array(z.string()).optional(),
})

export async function GET() {
  try {
    const supabase = createClient()

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar todas as fases
    const { data, error } = await supabase
      .from('campaign_phases')
      .select('*')
      .order('start_date', { ascending: true })

    if (error) {
      console.error('Erro ao buscar fases:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao buscar fases:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validated = phaseSchema.parse(body)

    // Validar datas
    const startDate = new Date(validated.start_date)
    const endDate = new Date(validated.end_date)

    if (startDate >= endDate) {
      return NextResponse.json(
        { error: 'Data de início deve ser anterior à data de fim' },
        { status: 400 }
      )
    }

    // Se esta fase está sendo ativada, desativar outras
    if (validated.active) {
      await supabase
        .from('campaign_phases')
        .update({ active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000') // dummy para atualizar todas
    }

    const { data, error } = await supabase
      .from('campaign_phases')
      .insert({
        name: validated.name,
        start_date: validated.start_date,
        end_date: validated.end_date,
        active: validated.active || false,
        indicators: validated.indicators || [],
        restrictions: validated.restrictions || [],
        automations: validated.automations || [],
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar fase:', error)
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

    console.error('Erro ao criar fase:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}




