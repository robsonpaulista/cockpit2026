import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { ensureAdmin } from '@/lib/auth-admin'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  userId: z.string().uuid(),
})

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const adminCheck = await ensureAdmin(supabase)
    if (adminCheck instanceof NextResponse) return adminCheck

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 })
    }

    const { error } = await supabase.rpc('admin_revoke_user_sessions', {
      p_user_id: parsed.data.userId,
    })
    if (error) {
      console.error('[auth/sessions revoke-user]', error)
      return NextResponse.json({ error: 'Não foi possível encerrar as sessões' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[auth/sessions revoke-user]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
