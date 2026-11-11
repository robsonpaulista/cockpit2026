import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureAdmin } from '@/lib/auth-admin'

export const dynamic = 'force-dynamic'

/** Admin redefine a senha de um usuário (Supabase Auth). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = createClient()
    const adminCheck = await ensureAdmin(supabase)
    if (adminCheck instanceof NextResponse) return adminCheck

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const body = (await request.json().catch(() => ({}))) as { password?: unknown }
    const password = typeof body.password === 'string' ? body.password.trim() : ''
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Senha é obrigatória com no mínimo 6 caracteres' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: profile, error: pe } = await admin
      .from('profiles')
      .select('id')
      .eq('id', id)
      .maybeSingle()

    if (pe || !profile) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) {
      console.error('Erro ao resetar senha:', error)
      return NextResponse.json(
        { error: error.message || 'Erro ao resetar senha' },
        { status: 400 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
