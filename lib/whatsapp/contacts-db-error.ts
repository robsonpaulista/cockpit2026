/** Tabela `whatsapp_contacts` ainda não criada no Supabase. */
export function isWhatsAppContactsTableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42P01') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('whatsapp_contacts') && (msg.includes('does not exist') || msg.includes('não existe'))
}
