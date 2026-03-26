import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProfileRow } from '@/lib/auth-admin'

const PAGE_KEY = 'gestao_pesquisas'

/**
 * Admin ou usuário com permissão da página `gestao_pesquisas`.
 */
export async function ensureGestaoPesquisasAccess(
  supabase: SupabaseClient
): Promise<{ profile: ProfileRow } | NextResponse> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 403 })
  }

  const p = profile as ProfileRow
  if (p.is_admin) {
    return { profile: p }
  }

  const { data: perms } = await supabase
    .from('profile_permissions')
    .select('page_key')
    .eq('profile_id', user.id)

  const keys = (perms ?? []).map((r) => r.page_key)
  if (keys.includes(PAGE_KEY)) {
    return { profile: p }
  }

  return NextResponse.json(
    { error: 'Sem permissão para gestão de pesquisas de campo.' },
    { status: 403 }
  )
}
