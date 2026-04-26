import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { OBRA_CONTEUDO_SEEDS } from '@/lib/conteudo/agenda-pack'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as { obraId?: string }
    if (!body.obraId) {
      return NextResponse.json({ error: 'obraId é obrigatório' }, { status: 400 })
    }

    const { data: obra, error: oErr } = await supabase
      .from('obras')
      .select('id, municipio, obra, territorio')
      .eq('id', body.obraId)
      .single()

    if (oErr || !obra) {
      return NextResponse.json({ error: 'Obra não encontrada' }, { status: 404 })
    }

    const cidade = obra.municipio?.trim() || ''

    const rows = OBRA_CONTEUDO_SEEDS.map((s) => ({
      obra_id: obra.id,
      cidade: cidade || null,
      territorio: obra.territorio ?? null,
      fase: s.fase,
      formato: s.formato,
      template: s.template,
      status: 'rascunho' as const,
      campanha_geral: false,
    }))

    const { data: inserted, error: iErr } = await supabase.from('conteudos_planejados').insert(rows).select('id')

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 500 })
    }

    return NextResponse.json({ created: inserted?.length ?? 0, ids: inserted?.map((r) => r.id) })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
