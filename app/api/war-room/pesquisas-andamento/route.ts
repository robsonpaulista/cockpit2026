import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseMissingTableError } from '@/lib/supabase/table-error'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import {
  listPesquisasAndamentoDb,
  removerPesquisaAndamentoDb,
  salvarPesquisaAndamentoDb,
} from '@/lib/war-room/pesquisas-andamento'

export const dynamic = 'force-dynamic'

const SETUP_MSG =
  'Tabela war_room_pesquisas_andamento ausente. Execute database/create-war-room-pesquisas-andamento.sql no Supabase.'

const putSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  instituto: z.string().trim().min(1).max(120),
  cidade: z.string().trim().min(1).max(120),
  cidadeId: z.string().trim().max(80).optional().nullable(),
  status: z
    .enum(['planejada', 'em_campo', 'processando', 'entregue', 'atrasada'])
    .optional()
    .nullable(),
})

function missingTableResponse(status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error: SETUP_MSG, setupRequired: true, ...extra },
    { status },
  )
}

export async function GET() {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()
    const items = await listPesquisasAndamentoDb(supabase)
    return NextResponse.json({ items })
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        { error: 'Conexão com o Supabase temporariamente indisponível.', retryable: true },
        { status: 503 },
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao listar pesquisas em andamento'
    if (isSupabaseMissingTableError({ message: msg }) || msg.includes('42P01')) {
      return missingTableResponse(503, { items: [] })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const body = putSchema.parse(await request.json())
    const supabase = createClient()
    const item = await salvarPesquisaAndamentoDb(supabase, {
      id: body.id,
      data: body.data,
      instituto: body.instituto,
      cidade: body.cidade,
      cidadeId: body.cidadeId,
      status: body.status,
      userId: auth.user.id,
    })
    return NextResponse.json({ ok: true, item })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.errors[0]?.message ?? 'Dados inválidos' },
        { status: 400 },
      )
    }
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        { error: 'Conexão com o Supabase temporariamente indisponível.', retryable: true },
        { status: 503 },
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao salvar pesquisa em andamento'
    if (isSupabaseMissingTableError({ message: msg }) || msg.includes('42P01')) {
      return missingTableResponse(503)
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const id = new URL(request.url).searchParams.get('id')?.trim() ?? ''
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    }

    const supabase = createClient()
    await removerPesquisaAndamentoDb(supabase, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        { error: 'Conexão com o Supabase temporariamente indisponível.', retryable: true },
        { status: 503 },
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao remover pesquisa em andamento'
    if (isSupabaseMissingTableError({ message: msg }) || msg.includes('42P01')) {
      return missingTableResponse(503)
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
