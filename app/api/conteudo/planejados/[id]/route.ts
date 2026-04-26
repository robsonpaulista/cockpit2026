import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const patchSchema = z.object({
  campanha_geral: z.boolean().optional(),
})

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const json = await request.json()
    const body = patchSchema.parse(json)

    const { data, error } = await supabase
      .from('conteudos_planejados')
      .update(body)
      .eq('id', params.id)
      .select('id, campanha_geral')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: e.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
