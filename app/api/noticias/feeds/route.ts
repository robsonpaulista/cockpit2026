import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const feedSchema = z.object({
  name: z.string().min(1),
  rss_url: z.string().url(),
  active: z.boolean().optional().default(true),
  auto_classify: z.boolean().optional().default(true),
})

export async function GET() {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('news_feeds')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

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
    const validated = feedSchema.parse(body)

    // Verificar se já existe feed com mesma URL para este usuário
    const { data: existing } = await supabase
      .from('news_feeds')
      .select('id')
      .eq('user_id', user.id)
      .eq('rss_url', validated.rss_url)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Este feed RSS já está configurado' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('news_feeds')
      .insert({
        ...validated,
        user_id: user.id,
      })
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


