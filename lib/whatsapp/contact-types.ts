export const WHATSAPP_CONTACT_CATEGORIES = [
  'geral',
  'executivo',
  'assessoria',
  'territorio',
] as const

export type WhatsAppContactCategory = (typeof WHATSAPP_CONTACT_CATEGORIES)[number]

export interface WhatsAppContact {
  id: string
  nome: string
  telefone: string
  cargo: string | null
  categoria: WhatsAppContactCategory
  is_default: boolean
  notas: string | null
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface WhatsAppContactInput {
  nome: string
  telefone: string
  cargo?: string | null
  categoria?: WhatsAppContactCategory
  is_default?: boolean
  notas?: string | null
  ativo?: boolean
}

export const WHATSAPP_CONTACT_CATEGORY_LABELS: Record<WhatsAppContactCategory, string> = {
  geral: 'Geral',
  executivo: 'Executivo',
  assessoria: 'Assessoria',
  territorio: 'Território',
}
