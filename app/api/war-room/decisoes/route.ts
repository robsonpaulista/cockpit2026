import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseMissingTableError } from '@/lib/supabase/table-error'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import {
  mapDecisaoRow,
  sortDecisoesByPrioridade,
  type WarRoomDecisaoPrioridade,
  type WarRoomDecisaoRow,
  type WarRoomDecisaoStatus,
} from '@/lib/war-room/decisoes'

export const dynamic = 'force-dynamic'

const STATUS_OK = new Set<WarRoomDecisaoStatus>([
  'pendente',
  'em_andamento',
  'resolvida',
  'arquivada',
])

const PRIORIDADE_OK = new Set<WarRoomDecisaoPrioridade>([
  'critica',
  'alta',
  'media',
  'baixa',
  'info',
])

const SELECT_COLS =
  'id, titulo, prioridade, categoria, icone, destaque, status, href, contexto, responsavel, prazo, acao, created_at, updated_at, resolved_at'

/**
 * Lista decisões/alertas da War Room.
 * Query: status (default pendente,em_andamento), limit (default 5), prioridade?
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const sp = request.nextUrl.searchParams
    const limitRaw = Number(sp.get('limit') ?? '5')
    const limit = Number.isFinite(limitRaw)
      ? Math.min(50, Math.max(1, limitRaw))
      : 5

    const statusParam = (sp.get('status') ?? 'pendente,em_andamento')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is WarRoomDecisaoStatus => STATUS_OK.has(s as WarRoomDecisaoStatus))

    const statuses =
      statusParam.length > 0
        ? statusParam
        : (['pendente', 'em_andamento'] as WarRoomDecisaoStatus[])

    const prioridade = sp.get('prioridade')?.trim()
    const prioridadeFiltro =
      prioridade && PRIORIDADE_OK.has(prioridade as WarRoomDecisaoPrioridade)
        ? (prioridade as WarRoomDecisaoPrioridade)
        : null

    const supabase = createClient()

    let countQuery = supabase
      .from('war_room_decisoes')
      .select('id', { count: 'exact', head: true })
      .in('status', statuses)

    let listQuery = supabase
      .from('war_room_decisoes')
      .select(SELECT_COLS)
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(Math.min(100, limit * 4))

    if (prioridadeFiltro) {
      countQuery = countQuery.eq('prioridade', prioridadeFiltro)
      listQuery = listQuery.eq('prioridade', prioridadeFiltro)
    }

    const [countRes, listRes] = await Promise.all([countQuery, listQuery])

    if (countRes.error || listRes.error) {
      const err = countRes.error ?? listRes.error
      if (err && isSupabaseMissingTableError(err)) {
        return NextResponse.json({
          decisoes: [],
          total: 0,
          pendingMigration: true,
          message:
            'Execute database/create-war-room-decisoes.sql no Supabase.',
        })
      }
      console.error('[war-room/decisoes GET]', err)
      return NextResponse.json(
        { error: 'Erro ao listar decisões da War Room' },
        { status: 500 },
      )
    }

    const rows = ((listRes.data ?? []) as WarRoomDecisaoRow[])
      .slice()
      .sort(sortDecisoesByPrioridade)
      .slice(0, limit)

    return NextResponse.json({
      decisoes: rows.map(mapDecisaoRow),
      total: countRes.count ?? rows.length,
    })
  } catch (e: unknown) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json({ decisoes: [], total: 0, offline: true })
    }
    console.error('[war-room/decisoes GET]', e)
    return NextResponse.json(
      { error: 'Erro ao listar decisões da War Room' },
      { status: 500 },
    )
  }
}
