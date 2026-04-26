import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: row, error } = await supabase
      .from('conteudos_planejados')
      .select('id, status, storage_path_rascunho, imagem_url')
      .eq('id', params.id)
      .single()

    if (error || !row) {
      return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
    }

    if (row.imagem_url && ['aprovado', 'publicado'].includes(row.status)) {
      return NextResponse.json({ url: row.imagem_url, tipo: 'publica' })
    }

    if (!row.storage_path_rascunho) {
      return NextResponse.json({ error: 'Sem imagem de rascunho' }, { status: 400 })
    }

    // Service role evita falhas de RLS ao criar signed URL (usuário já autenticado acima).
    const admin = createAdminClient()
    const { data: signed, error: sErr } = await admin.storage
      .from('rascunhos')
      .createSignedUrl(row.storage_path_rascunho, 3600)

    if (sErr || !signed?.signedUrl) {
      return NextResponse.json({ error: sErr?.message ?? 'Não foi possível assinar URL' }, { status: 500 })
    }

    return NextResponse.json({ url: signed.signedUrl, tipo: 'assinada' })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
