import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    const isAdmin = Boolean(profile?.is_admin)
    if (isAdmin) {
      return NextResponse.json({
        permissions: null,
        is_admin: true,
      })
    }

    const { data: pp } = await supabase
      .from('profile_permissions')
      .select('page_key')
      .eq('profile_id', user.id)
    const permissions = (pp ?? []).map((r) => r.page_key)
    return NextResponse.json({
      permissions,
      is_admin: false,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
