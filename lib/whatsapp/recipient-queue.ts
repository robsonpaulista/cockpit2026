import { formatPhoneDisplay, normalizePhoneToJid, sendWhatsAppMessage } from '@/lib/whatsapp/send'

export type QueueItemStatus = 'pending' | 'sending' | 'sent' | 'failed'

export interface WhatsAppQueueRecipient {
  id: string
  nome: string
  phone: string
  jid: string
  contactId?: string
}

export interface QueueSendProgress {
  index: number
  total: number
  recipient: WhatsAppQueueRecipient
  status: QueueItemStatus
  error?: string
}

export interface QueueSendSummary {
  sent: number
  failed: number
  results: QueueSendProgress[]
}

const QUEUE_DELAY_MS = 1500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function createQueueRecipient(input: {
  nome: string
  phone: string
  contactId?: string
  id?: string
}): WhatsAppQueueRecipient | null {
  const jid = normalizePhoneToJid(input.phone)
  if (!jid) return null
  return {
    id: input.id ?? `${jid}-${input.contactId ?? 'manual'}`,
    nome: input.nome.trim() || formatPhoneDisplay(input.phone),
    phone: input.phone,
    jid,
    contactId: input.contactId,
  }
}

export function dedupeQueueRecipients(items: WhatsAppQueueRecipient[]): WhatsAppQueueRecipient[] {
  const seen = new Set<string>()
  const out: WhatsAppQueueRecipient[] = []
  for (const item of items) {
    const key = item.jid
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

export async function sendWhatsAppQueue(
  recipients: WhatsAppQueueRecipient[],
  params: {
    text: string
    source?: string
    cidade?: string
    delayMs?: number
    onProgress?: (progress: QueueSendProgress) => void
  },
): Promise<QueueSendSummary> {
  const delay = params.delayMs ?? QUEUE_DELAY_MS
  const results: QueueSendProgress[] = []
  let sent = 0
  let failed = 0

  for (let index = 0; index < recipients.length; index++) {
    const recipient = recipients[index]!
    const progressBase: QueueSendProgress = {
      index,
      total: recipients.length,
      recipient,
      status: 'sending',
    }
    params.onProgress?.(progressBase)

    const result = await sendWhatsAppMessage({
      jid: recipient.jid,
      phone: recipient.phone,
      text: params.text,
      source: params.source,
      cidade: params.cidade,
    })

    const finalProgress: QueueSendProgress = {
      ...progressBase,
      status: result.ok ? 'sent' : 'failed',
      error: result.ok ? undefined : result.error,
    }
    results.push(finalProgress)
    params.onProgress?.(finalProgress)

    if (result.ok) sent++
    else failed++

    if (index < recipients.length - 1) {
      await sleep(delay)
    }
  }

  return { sent, failed, results }
}
