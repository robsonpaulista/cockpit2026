import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  atualizarStatusPedido,
  isMaterialCampanhaTableMissing,
} from '@/lib/material-campanha/service'
import { MATERIAL_PEDIDO_STATUS } from '@/lib/material-campanha/types'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  status: z.enum(MATERIAL_PEDIDO_STATUS),
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
    const pedido = await atualizarStatusPedido(supabase, id, body.status, user.id)
    return NextResponse.json(pedido)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 })
    }
    const err = e as { message?: string; code?: string }
    if (isMaterialCampanhaTableMissing(err)) {
      return NextResponse.json({ error: 'Tabelas não criadas' }, { status: 503 })
    }
    console.error('material-campanha pedidos PATCH', e)
    return NextResponse.json(
      { error: err.message ?? 'Erro ao atualizar pedido' },
      { status: 400 }
    )
  }
}
