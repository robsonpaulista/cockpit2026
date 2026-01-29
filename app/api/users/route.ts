import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureAdmin } from '@/lib/auth-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const adminCheck = await ensureAdmin(supabase)
    if (adminCheck instanceof NextResponse) return adminCheck

    const admin = createAdminClient()
    const { data: profiles, error: pe } = await admin
      .from('profiles')
      .select('id, email, name, role, is_admin, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (pe) {
      console.error('Erro ao listar perfis:', pe)
      return NextResponse.json({ error: 'Erro ao listar usuários' }, { status: 500 })
    }

    const { data: perms } = await admin.from('profile_permissions').select('profile_id, page_key')
    const byProfile = (perms ?? []).reduce<Record<string, string[]>>((acc, r) => {
      if (!acc[r.profile_id]) acc[r.profile_id] = []
      acc[r.profile_id].push(r.page_key)
      return acc
    }, {})

    const users = (profiles ?? []).map((p) => ({
      ...p,
      permissions: byProfile[p.id] ?? [],
    }))
    return NextResponse.json({ users })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const adminCheck = await ensureAdmin(supabase)
    if (adminCheck instanceof NextResponse) return adminCheck

    const body = await request.json()
    const { email, password, name, role, is_admin, permissions } = body as {
      email?: string
      password?: string
      name?: string
      role?: string
      is_admin?: boolean
      permissions?: string[]
    }

    if (!email?.trim()) {
      return NextResponse.json({ error: 'E-mail é obrigatório' }, { status: 400 })
    }
    if (!password?.trim() || String(password).length < 6) {
      return NextResponse.json({ error: 'Senha é obrigatória com no mínimo 6 caracteres' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: authUser, error: createError } = await admin.auth.admin.createUser({
      email: email.trim(),
      password: String(password).trim(),
      email_confirm: true,
    })

    if (createError) {
      const msg = createError.message || 'Erro ao criar usuário'
      if (/already registered|already exists/i.test(msg)) {
        return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (!authUser.user) {
      return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
    }

    const { error: profileError } = await admin.from('profiles').insert({
      id: authUser.user.id,
      email: email.trim(),
      name: (name ?? '').trim() || email.split('@')[0],
      role: (role ?? 'coordenacao').trim() || 'coordenacao',
      is_admin: Boolean(is_admin),
    })

    if (profileError) {
      await admin.auth.admin.deleteUser(authUser.user.id).catch(() => {})
      console.error('Erro ao criar perfil:', profileError)
      return NextResponse.json({ error: 'Erro ao criar perfil do usuário' }, { status: 500 })
    }

    const pageKeys = Array.isArray(permissions) ? permissions.filter((k) => typeof k === 'string' && k) : []
    if (pageKeys.length > 0) {
      await admin.from('profile_permissions').insert(
        pageKeys.map((page_key) => ({ profile_id: authUser.user.id, page_key }))
      )
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('id, email, name, role, is_admin, created_at, updated_at')
      .eq('id', authUser.user.id)
      .single()
    const { data: pp } = await admin
      .from('profile_permissions')
      .select('page_key')
      .eq('profile_id', authUser.user.id)
    return NextResponse.json({
      user: {
        ...profile,
        permissions: (pp ?? []).map((r) => r.page_key),
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
