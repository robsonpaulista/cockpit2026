import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

export interface SendWhatsAppServerParams {
  jid: string
  text: string
  recipientPhone?: string
  source?: string
  cidade?: string
  userId: string
  userEmail?: string | null
  supabase: SupabaseClient
}

export interface SendWhatsAppServerResult {
  ok: boolean
  status: number
  error?: string
  providerResponse?: unknown
}

const QUEUE_DELAY_MS = 1500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function sendWhatsAppMessageServer(
  params: SendWhatsAppServerParams,
): Promise<SendWhatsAppServerResult> {
  const apiKey = process.env.WHATSAPP_API_KEY
  const apiUrl =
    process.env.WHATSAPP_API_URL ||
    'https://papi.55dynamics.com.br/api/instances/dynamics/send-text'
  const instanceId = process.env.WHATSAPP_INSTANCE_ID || 'dynamics'

  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: 'Integração WhatsApp não configurada no servidor (WHATSAPP_API_KEY ausente).',
    }
  }

  const url = new URL(apiUrl)
  if (!url.searchParams.has('instanceId')) {
    url.searchParams.set('instanceId', instanceId)
  }

  const insertSendLog = async (
    status: 'sent' | 'failed',
    providerStatus: number,
    providerResponse: unknown,
    errorMessage?: string,
  ) => {
    const { error: logError } = await params.supabase.from('whatsapp_send_logs').insert({
      sender_user_id: params.userId,
      sender_email: params.userEmail ?? null,
      recipient_jid: params.jid,
      recipient_phone: params.recipientPhone ?? null,
      source: params.source ?? 'jarvis',
      cidade: params.cidade ?? null,
      message_length: params.text.length,
      message_preview: params.text.slice(0, 240),
      status,
      provider_status: providerStatus,
      provider_response: providerResponse,
      error_message: errorMessage ?? null,
    })

    if (logError) {
      logger.warn('Falha ao registrar log de envio WhatsApp', {
        message: logError.message,
        userId: params.userId,
      })
    }
  }

  try {
    const upstreamResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ jid: params.jid, text: params.text }),
    })

    const upstreamData: unknown = await upstreamResponse.json().catch(() => null)

    if (!upstreamResponse.ok) {
      await insertSendLog('failed', upstreamResponse.status, upstreamData, 'Provedor recusou o envio.')
      return {
        ok: false,
        status: upstreamResponse.status,
        error: 'Provedor recusou o envio.',
        providerResponse: upstreamData,
      }
    }

    await insertSendLog('sent', upstreamResponse.status, upstreamData)
    return { ok: true, status: upstreamResponse.status, providerResponse: upstreamData }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao enviar mensagem.'
    await insertSendLog('failed', 0, null, message)
    return { ok: false, status: 0, error: message }
  }
}

export async function sendWhatsAppQueueServer(
  items: Array<{ jid: string; phone: string; nome: string }>,
  params: Omit<SendWhatsAppServerParams, 'jid' | 'recipientPhone'> & { text: string },
): Promise<{ sent: number; failed: number; lines: string[] }> {
  let sent = 0
  let failed = 0
  const lines: string[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!
    const result = await sendWhatsAppMessageServer({
      ...params,
      jid: item.jid,
      recipientPhone: item.phone,
    })

    if (result.ok) {
      sent++
      lines.push(`✓ ${item.nome}`)
    } else {
      failed++
      lines.push(`✗ ${item.nome}: ${result.error ?? 'falha'}`)
    }

    if (i < items.length - 1) {
      await sleep(QUEUE_DELAY_MS)
    }
  }

  return { sent, failed, lines }
}
