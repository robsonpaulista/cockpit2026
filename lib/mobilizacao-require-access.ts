import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type MobilizacaoAuthContext =
  | { ok: true; userId: string; isAdmin: boolean }
  | { ok: false; response: NextResponse }

export async function requireMobilizacaoAccess(): Promise<MobilizacaoAuthContext> {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Perfil não encontrado' }, { status: 403 }),
    }
  }

  const isAdmin = Boolean(profile.is_admin)
  if (!isAdmin) {
    const { data: permission, error: permissionError } = await supabase
      .from('profile_permissions')
      .select('page_key')
      .eq('profile_id', user.id)
      .eq('page_key', 'mobilizacao')
      .maybeSingle()

    if (permissionError || !permission) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Sem permissão para Mobilização' }, { status: 403 }),
      }
    }
  }

  return { ok: true, userId: user.id, isAdmin }
}
