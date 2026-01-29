import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureAdmin } from '@/lib/auth-admin'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient()
    const adminCheck = await ensureAdmin(supabase)
    if (adminCheck instanceof NextResponse) return adminCheck

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const admin = createAdminClient()
    const { data: profile, error: pe } = await admin
      .from('profiles')
      .select('id, email, name, role, is_admin, created_at, updated_at')
      .eq('id', id)
      .single()

    if (pe || !profile) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const { data: pp } = await admin
      .from('profile_permissions')
      .select('page_key')
      .eq('profile_id', id)
    const permissions = (pp ?? []).map((r) => r.page_key)
    return NextResponse.json({ user: { ...profile, permissions } })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient()
    const adminCheck = await ensureAdmin(supabase)
    if (adminCheck instanceof NextResponse) return adminCheck

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    const body = await request.json()
    const { name, role, is_admin } = body as { name?: string; role?: string; is_admin?: boolean }

    const admin = createAdminClient()
    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = String(name ?? '').trim()
    if (role !== undefined) updates.role = String(role ?? '').trim() || 'coordenacao'
    if (is_admin !== undefined) updates.is_admin = Boolean(is_admin)

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select('id, email, name, role, is_admin, created_at, updated_at')
      .single()

    if (error) {
      console.error('Erro ao atualizar perfil:', error)
      return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 })
    }

    const { data: pp } = await admin
      .from('profile_permissions')
      .select('page_key')
      .eq('profile_id', id)
    const permissions = (pp ?? []).map((r) => r.page_key)
    return NextResponse.json({ user: { ...data, permissions } })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient()
    const adminCheck = await ensureAdmin(supabase)
    if (adminCheck instanceof NextResponse) return adminCheck

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

    if (id === adminCheck.profile.id) {
      return NextResponse.json({ error: 'Você não pode excluir a si mesmo' }, { status: 400 })
    }

    const admin = createAdminClient()
    await admin.from('profile_permissions').delete().eq('profile_id', id)
    await admin.from('profiles').delete().eq('id', id)
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) {
      console.error('Erro ao excluir usuário auth:', error)
      return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
