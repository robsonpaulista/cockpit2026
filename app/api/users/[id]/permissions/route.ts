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
    const { data, error } = await admin
      .from('profile_permissions')
      .select('page_key')
      .eq('profile_id', id)

    if (error) {
      console.error('Erro ao buscar permissões:', error)
      return NextResponse.json({ error: 'Erro ao buscar permissões' }, { status: 500 })
    }
    const permissions = (data ?? []).map((r) => r.page_key)
    return NextResponse.json({ permissions })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function PUT(
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
    const pageKeys = Array.isArray(body?.permissions)
      ? (body.permissions as unknown[]).filter((k) => typeof k === 'string' && (k as string).trim()).map((k) => String(k).trim())
      : []

    const admin = createAdminClient()
    await admin.from('profile_permissions').delete().eq('profile_id', id)

    if (pageKeys.length > 0) {
      const { error } = await admin.from('profile_permissions').insert(
        pageKeys.map((page_key) => ({ profile_id: id, page_key }))
      )
      if (error) {
        console.error('Erro ao salvar permissões:', error)
        return NextResponse.json({ error: 'Erro ao salvar permissões' }, { status: 500 })
      }
    }

    return NextResponse.json({ permissions: pageKeys })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
