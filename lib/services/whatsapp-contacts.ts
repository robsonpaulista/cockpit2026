import type { WhatsAppContact, WhatsAppContactCategory, WhatsAppContactInput } from '@/lib/whatsapp/contact-types'

export interface FetchWhatsAppContactsOptions {
  categoria?: WhatsAppContactCategory
  includeInactive?: boolean
}

export async function fetchWhatsAppContacts(
  options: FetchWhatsAppContactsOptions = {},
): Promise<WhatsAppContact[]> {
  const params = new URLSearchParams()
  if (options.categoria) params.set('categoria', options.categoria)
  if (options.includeInactive) params.set('includeInactive', '1')

  const qs = params.toString()
  const response = await fetch(`/api/whatsapp/contacts${qs ? `?${qs}` : ''}`)
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || 'Erro ao carregar contatos WhatsApp')
  }
  return (await response.json()) as WhatsAppContact[]
}

export async function createWhatsAppContact(input: WhatsAppContactInput): Promise<WhatsAppContact> {
  const response = await fetch('/api/whatsapp/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await response.json().catch(() => null)) as WhatsAppContact | { error?: string } | null
  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || 'Erro ao criar contato')
  }
  return data as WhatsAppContact
}

export async function updateWhatsAppContact(
  id: string,
  input: Partial<WhatsAppContactInput>,
): Promise<WhatsAppContact> {
  const response = await fetch(`/api/whatsapp/contacts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = (await response.json().catch(() => null)) as WhatsAppContact | { error?: string } | null
  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || 'Erro ao atualizar contato')
  }
  return data as WhatsAppContact
}

export async function deleteWhatsAppContact(id: string): Promise<void> {
  const response = await fetch(`/api/whatsapp/contacts/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(data?.error || 'Erro ao remover contato')
  }
}
