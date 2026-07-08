import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import { obraJadyelExiste, salvarStatusObraJadyel } from '@/lib/jadyel-obras-mapa'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  status: z.string().trim().max(120).nullable(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID da obra é obrigatório' }, { status: 400 })
    }

    if (!obraJadyelExiste(id)) {
      return NextResponse.json({ error: 'Obra não encontrada na planilha Jadyel' }, { status: 404 })
    }

    const body = bodySchema.parse(await request.json())
    const supabase = createClient()
    await salvarStatusObraJadyel(supabase, id, body.status, auth.user.id)

    return NextResponse.json({ ok: true, id, status: body.status?.trim() || null })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message ?? 'Dados inválidos' }, { status: 400 })
    }
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        {
          error: 'Conexão com o Supabase temporariamente indisponível. Tente novamente em instantes.',
          retryable: true,
        },
        { status: 503 }
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao salvar status'
    if (msg.includes('does not exist') || msg.includes('42P01')) {
      return NextResponse.json(
        {
          error: 'Tabela obras_mapa_jadyel_status ausente. Execute database/create-obras-mapa-jadyel-status.sql no Supabase.',
          setupRequired: true,
        },
        { status: 503 }
      )
    }
    console.error('[obras/mapa/status]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
