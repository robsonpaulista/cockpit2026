import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase com service role (admin).
 * Usar APENAS em API routes / server. Nunca exponha ao cliente.
 * Bypassa RLS e permite auth.admin.* (criar/lista/atualizar/deletar usuários).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios para o admin client.')
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
