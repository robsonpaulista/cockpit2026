/** Erros do PostgREST quando coluna/tabela ainda não existe no banco (migration pendente). */
export function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST204') return true
  return /column .+ does not exist/i.test(error.message ?? '')
}
