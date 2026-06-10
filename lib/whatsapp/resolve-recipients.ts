import { getWhatsAppCeoPhone } from '@/lib/whatsapp/ceo-phone'
import { normalizePhoneToJid } from '@/lib/whatsapp/send'
import type { WhatsAppContact, WhatsAppContactCategory } from '@/lib/whatsapp/contact-types'
import { WHATSAPP_CONTACT_CATEGORIES } from '@/lib/whatsapp/contact-types'

export interface ResolvedWhatsAppRecipient {
  id: string
  nome: string
  phone: string
  jid: string
}

const MAX_RECIPIENTS_SEM_TODOS = 5

function norm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function contactToRecipient(contact: WhatsAppContact): ResolvedWhatsAppRecipient | null {
  const jid = normalizePhoneToJid(contact.telefone)
  if (!jid) return null
  return {
    id: contact.id,
    nome: contact.nome,
    phone: contact.telefone,
    jid,
  }
}

function dedupe(recipients: ResolvedWhatsAppRecipient[]): ResolvedWhatsAppRecipient[] {
  const seen = new Set<string>()
  const out: ResolvedWhatsAppRecipient[] = []
  for (const r of recipients) {
    if (seen.has(r.jid)) continue
    seen.add(r.jid)
    out.push(r)
  }
  return out
}

function parseNameList(raw: string): string[] {
  return raw
    .split(/[,;]|\s+e\s+/i)
    .map((s) => s.trim())
    .map((s) => s.replace(/^(o|a|os|as)\s+/i, '').trim())
    .filter(Boolean)
}

/** Um token → no máximo um contato (melhor correspondência). */
function findBestContactMatch(contacts: WhatsAppContact[], token: string): WhatsAppContact | null {
  const t = norm(token)
  if (!t || t.length < 2) return null

  let best: WhatsAppContact | null = null
  let bestScore = 0

  for (const c of contacts) {
    const nome = norm(c.nome)
    const cargo = norm(c.cargo ?? '')
    let score = 0

    if (nome === t) score = 100
    else if (nome.split(/\s+/)[0] === t) score = 90
    else if (nome.startsWith(t)) score = 75
    else if (t.length >= 3 && nome.includes(t)) score = 55
    else if (cargo && cargo.includes(t)) score = 35
    else continue

    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }

  return bestScore >= 35 ? best : null
}

function resolveByNames(
  contacts: WhatsAppContact[],
  tokens: string[],
): { recipients: ResolvedWhatsAppRecipient[]; notFound: string[] } {
  const recipients: ResolvedWhatsAppRecipient[] = []
  const notFound: string[] = []

  for (const token of tokens) {
    const match = findBestContactMatch(contacts, token)
    if (!match) {
      notFound.push(token)
      continue
    }
    const r = contactToRecipient(match)
    if (r) recipients.push(r)
  }

  return { recipients: dedupe(recipients), notFound }
}

function resolvePadrao(contacts: WhatsAppContact[]): ResolvedWhatsAppRecipient[] {
  const def = contacts.find((c) => c.is_default) ?? contacts[0]
  if (def) {
    const r = contactToRecipient(def)
    return r ? [r] : []
  }

  const ceo = getWhatsAppCeoPhone()
  const jid = ceo ? normalizePhoneToJid(ceo) : null
  if (!jid) return []

  return [{ id: 'ceo-env', nome: 'CEO', phone: ceo, jid }]
}

function resolveByCategoria(
  contacts: WhatsAppContact[],
  categoria: WhatsAppContactCategory,
): ResolvedWhatsAppRecipient[] {
  const out: ResolvedWhatsAppRecipient[] = []
  for (const c of contacts.filter((x) => x.categoria === categoria)) {
    const r = contactToRecipient(c)
    if (r) out.push(r)
  }
  return dedupe(out)
}

function wantsTodosExplicit(args: Record<string, string>): boolean {
  const d = norm(args.destinatario || '')
  if (args.enviar_todos === 'sim') return true
  return d === 'todos' || d === 'todos_os_contatos' || d === 'todos_cadastrados'
}

/**
 * Resolve destinatários com prioridade: nomes explícitos > padrão/CEO > grupo por categoria > todos.
 * Nunca mistura modos nem envia para todos os cadastros sem pedido explícito.
 */
export function resolveWhatsAppRecipients(
  contacts: WhatsAppContact[],
  args: Record<string, string>,
): { recipients: ResolvedWhatsAppRecipient[]; error?: string } {
  const active = contacts.filter((c) => c.ativo)

  if (wantsTodosExplicit(args)) {
    const all = active
      .map((c) => contactToRecipient(c))
      .filter((r): r is ResolvedWhatsAppRecipient => Boolean(r))
    if (all.length === 0) {
      return { recipients: [], error: 'Não há contatos cadastrados para enviar.' }
    }
    return { recipients: dedupe(all) }
  }

  const destinatariosRaw = args.destinatarios?.trim()
  if (destinatariosRaw) {
    const { recipients, notFound } = resolveByNames(active, parseNameList(destinatariosRaw))
    if (notFound.length > 0 && recipients.length === 0) {
      return {
        recipients: [],
        error: `Não encontrei contato para: ${notFound.join(', ')}. Cadastre em Dashboard → WhatsApp.`,
      }
    }
    if (notFound.length > 0) {
      return {
        recipients: [],
        error: `Encontrei alguns nomes, mas não localizei: ${notFound.join(', ')}. Confirme o cadastro ou o nome exato.`,
      }
    }
    if (recipients.length > MAX_RECIPIENTS_SEM_TODOS) {
      return {
        recipients: [],
        error: `Muitos destinatários (${recipients.length}). Especifique no máximo ${MAX_RECIPIENTS_SEM_TODOS} pessoas, ou diga «para todos os contatos».`,
      }
    }
    return { recipients }
  }

  const destinatario = (args.destinatario || '').trim()
  if (destinatario) {
    const d = norm(destinatario)
    if (d === 'padrao' || d === 'padrão' || d === 'ceo' || d === 'default') {
      const padrao = resolvePadrao(active)
      if (padrao.length === 0) {
        return {
          recipients: [],
          error: 'Nenhum contato padrão cadastrado. Defina um em Dashboard → WhatsApp ou diga o nome da pessoa.',
        }
      }
      return { recipients: padrao }
    }

    const { recipients, notFound } = resolveByNames(active, parseNameList(destinatario))
    if (recipients.length === 0) {
      return {
        recipients: [],
        error: `Não encontrei «${destinatario}» na agenda. Cadastre o contato ou use outro nome.`,
      }
    }
    if (notFound.length > 0) {
      return {
        recipients: [],
        error: `Não localizei «${notFound.join(', ')}» na agenda de contatos.`,
      }
    }
    return { recipients }
  }

  const categoriaArg = (args.grupo_categoria || '').toLowerCase()
  if (
    categoriaArg &&
    WHATSAPP_CONTACT_CATEGORIES.includes(categoriaArg as WhatsAppContactCategory)
  ) {
    const grupo = resolveByCategoria(active, categoriaArg as WhatsAppContactCategory)
    if (grupo.length === 0) {
      return {
        recipients: [],
        error: `Nenhum contato na categoria «${categoriaArg}».`,
      }
    }
    return { recipients: grupo }
  }

  return {
    recipients: [],
    error:
      'Para quem devo enviar? Diga o nome (ex.: «para o João»), dois nomes («para Maria e Pedro») ou «para o CEO».',
  }
}

export function formatRecipientsList(recipients: ResolvedWhatsAppRecipient[]): string {
  return recipients.map((r) => r.nome).join(', ')
}
