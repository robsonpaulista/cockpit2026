import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProfileRow {
  id: string
  email: string
  name: string
  role: string
  is_admin?: boolean
  avatar_url?: string
  created_at?: string
  updated_at?: string
}

/**
 * Garante que o usuário atual está autenticado e é admin.
 * Retorna { profile } ou uma NextResponse de erro (401/403).
 */
export async function ensureAdmin(
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
  if (!p.is_admin) {
    return NextResponse.json(
      { error: 'Acesso negado. Apenas administradores podem gerenciar usuários.' },
      { status: 403 }
    )
  }

  return { profile: p }
}
