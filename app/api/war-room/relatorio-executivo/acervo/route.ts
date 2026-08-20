import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import {
  isHttpUrl,
  listRelatorioAcervoMunicipio,
  removerRelatorioAcervoItem,
  salvarRelatorioAcervoItem,
} from '@/lib/war-room/relatorio-executivo-acervo'

export const dynamic = 'force-dynamic'

const putSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  municipio: z.string().trim().min(1).max(120),
  obraId: z.string().trim().max(200).optional().nullable(),
  titulo: z.string().trim().min(1).max(500),
  status: z.string().trim().max(120).optional().nullable(),
  url: z
    .string()
    .trim()
    .min(1)
    .max(2000)
    .refine((v) => isHttpUrl(v), 'URL inválida (use http:// ou https://)'),
  label: z.string().trim().max(200).optional().nullable(),
  sortOrder: z.number().int().min(0).max(9999).optional().nullable(),
})

export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const municipio = new URL(request.url).searchParams.get('municipio')?.trim() ?? ''
    if (!municipio) {
      return NextResponse.json({ error: 'municipio é obrigatório' }, { status: 400 })
    }

    const supabase = createClient()
    const items = await listRelatorioAcervoMunicipio(supabase, municipio)
    return NextResponse.json({ items })
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        { error: 'Conexão com o Supabase temporariamente indisponível.', retryable: true },
        { status: 503 },
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao listar acervo'
    if (msg.includes('does not exist') || msg.includes('42P01')) {
      return NextResponse.json(
        {
          error:
            'Tabela relatorio_executivo_acervo ausente. Execute database/create-relatorio-executivo-acervo.sql no Supabase.',
          setupRequired: true,
          items: [],
        },
        { status: 503 },
      )
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
    const item = await salvarRelatorioAcervoItem(supabase, {
      id: body.id,
      municipio: body.municipio,
      obraId: body.obraId,
      titulo: body.titulo,
      status: body.status,
      url: body.url,
      label: body.label,
      sortOrder: body.sortOrder,
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
    const msg = e instanceof Error ? e.message : 'Erro ao salvar acervo'
    if (msg.includes('does not exist') || msg.includes('42P01')) {
      return NextResponse.json(
        {
          error:
            'Tabela relatorio_executivo_acervo ausente. Execute database/create-relatorio-executivo-acervo.sql no Supabase.',
          setupRequired: true,
        },
        { status: 503 },
      )
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
    await removerRelatorioAcervoItem(supabase, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        { error: 'Conexão com o Supabase temporariamente indisponível.', retryable: true },
        { status: 503 },
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao remover acervo'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
