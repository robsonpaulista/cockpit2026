import type { SupabaseClient } from '@supabase/supabase-js'

/** Páginas que precisam ler a base compartilhada de pesquisas (campanha). */
const SHARED_POLL_PAGE_KEYS = [
  'pesquisa',
  'territorio',
  'ipt',
  'campo',
  'agenda',
] as const

/**
 * Admin ou usuário com permissão de pesquisa / território / IPT
 * pode ler todas as polls (dados de campanha, não só as próprias).
 */
export async function userCanReadSharedPolls(
  supabase: SupabaseClient,
  userId: string,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return true

  const { data } = await supabase
    .from('profile_permissions')
    .select('page_key')
    .eq('profile_id', userId)
    .in('page_key', [...SHARED_POLL_PAGE_KEYS])
    .limit(1)

  return (data?.length ?? 0) > 0
}
