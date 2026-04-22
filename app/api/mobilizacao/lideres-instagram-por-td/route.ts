import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import { normalizeInstagramHandle } from '@/lib/mobilizacao-lead-capture'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'

export const dynamic = 'force-dynamic'

const TD_SET = new Set<string>(TERRITORIOS_DESENVOLVIMENTO_PI)

type CoordRow = { regiao: string | null }
type LeaderJoin = {
  id: string
  nome: string
  coordinators: CoordRow | CoordRow[] | null
}
type LeadRow = {
  instagram: string | null
  leaders: LeaderJoin | LeaderJoin[] | null
}

function regiaoTdDeCoord(C: CoordRow | CoordRow[] | null | undefined): TerritorioDesenvolvimentoPI | null {
  const coord = Array.isArray(C) ? C[0] : C
  const regiao = coord?.regiao?.trim() ?? ''
  if (!regiao || !TD_SET.has(regiao)) return null
  return regiao as TerritorioDesenvolvimentoPI
}

export type LiderInstagramCoberturaDto = {
  id: string
  nome: string
  territorio: TerritorioDesenvolvimentoPI | null
  /** Handles normalizados (liderados ativos com @) usados para cruzar com comentários. */
  handles: string[]
}

export type MobilizacaoLideresInstagramPorTdResponse = {
  lideres: LiderInstagramCoberturaDto[]
}

export async function GET(request: Request) {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response

  const { searchParams } = new URL(request.url)
  const tdRaw = (searchParams.get('td') ?? '').trim()
  const filtroTd = tdRaw && TD_SET.has(tdRaw) ? (tdRaw as TerritorioDesenvolvimentoPI) : null

  const admin = createAdminClient()
  const pageSize = 1000

  type Acc = { nome: string; territorio: TerritorioDesenvolvimentoPI | null; handles: Set<string> }
  const porLider = new Map<string, Acc>()

  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leads_militancia')
      .select(
        `
        instagram,
        status,
        leaders!inner (
          id,
          nome,
          coordinators!inner ( regiao )
        )
      `
      )
      .eq('status', 'ativo')
      .not('instagram', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('[mobilizacao/lideres-instagram-por-td]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data ?? []) as LeadRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const L = row.leaders
      const leader = Array.isArray(L) ? L[0] : L
      if (!leader?.id) continue
      const td = regiaoTdDeCoord(leader.coordinators)
      if (filtroTd !== null && td !== filtroTd) continue

      const h = normalizeInstagramHandle(row.instagram)
      if (!h) continue

      let acc = porLider.get(leader.id)
      if (!acc) {
        acc = {
          nome: String(leader.nome ?? '').trim() || '—',
          territorio: td,
          handles: new Set<string>(),
        }
        porLider.set(leader.id, acc)
      }
      acc.handles.add(h)
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  const lideres: LiderInstagramCoberturaDto[] = [...porLider.entries()].map(([id, acc]) => ({
    id,
    nome: acc.nome,
    territorio: acc.territorio,
    handles: [...acc.handles],
  }))

  lideres.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

  const body: MobilizacaoLideresInstagramPorTdResponse = { lideres }
  return NextResponse.json(body)
}
