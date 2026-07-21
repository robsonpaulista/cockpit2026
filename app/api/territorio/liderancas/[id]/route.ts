import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isLiderancaAtualEmDialogo } from '@/lib/territorio-lideranca-atual'
import {
  invalidateTerritorioLiderancasDbCache,
  normalizeTerritorioExpectativaCityKey,
} from '@/lib/territorio-liderancas-db'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  municipio: z.string().min(1).optional(),
  lideranca: z.string().min(1).optional(),
  cargo_2024: z.string().optional().nullable(),
  dep_estadual: z.string().optional().nullable(),
  lideranca_atual: z.string().optional().nullable(),
  votos_2024: z.coerce.number().optional().nullable(),
  expectativa_votos_2026: z.coerce.number().optional().nullable(),
  expectativa_jadyel_2026: z.coerce.number().optional().nullable(),
  promessa_lideranca_2026: z.coerce.number().optional().nullable(),
  votacao_final_2022: z.coerce.number().optional().nullable(),
  ativo: z.boolean().optional(),
})

function mapRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    municipio: String(row.municipio || ''),
    municipioNormalizado: String(row.municipio_normalizado || ''),
    nome: String(row.lideranca || ''),
    cargo: String(row.cargo_2024 || row.cargo_2020 || '-'),
    depEstadual: String(row.dep_estadual || ''),
    liderancaAtual: String(row.lideranca_atual || ''),
    emDialogo: Boolean(row.em_dialogo) || isLiderancaAtualEmDialogo(row.lideranca_atual),
    expectativaLegado: Number(row.expectativa_votos_2026 || 0),
    expectativaAferida: Number(row.expectativa_jadyel_2026 || 0),
    promessa: Number(row.promessa_lideranca_2026 || 0),
    votos2024: Number(row.votos_2024 || 0),
    votacaoFinal2022: Number(row.votacao_final_2022 || 0),
  }
}

type RouteContext = { params: { id: string } }

function resolveId(context: RouteContext): number | null {
  const id = Number(context.params.id)
  return Number.isFinite(id) && id > 0 ? id : null
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireRouteUser()
  if (!auth.ok) return auth.response

  try {
    const id = resolveId(context)
    if (!id) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 })
    }

    const body = patchSchema.parse(await request.json())
    const admin = createAdminClient()
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.municipio !== undefined) {
      const municipio = body.municipio.trim()
      patch.municipio = municipio
      patch.municipio_normalizado = normalizeTerritorioExpectativaCityKey(municipio)
    }
    if (body.lideranca !== undefined) patch.lideranca = body.lideranca.trim()
    if (body.cargo_2024 !== undefined) patch.cargo_2024 = body.cargo_2024?.trim() || null
    if (body.dep_estadual !== undefined) patch.dep_estadual = body.dep_estadual?.trim() || null
    if (body.lideranca_atual !== undefined) {
      const liderancaAtual = body.lideranca_atual?.trim() || null
      patch.lideranca_atual = liderancaAtual
      patch.em_dialogo = isLiderancaAtualEmDialogo(liderancaAtual)
    }
    if (body.votos_2024 !== undefined) {
      patch.votos_2024 = body.votos_2024 ?? 0
    }
    if (body.expectativa_votos_2026 !== undefined) {
      patch.expectativa_votos_2026 = body.expectativa_votos_2026 ?? 0
    }
    if (body.expectativa_jadyel_2026 !== undefined) {
      patch.expectativa_jadyel_2026 = body.expectativa_jadyel_2026 ?? 0
    }
    if (body.promessa_lideranca_2026 !== undefined) {
      patch.promessa_lideranca_2026 = body.promessa_lideranca_2026 ?? 0
    }
    if (body.votacao_final_2022 !== undefined) {
      patch.votacao_final_2022 = body.votacao_final_2022 ?? 0
    }
    if (body.ativo !== undefined) patch.ativo = body.ativo

    const { data, error } = await admin
      .from('territorio_liderancas')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateTerritorioLiderancasDbCache()
    return NextResponse.json({ ok: true, row: mapRow(data as Record<string, unknown>) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: error.flatten() }, { status: 400 })
    }
    console.error('[territorio/liderancas PATCH]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar liderança' },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireRouteUser()
  if (!auth.ok) return auth.response

  try {
    const id = resolveId(context)
    if (!id) {
      return NextResponse.json({ error: 'id inválido' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('territorio_liderancas')
      .update({
        ativo: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateTerritorioLiderancasDbCache()
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[territorio/liderancas DELETE]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao excluir liderança' },
      { status: 500 },
    )
  }
}
