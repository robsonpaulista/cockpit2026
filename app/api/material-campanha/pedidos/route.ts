import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  criarPedido,
  isMaterialCampanhaTableMissing,
  listarPedidos,
} from '@/lib/material-campanha/service'
import { MATERIAL_PEDIDO_ORIGENS } from '@/lib/material-campanha/types'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  solicitanteNome: z.string().max(120).optional().nullable(),
  solicitanteTelefone: z.string().max(30).optional().nullable(),
  municipio: z.string().max(120).optional().nullable(),
  destino: z.string().max(200).optional().nullable(),
  observacao: z.string().max(500).optional().nullable(),
  origem: z.enum(MATERIAL_PEDIDO_ORIGENS).optional(),
  itens: z
    .array(
      z.object({
        materialId: z.string().uuid(),
        quantidade: z.number().int().positive(),
      })
    )
    .min(1),
})

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const andamento = searchParams.get('andamento') !== '0'
    const limite = Number(searchParams.get('limite') ?? 40)
    const data = await listarPedidos(supabase, {
      andamento,
      limite: Number.isFinite(limite) ? limite : 40,
    })
    return NextResponse.json(data)
  } catch (e) {
    const err = e as { message?: string; code?: string }
    if (isMaterialCampanhaTableMissing(err)) {
      return NextResponse.json([], { headers: { 'X-Material-Campanha': 'table-missing' } })
    }
    console.error('material-campanha pedidos GET', e)
    return NextResponse.json(
      { error: err.message ?? 'Erro ao listar pedidos' },
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
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const body = createSchema.parse(await request.json())
    const pedido = await criarPedido(supabase, {
      ...body,
      userId: user.id,
      origem: body.origem ?? 'manual',
    })
    return NextResponse.json(pedido, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 })
    }
    const err = e as { message?: string }
    console.error('material-campanha pedidos POST', e)
    return NextResponse.json(
      { error: err.message ?? 'Erro ao criar pedido' },
      { status: 400 }
    )
  }
}
