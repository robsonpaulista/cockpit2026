import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import {
  buildMobilizacaoEstruturaExportRows,
  mobilizacaoEstruturaRowsToXlsxBuffer,
  type LeaderExportRow,
  type LideradoExportRow,
} from '@/lib/mobilizacao-config-estrutura-export'

export const dynamic = 'force-dynamic'

const PAGE = 1000

async function fetchAllLeaders(admin: ReturnType<typeof createAdminClient>): Promise<LeaderExportRow[]> {
  const all: LeaderExportRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leaders')
      .select('id, nome, telefone, cidade, municipio, coordinator_id, created_at, coordinators(id, nome, regiao)')
      .order('nome', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) {
      console.error('[export-estrutura] leaders', error)
      throw error
    }
    const chunk = (data ?? []) as LeaderExportRow[]
    all.push(...chunk)
    if (chunk.length < PAGE) break
    from += PAGE
  }
  return all
}

async function fetchAllLiderados(admin: ReturnType<typeof createAdminClient>): Promise<LideradoExportRow[]> {
  const all: LideradoExportRow[] = []
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leads_militancia')
      .select('id, nome, whatsapp, instagram, cidade, status, leader_id')
      .order('leader_id', { ascending: true })
      .order('nome', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) {
      console.error('[export-estrutura] liderados', error)
      throw error
    }
    const chunk = (data ?? []) as LideradoExportRow[]
    all.push(...chunk)
    if (chunk.length < PAGE) break
    from += PAGE
  }
  return all
}

export async function GET() {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response

  const admin = createAdminClient()
  try {
    const [leaders, liderados] = await Promise.all([fetchAllLeaders(admin), fetchAllLiderados(admin)])
    const rows = buildMobilizacaoEstruturaExportRows(leaders, liderados)
    const buf = mobilizacaoEstruturaRowsToXlsxBuffer(rows)
    const day = new Date().toISOString().slice(0, 10)
    const filename = `mobilizacao-estrutura-${day}.xlsx`
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erro ao gerar exportação da estrutura.' }, { status: 500 })
  }
}
