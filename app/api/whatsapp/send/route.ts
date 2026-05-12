import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * Schema do corpo aceito pelo endpoint local.
 *
 * - `jid`: identificador final no padrão WhatsApp (`5586998107492@s.whatsapp.net`).
 *   Aceita também grupos (`...@g.us`) caso o provedor suporte.
 * - `text`: corpo da mensagem (limitado a 8 KB para evitar abusos).
 */
const sendSchema = z.object({
  jid: z
    .string()
    .min(8, 'jid inválido')
    .regex(/^\d{8,15}@(s\.whatsapp\.net|g\.us)$/, 'jid deve seguir 5586...@s.whatsapp.net'),
  text: z.string().min(1, 'texto vazio').max(8000, 'texto muito longo'),
  recipientPhone: z.string().max(40).optional(),
  source: z.string().min(1).max(80).optional(),
  cidade: z.string().min(1).max(120).optional(),
})

/**
 * POST /api/whatsapp/send
 *
 * Proxy seguro para a API do provedor de WhatsApp (papi.55dynamics.com.br).
 *
 * Mantém a `x-api-key` no servidor (lida da env `WHATSAPP_API_KEY`), exige
 * sessão Supabase válida no chamador e devolve a resposta do provedor de
 * forma transparente para depuração no client.
 *
 * Variáveis de ambiente:
 *  - `WHATSAPP_API_URL`      (default `https://papi.55dynamics.com.br/api/instances/dynamics/send-text`)
 *  - `WHATSAPP_API_KEY`      (obrigatória, secreta)
 *  - `WHATSAPP_INSTANCE_ID`  (default `dynamics` — usado quando a URL não trouxer `instanceId`)
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const apiKey = process.env.WHATSAPP_API_KEY
    const apiUrl =
      process.env.WHATSAPP_API_URL ||
      'https://papi.55dynamics.com.br/api/instances/dynamics/send-text'
    const instanceId = process.env.WHATSAPP_INSTANCE_ID || 'dynamics'

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Integração WhatsApp não configurada no servidor (WHATSAPP_API_KEY ausente).',
        },
        { status: 503 },
      )
    }

    const rawBody = await request.json().catch(() => null)
    const parsed = sendSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Corpo inválido. Esperado { jid, text }.',
          details: parsed.error.issues.map((i) => i.message),
        },
        { status: 400 },
      )
    }

    // Garante o instanceId na URL caso não venha no env.
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
      const { error: logError } = await supabase.from('whatsapp_send_logs').insert({
        sender_user_id: user.id,
        sender_email: user.email ?? null,
        recipient_jid: parsed.data.jid,
        recipient_phone: parsed.data.recipientPhone ?? null,
        source: parsed.data.source ?? 'unknown',
        cidade: parsed.data.cidade ?? null,
        message_length: parsed.data.text.length,
        message_preview: parsed.data.text.slice(0, 240),
        status,
        provider_status: providerStatus,
        provider_response: providerResponse,
        error_message: errorMessage ?? null,
      })

      if (logError) {
        logger.warn('Falha ao registrar log de envio WhatsApp', {
          message: logError.message,
          status,
          jid: parsed.data.jid,
          userId: user.id,
        })
      }
    }

    const upstreamResponse = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ jid: parsed.data.jid, text: parsed.data.text }),
    })

    const upstreamData: unknown = await upstreamResponse.json().catch(() => null)

    if (!upstreamResponse.ok) {
      await insertSendLog(
        'failed',
        upstreamResponse.status,
        upstreamData,
        'Provedor recusou o envio.',
      )
      logger.warn('Provedor WhatsApp recusou envio', {
        status: upstreamResponse.status,
        jid: parsed.data.jid,
        userId: user.id,
      })
      return NextResponse.json(
        {
          error: 'Provedor recusou o envio.',
          status: upstreamResponse.status,
          providerResponse: upstreamData,
        },
        { status: 502 },
      )
    }

    await insertSendLog('sent', upstreamResponse.status, upstreamData)

    logger.info('WhatsApp enviado', {
      jid: parsed.data.jid,
      userId: user.id,
    })

    return NextResponse.json(
      { ok: true, providerResponse: upstreamData },
      { status: 200 },
    )
  } catch (error) {
    logger.error('Erro inesperado em /api/whatsapp/send', {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
