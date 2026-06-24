/** Erro PostgREST quando a tabela/relação ainda não foi criada no Supabase. */
export function isSupabaseMissingTableError(
  error: { message?: string; code?: string } | null | undefined
): boolean {
  if (!error) return false
  return Boolean(error.message?.includes('does not exist') || error.code === '42P01')
}
