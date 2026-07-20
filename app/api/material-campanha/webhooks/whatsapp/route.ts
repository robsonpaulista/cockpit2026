import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { criarPedido, isMaterialCampanhaTableMissing } from '@/lib/material-campanha/service'

export const dynamic = 'force-dynamic'

/**
 * Webhook para automação WhatsApp criar pedidos.
 * Auth: header `Authorization: Bearer <MATERIAL_CAMPANHA_WEBHOOK_TOKEN>`
 * ou `x-webhook-token: <token>` (env MATERIAL_CAMPANHA_WEBHOOK_TOKEN).
 */
const webhookSchema = z.object({
  solicitanteNome: z.string().max(120).optional().nullable(),
  solicitanteTelefone: z.string().min(8).max(30),
  municipio: z.string().max(120).optional().nullable(),
  destino: z.string().max(200).optional().nullable(),
  observacao: z.string().max(500).optional().nullable(),
  whatsappMessageId: z.string().max(120).optional().nullable(),
  itens: z
    .array(
      z.object({
        materialId: z.string().uuid().optional(),
        codigo: z.string().max(40).optional(),
        quantidade: z.number().int().positive(),
      })
    )
    .min(1),
})

function tokenOk(request: Request): boolean {
  const expected = process.env.MATERIAL_CAMPANHA_WEBHOOK_TOKEN?.trim()
  if (!expected) return false
  const auth = request.headers.get('authorization') ?? ''
  const bearer = auth.toLowerCase().startsWith('bearer ')
    ? auth.slice(7).trim()
    : ''
  const header = request.headers.get('x-webhook-token')?.trim() ?? ''
  return bearer === expected || header === expected
}

export async function POST(request: Request) {
  try {
    if (!tokenOk(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = webhookSchema.parse(await request.json())
    const supabase = createAdminClient()

    const itens: Array<{ materialId: string; quantidade: number }> = []
    for (const item of body.itens) {
      if (item.materialId) {
        itens.push({ materialId: item.materialId, quantidade: item.quantidade })
        continue
      }
      if (!item.codigo?.trim()) {
        return NextResponse.json(
          { error: 'Cada item precisa de materialId ou codigo' },
          { status: 400 }
        )
      }
      const { data: mat, error } = await supabase
        .from('campanha_materiais')
        .select('id')
        .ilike('codigo', item.codigo.trim())
        .eq('ativo', true)
        .maybeSingle()
      if (error) throw error
      if (!mat) {
        return NextResponse.json(
          { error: `Material não encontrado: ${item.codigo}` },
          { status: 404 }
        )
      }
      itens.push({ materialId: mat.id as string, quantidade: item.quantidade })
    }

    const pedido = await criarPedido(supabase, {
      solicitanteNome: body.solicitanteNome,
      solicitanteTelefone: body.solicitanteTelefone,
      municipio: body.municipio,
      destino: body.destino,
      observacao: body.observacao,
      origem: 'whatsapp',
      whatsappMessageId: body.whatsappMessageId,
      itens,
    })

    return NextResponse.json({ ok: true, pedido }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 })
    }
    const err = e as { message?: string; code?: string }
    if (isMaterialCampanhaTableMissing(err)) {
      return NextResponse.json({ error: 'Tabelas não criadas' }, { status: 503 })
    }
    console.error('material-campanha webhook whatsapp', e)
    return NextResponse.json(
      { error: err.message ?? 'Erro no webhook' },
      { status: 500 }
    )
  }
}
