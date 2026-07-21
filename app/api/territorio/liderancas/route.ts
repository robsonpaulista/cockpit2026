import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isLiderancaAtualEmDialogo } from '@/lib/territorio-lideranca-atual'
import {
  invalidateTerritorioLiderancasDbCache,
  listAllTerritorioLiderancas,
  listTerritorioLiderancasByCidade,
  normalizeTerritorioExpectativaCityKey,
} from '@/lib/territorio-liderancas-db'

export const dynamic = 'force-dynamic'

const upsertSchema = z.object({
  municipio: z.string().min(1),
  lideranca: z.string().min(1),
  cargo_2024: z.string().optional().nullable(),
  dep_estadual: z.string().optional().nullable(),
  lideranca_atual: z.string().optional().nullable(),
  expectativa_votos_2026: z.coerce.number().optional().nullable(),
  expectativa_jadyel_2026: z.coerce.number().optional().nullable(),
  promessa_lideranca_2026: z.coerce.number().optional().nullable(),
  votacao_final_2022: z.coerce.number().optional().nullable(),
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

export async function GET(request: NextRequest) {
  const auth = await requireRouteUser()
  if (!auth.ok) return auth.response

  try {
    const cidade = request.nextUrl.searchParams.get('cidade')?.trim()
    const rows = cidade
      ? await listTerritorioLiderancasByCidade(cidade)
      : await listAllTerritorioLiderancas()
    return NextResponse.json({
      cidade: cidade || null,
      total: rows.length,
      rows: rows.map((row) => mapRow(row as unknown as Record<string, unknown>)),
    })
  } catch (error) {
    console.error('[territorio/liderancas GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao listar lideranças' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRouteUser()
  if (!auth.ok) return auth.response

  try {
    const body = upsertSchema.parse(await request.json())
    const municipio = body.municipio.trim()
    const municipioNormalizado = normalizeTerritorioExpectativaCityKey(municipio)
    const liderancaAtual = body.lideranca_atual?.trim() || null
    const admin = createAdminClient()

    const payload = {
      municipio,
      municipio_normalizado: municipioNormalizado,
      lideranca: body.lideranca.trim(),
      cargo_2024: body.cargo_2024?.trim() || null,
      dep_estadual: body.dep_estadual?.trim() || null,
      lideranca_atual: liderancaAtual,
      expectativa_votos_2026: body.expectativa_votos_2026 ?? 0,
      expectativa_jadyel_2026: body.expectativa_jadyel_2026 ?? 0,
      promessa_lideranca_2026: body.promessa_lideranca_2026 ?? 0,
      votacao_final_2022: body.votacao_final_2022 ?? 0,
      em_dialogo: isLiderancaAtualEmDialogo(liderancaAtual),
      ativo: true,
      fonte: 'sistema',
      updated_at: new Date().toISOString(),
      imported_at: new Date().toISOString(),
    }

    const { data, error } = await admin.from('territorio_liderancas').insert(payload).select('*').single()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    invalidateTerritorioLiderancasDbCache()
    return NextResponse.json({ ok: true, row: mapRow(data as Record<string, unknown>) })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: error.flatten() }, { status: 400 })
    }
    console.error('[territorio/liderancas POST]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao criar liderança' },
      { status: 500 },
    )
  }
}
