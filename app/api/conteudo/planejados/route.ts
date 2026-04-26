import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const obraId = searchParams.get('obra_id')

    let q = supabase
      .from('conteudos_planejados')
      .select(
        `
        *,
        obras ( id, obra, municipio, tipo, status, valor_total, parceiro, orgao, imagem_url ),
        referencias_visuais ( id, imagem_url, tema, formato ),
        agendas (
          id,
          date,
          territorio,
          cities ( name, state )
        )
      `
      )
      .order('created_at', { ascending: false })

    if (status) {
      q = q.eq('status', status)
    }
    if (obraId) {
      q = q.eq('obra_id', obraId)
    }

    const { data, error } = await q
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
