import type { SupabaseClient } from '@supabase/supabase-js'
import { buildBriefingTerritorioWhatsAppText } from '@/lib/territorio/briefing-whatsapp-text'
import { buildResumoOperacionalWhatsAppText } from '@/lib/resumo-operacional-whatsapp'
import type { ResumoOperacionalResponse } from '@/lib/resumo-operacional'
import {
  pickJarvisWhatsAppEnviado,
  pickJarvisWhatsAppFalha,
  pickJarvisWhatsAppParcial,
} from '@/lib/agent/jarvis-phrases'
import { resolveWhatsAppRecipients } from '@/lib/whatsapp/resolve-recipients'
import { sendWhatsAppQueueServer } from '@/lib/whatsapp/send-server'
import type { WhatsAppContact } from '@/lib/whatsapp/contact-types'
import { isWhatsAppContactsTableMissing } from '@/lib/whatsapp/contacts-db-error'

async function fetchWithCookies(origin: string, path: string, cookie: string): Promise<Response> {
  return fetch(`${origin}${path}`, { headers: { cookie }, cache: 'no-store' })
}

async function loadContacts(
  supabase: SupabaseClient,
  origin: string,
  cookie: string,
): Promise<WhatsAppContact[]> {
  const { data, error } = await supabase
    .from('whatsapp_contacts')
    .select('*')
    .eq('ativo', true)
    .order('is_default', { ascending: false })
    .order('nome', { ascending: true })

  if (!error && data) return data as WhatsAppContact[]

  if (isWhatsAppContactsTableMissing(error)) {
    const res = await fetchWithCookies(origin, '/api/whatsapp/contacts', cookie)
    if (res.ok) return (await res.json()) as WhatsAppContact[]
  }

  return []
}

async function buildResumoText(origin: string, cookie: string, days: number): Promise<string> {
  const res = await fetchWithCookies(origin, `/api/resumo-operacional?days=${days}`, cookie)
  if (!res.ok) {
    throw new Error('Não consegui gerar o resumo operacional.')
  }
  const data = (await res.json()) as ResumoOperacionalResponse
  return data.textoWhatsApp || buildResumoOperacionalWhatsAppText(data)
}

async function buildBriefingText(
  origin: string,
  cookie: string,
  cidade: string,
): Promise<string> {
  const [demandsRes, pollsRes] = await Promise.all([
    fetchWithCookies(origin, `/api/campo/demands?cidade=${encodeURIComponent(cidade)}`, cookie),
    fetchWithCookies(origin, '/api/pesquisa?limit=80', cookie),
  ])

  if (!demandsRes.ok) {
    throw new Error(`Não consegui buscar demandas de ${cidade}.`)
  }

  const demands = (await demandsRes.json()) as Array<{
    title?: string
    status?: string
    lideranca?: string
    description?: string
  }>
  const polls = pollsRes.ok ? ((await pollsRes.json()) as unknown[]) : []

  return buildBriefingTerritorioWhatsAppText(
    cidade,
    Array.isArray(demands) ? demands : [],
    Array.isArray(polls) ? (polls as Parameters<typeof buildBriefingTerritorioWhatsAppText>[2]) : [],
  )
}

export async function toolEnviarWhatsApp(
  args: Record<string, string>,
  origin: string,
  cookie: string,
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
): Promise<string> {
  const conteudo = (args.conteudo || 'resumo_operacional').toLowerCase()
  const days = Math.min(30, Math.max(1, parseInt(args.dias || '7', 10) || 7))

  if (conteudo === 'briefing_territorio' && !args.cidade?.trim()) {
    return 'Para enviar o briefing, informe o município. Ex.: «envia o briefing de Teresina para o CEO».'
  }

  const contacts = await loadContacts(supabase, origin, cookie)
  const { recipients, error: recipientError } = resolveWhatsAppRecipients(contacts, args)

  if (recipientError || recipients.length === 0) {
    return recipientError ?? 'Diga para quem enviar — ex.: «para o João», «para Maria e Pedro» ou «para o CEO».'
  }

  let text = ''
  let source = 'jarvis-whatsapp'
  let cidade: string | undefined

  try {
    if (conteudo === 'briefing_territorio') {
      cidade = args.cidade!.trim()
      text = await buildBriefingText(origin, cookie, cidade)
      source = 'jarvis-briefing-executivo'
    } else {
      text = await buildResumoText(origin, cookie, days)
      source = 'jarvis-resumo-operacional'
    }
  } catch (e) {
    return e instanceof Error ? e.message : 'Erro ao montar a mensagem.'
  }

  if (!text.trim()) {
    return 'A mensagem ficou vazia — não foi possível enviar.'
  }

  const queue = recipients.map((r) => ({ jid: r.jid, phone: r.phone, nome: r.nome }))
  const result = await sendWhatsAppQueueServer(queue, {
    text,
    source,
    cidade,
    userId: user.id,
    userEmail: user.email,
    supabase,
  })

  const tipoConteudo =
    conteudo === 'briefing_territorio' ? 'briefing_territorio' : 'resumo_operacional'

  if (result.failed === 0 && result.sent > 0) {
    return pickJarvisWhatsAppEnviado({ conteudo: tipoConteudo, cidade })
  }

  if (result.sent === 0) {
    return pickJarvisWhatsAppFalha()
  }

  return pickJarvisWhatsAppParcial()
}
