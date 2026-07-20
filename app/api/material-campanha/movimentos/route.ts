import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  isMaterialCampanhaTableMissing,
  listarMovimentos,
  registrarMovimento,
} from '@/lib/material-campanha/service'
import { MATERIAL_MOVIMENTO_TIPOS } from '@/lib/material-campanha/types'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  materialId: z.string().uuid(),
  tipo: z.enum(MATERIAL_MOVIMENTO_TIPOS),
  quantidade: z.number().int().positive(),
  motivo: z.string().max(300).optional().nullable(),
  destino: z.string().max(200).optional().nullable(),
  origem: z.string().max(200).optional().nullable(),
  pedidoId: z.string().uuid().optional().nullable(),
  precoUnitario: z.number().min(0).optional().nullable(),
})

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const materialId = searchParams.get('materialId') ?? undefined
    const limite = Number(searchParams.get('limite') ?? 50)
    const data = await listarMovimentos(supabase, {
      materialId,
      limite: Number.isFinite(limite) ? limite : 50,
    })
    return NextResponse.json(data)
  } catch (e) {
    const err = e as { message?: string; code?: string }
    if (isMaterialCampanhaTableMissing(err)) {
      return NextResponse.json([], { headers: { 'X-Material-Campanha': 'table-missing' } })
    }
    console.error('material-campanha movimentos GET', e)
    return NextResponse.json(
      { error: err.message ?? 'Erro ao listar movimentos' },
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
    if (body.tipo === 'saida' && !body.pedidoId) {
      return NextResponse.json(
        {
          error:
            'Saída manual não é permitida. A baixa ocorre ao marcar Entregar no Kanban (Separado).',
        },
        { status: 400 }
      )
    }
    const result = await registrarMovimento(supabase, {
      materialId: body.materialId,
      tipo: body.tipo,
      quantidade: body.quantidade,
      motivo: body.motivo,
      destino: body.destino,
      origem: body.origem,
      pedidoId: body.pedidoId,
      precoUnitario: body.precoUnitario,
      userId: user.id,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 })
    }
    const err = e as { message?: string }
    console.error('material-campanha movimentos POST', e)
    return NextResponse.json(
      { error: err.message ?? 'Erro ao registrar movimento' },
      { status: 400 }
    )
  }
}
