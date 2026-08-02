import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import {
  removerPlanoDriveObra,
  salvarPlanoDriveObra,
} from '@/lib/obras-mapa-plano-drive'

export const dynamic = 'force-dynamic'

const putSchema = z
  .object({
    driveFileId: z.string().trim().min(10).max(128).nullable().optional(),
    driveFileName: z.string().trim().max(500).nullable().optional(),
    driveWebViewLink: z
      .union([z.string().trim().url(), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v === '' || v == null ? null : v)),
    notaTexto: z.string().trim().max(2000).nullable().optional(),
  })
  .refine(
    (v) => Boolean(v.driveFileId?.trim()) || Boolean(v.notaTexto?.trim()),
    { message: 'Informe um arquivo do Drive ou um texto sobre o plano.' },
  )

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ obraId: string }> },
) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const { obraId: rawId } = await params
    const obraId = decodeURIComponent(rawId || '').trim()
    if (!obraId) {
      return NextResponse.json({ error: 'ID da obra é obrigatório' }, { status: 400 })
    }

    const body = putSchema.parse(await request.json())
    const supabase = createClient()
    const link = await salvarPlanoDriveObra(supabase, {
      obraId,
      driveFileId: body.driveFileId ?? null,
      driveFileName: body.driveFileName ?? null,
      driveWebViewLink: body.driveWebViewLink ?? null,
      notaTexto: body.notaTexto ?? null,
      userId: auth.user.id,
    })

    return NextResponse.json({ ok: true, link })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.errors[0]?.message ?? 'Dados inválidos' },
        { status: 400 },
      )
    }
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        {
          error: 'Conexão com o Supabase temporariamente indisponível.',
          retryable: true,
        },
        { status: 503 },
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao salvar vínculo'
    if (msg.includes('does not exist') || msg.includes('42P01')) {
      return NextResponse.json(
        {
          error:
            'Tabela obras_mapa_plano_drive ausente. Execute database/create-obras-mapa-plano-drive.sql no Supabase.',
          setupRequired: true,
        },
        { status: 503 },
      )
    }
    if (msg.includes('nota_texto') || msg.includes('42703')) {
      return NextResponse.json(
        {
          error:
            'Coluna nota_texto ausente. Execute database/alter-obras-mapa-plano-drive-nota.sql no Supabase.',
          setupRequired: true,
        },
        { status: 503 },
      )
    }
    console.error('[campo/obras-mapa/plano-drive PUT]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ obraId: string }> },
) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const { obraId: rawId } = await params
    const obraId = decodeURIComponent(rawId || '').trim()
    if (!obraId) {
      return NextResponse.json({ error: 'ID da obra é obrigatório' }, { status: 400 })
    }

    const supabase = createClient()
    await removerPlanoDriveObra(supabase, obraId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        {
          error: 'Conexão com o Supabase temporariamente indisponível.',
          retryable: true,
        },
        { status: 503 },
      )
    }
    const msg = e instanceof Error ? e.message : 'Erro ao remover vínculo'
    console.error('[campo/obras-mapa/plano-drive DELETE]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
