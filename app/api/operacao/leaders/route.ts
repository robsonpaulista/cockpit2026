import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const leaderSchema = z.object({
  territory_id: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  role: z.string().optional(),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
  notes: z.string().optional(),
  user_id: z.string().uuid().optional().nullable(),
})

export async function GET() {
  try {
    const supabase = await createClient()
    const user = await supabase.auth.getUser()

    if (!user.data.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('territory_leaders')
      .select(`
        *,
        territory:territories(*)
      `)
      .order('name')

    if (error) {
      console.error('Erro ao buscar líderes:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao buscar líderes:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar líderes' },
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
    const validatedData = leaderSchema.parse(body)

    const { data, error } = await supabase
      .from('territory_leaders')
      .insert({
        ...validatedData,
        email: validatedData.email || null,
        user_id: validatedData.user_id || null,
      })
      .select(`
        *,
        territory:territories(*)
      `)
      .single()

    if (error) {
      console.error('Erro ao criar líder:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    console.error('Erro ao criar líder:', error)
    return NextResponse.json(
      { error: 'Erro ao criar líder' },
      { status: 500 }
    )
  }
}


