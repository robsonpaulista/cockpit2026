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

function baseCaptacaoUrlForExport(): string {
  const origin = process.env.NEXT_PUBLIC_MOBILIZACAO_CAPTACAO_ORIGIN?.trim()
  if (origin) {
    return `${origin.replace(/\/$/, '')}/mobilizacao/detalhe`
  }
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_URL?.trim()
  if (app) {
    const base = app.startsWith('http') ? app : `https://${app}`
    return `${base.replace(/\/$/, '')}/mobilizacao/detalhe`
  }
  return ''
}

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
    const rows = buildMobilizacaoEstruturaExportRows(leaders, liderados, baseCaptacaoUrlForExport())
    const buf = mobilizacaoEstruturaRowsToXlsxBuffer(rows)
    const day = new Date().toISOString().slice(0, 10)
    const filename = `mobilizacao-estrutura-captacao-${day}.xlsx`
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
