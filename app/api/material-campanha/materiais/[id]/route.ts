import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  atualizarMaterial,
  isMaterialCampanhaTableMissing,
} from '@/lib/material-campanha/service'
import { MATERIAL_CATEGORIAS, MATERIAL_UNIDADES } from '@/lib/material-campanha/types'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  nome: z.string().min(1).max(160).optional(),
  categoria: z.enum(MATERIAL_CATEGORIAS).optional(),
  unidade: z.enum(MATERIAL_UNIDADES).optional(),
  codigo: z.string().max(40).optional().nullable(),
  descricao: z.string().max(500).optional().nullable(),
  estoque_minimo: z.number().int().min(0).optional(),
  preco_compra: z.number().min(0).optional(),
  ativo: z.boolean().optional(),
})

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { id } = await context.params
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = patchSchema.parse(await request.json())
    const material = await atualizarMaterial(supabase, id, { ...body, userId: user.id })
    return NextResponse.json(material)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 })
    }
    const err = e as { message?: string; code?: string }
    if (isMaterialCampanhaTableMissing(err)) {
      return NextResponse.json({ error: 'Tabelas não criadas' }, { status: 503 })
    }
    console.error('material-campanha materiais PATCH', e)
    return NextResponse.json(
      { error: err.message ?? 'Erro ao atualizar material' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const material = await atualizarMaterial(supabase, id, { ativo: false, userId: user.id })
    return NextResponse.json(material)
  } catch (e) {
    const err = e as { message?: string }
    console.error('material-campanha materiais DELETE', e)
    return NextResponse.json(
      { error: err.message ?? 'Erro ao desativar material' },
      { status: 500 }
    )
  }
}
