import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  criarMaterial,
  isMaterialCampanhaTableMissing,
  listarMateriais,
} from '@/lib/material-campanha/service'
import { MATERIAL_CATEGORIAS, MATERIAL_UNIDADES } from '@/lib/material-campanha/types'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  nome: z.string().min(1).max(160),
  categoria: z.enum(MATERIAL_CATEGORIAS),
  unidade: z.enum(MATERIAL_UNIDADES).optional(),
  codigo: z.string().max(40).optional().nullable(),
  descricao: z.string().max(500).optional().nullable(),
  estoque_minimo: z.number().int().min(0).optional(),
  preco_compra: z.number().min(0).optional(),
  saldo_inicial: z.number().int().min(0).optional(),
})

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const includeInactive = new URL(request.url).searchParams.get('includeInactive') === '1'
    const data = await listarMateriais(supabase, { includeInactive })
    return NextResponse.json(data)
  } catch (e) {
    const err = e as { message?: string; code?: string }
    if (isMaterialCampanhaTableMissing(err)) {
      return NextResponse.json([], {
        headers: { 'X-Material-Campanha': 'table-missing' },
      })
    }
    console.error('material-campanha materiais GET', e)
    return NextResponse.json(
      { error: err.message ?? 'Erro ao listar materiais' },
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
    const material = await criarMaterial(supabase, {
      ...body,
      userId: user.id,
    })
    return NextResponse.json(material, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 })
    }
    const err = e as { message?: string; code?: string }
    if (isMaterialCampanhaTableMissing(err)) {
      return NextResponse.json(
        { error: 'Tabelas não criadas. Rode database/create-material-campanha.sql no Supabase.' },
        { status: 503 }
      )
    }
    console.error('material-campanha materiais POST', e)
    return NextResponse.json(
      { error: err.message ?? 'Erro ao criar material' },
      { status: 500 }
    )
  }
}
