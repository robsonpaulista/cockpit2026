import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const attackSchema = z.object({
  news_id: z.string().uuid(),
  attack_type: z.enum(['direct', 'indirect', 'false_claim', 'omission']),
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
      .from('adversary_attacks')
      .select(`
        *,
        news (
          id,
          title,
          source,
          url,
          published_at,
          sentiment,
          risk_level
        )
      `)
      .eq('adversary_id', params.id)
      .order('detected_at', { ascending: false })

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

export async function POST(
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
    const validated = attackSchema.parse(body)

    const { data, error } = await supabase
      .from('adversary_attacks')
      .insert({
        adversary_id: params.id,
        news_id: validated.news_id,
        attack_type: validated.attack_type,
      })
      .select(`
        *,
        news (
          id,
          title,
          source,
          url,
          published_at,
          sentiment,
          risk_level
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


