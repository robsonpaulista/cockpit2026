import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ensureAdmin } from '@/lib/auth-admin'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient()
    const adminCheck = await ensureAdmin(supabase)
    if (adminCheck instanceof NextResponse) return adminCheck

    const idParsed = z.string().uuid().safeParse(params.id)
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Sessão inválida' }, { status: 400 })
    }

    const { error } = await supabase.rpc('admin_revoke_auth_session', {
      p_session_id: idParsed.data,
    })
    if (error) {
      console.error('[auth/sessions DELETE]', error)
      return NextResponse.json({ error: 'Não foi possível encerrar a sessão' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[auth/sessions DELETE]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
