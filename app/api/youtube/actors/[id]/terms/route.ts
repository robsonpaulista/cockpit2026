import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  term: z.string().trim().min(2).max(200),
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { term } = bodySchema.parse(await request.json())

    const { data: maxRow } = await supabase
      .from('youtube_search_terms')
      .select('priority')
      .eq('politico_id', params.id)
      .order('priority', { ascending: false })
      .limit(1)
      .maybeSingle()

    const priority = (maxRow?.priority ?? 0) + 1

    const { data, error } = await supabase
      .from('youtube_search_terms')
      .insert({
        politico_id: params.id,
        term,
        active: true,
        priority,
      })
      .select('id, politico_id, term, active, priority, created_at, updated_at')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Este termo já está cadastrado para o candidato.' }, { status: 409 })
      }
      throw new Error(error.message)
    }

    return NextResponse.json({ term: data })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message ?? 'Dados inválidos' }, { status: 400 })
    }
    const msg = e instanceof Error ? e.message : 'Erro ao adicionar termo'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
