import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sendWhatsAppMessageServer } from '@/lib/whatsapp/send-server'
import { normalizePhoneToJid } from '@/lib/whatsapp/send'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const sendSchema = z.object({
  jid: z
    .string()
    .min(8, 'jid inválido')
    .regex(/^\d{8,15}@(s\.whatsapp\.net|g\.us)$/, 'jid deve seguir 5586...@s.whatsapp.net')
    .optional(),
  phone: z.string().min(8).max(40).optional(),
  text: z.string().min(1, 'texto vazio').max(8000, 'texto muito longo'),
  recipientPhone: z.string().max(40).optional(),
  source: z.string().min(1).max(80).optional(),
  cidade: z.string().min(1).max(120).optional(),
})

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
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

    const jid =
      parsed.data.jid ||
      (parsed.data.phone || parsed.data.recipientPhone
        ? normalizePhoneToJid(parsed.data.phone || parsed.data.recipientPhone || '')
        : null)

    if (!jid) {
      return NextResponse.json({ error: 'Telefone ou jid inválido.' }, { status: 400 })
    }

    const result = await sendWhatsAppMessageServer({
      jid,
      text: parsed.data.text,
      recipientPhone: parsed.data.recipientPhone || parsed.data.phone,
      source: parsed.data.source,
      cidade: parsed.data.cidade,
      userId: user.id,
      userEmail: user.email,
      supabase,
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error || 'Falha ao enviar mensagem.',
          status: result.status,
          providerResponse: result.providerResponse,
        },
        { status: result.status === 503 ? 503 : 502 },
      )
    }

    return NextResponse.json(
      { ok: true, providerResponse: result.providerResponse },
      { status: 200 },
    )
  } catch (error) {
    logger.error('Erro inesperado em /api/whatsapp/send', {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
