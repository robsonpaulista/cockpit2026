import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  ativa: z.boolean().optional(),
  engajamento: z.enum(['alto', 'medio', 'baixo']).optional(),
  tema: z
    .enum(['pavimentacao', 'turismo', 'saude', 'educacao', 'saneamento', 'iluminacao', 'geral'])
    .optional(),
  formato: z.enum(['feed', 'story', 'reels_capa']).optional(),
  origem: z.enum(['instagram', 'criado_no_cockpit']).optional(),
  observacoes: z.string().nullable().optional(),
})

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = schema.parse(await request.json())
    const { data, error } = await supabase
      .from('referencias_visuais')
      .update(body)
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: e.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
