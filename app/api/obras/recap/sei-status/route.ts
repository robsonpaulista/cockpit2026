import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { findRecapItemById, type ObrasRecapItem } from '@/lib/obras-recap-store'
import {
  isSeiExibirUrl,
  normalizeSeiExibirUrl,
  resolveSeiPublicUrlFromProtocolo,
} from '@/lib/sei-protocolo-url'
import {
  findObraBySei,
  pickSeiFieldsFromDbRow,
  upsertObraSeiAndamento,
} from '@/lib/obras-sei-db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Body = {
  obraId?: string
  sei?: string
  tabName?: string
  /** Link md_pesq_processo_exibir.php?<token> se já conhecido. */
  url?: string
}

type SeiStatusPayload = {
  found?: boolean
  descricao?: string
  data?: string
  dataIso?: string | null
  alerta_andamento_desatualizado?: boolean
  sei_data_mais_recente_concluido?: string | null
  sei_descricao_mais_recente_concluido?: string | null
  todos_andamentos_concluidos?: boolean
  sei_ultimo_status?: string | null
  sei_ultimo_status_data?: string | null
  error?: string
  details?: string
  sei_plano_trabalho_url?: string | null
  sei_plano_trabalho_tipo?: string | null
  sei_plano_trabalho_numero?: string | null
}

/**
 * Andamentos SEI para obras Recap.
 * 1) Usa sei_url se já existir (banco ou body)
 * 2) Senão resolve o link exibir via Pesquisa Pública (q + isPaginacao=true)
 * 3) Lê o histórico e grava na tabela obras
 */
export async function POST(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const supabase = createClient()
    const body = (await request.json().catch(() => ({}))) as Body
    const obraId = typeof body.obraId === 'string' ? body.obraId.trim() : ''
    let tabName = typeof body.tabName === 'string' ? body.tabName.trim() : ''
    let sei = typeof body.sei === 'string' ? body.sei.trim() : ''
    let url = typeof body.url === 'string' ? body.url.trim() : ''
    let recapItem: ObrasRecapItem | null = null

    if (obraId) {
      const found = await findRecapItemById(obraId)
      if (!found) {
        return NextResponse.json(
          { error: 'Obra não encontrada no storage Recap' },
          { status: 404 },
        )
      }
      tabName = found.tabName
      sei = sei || (found.item.sei ?? '').trim()
      recapItem = found.item
    }

    if (!sei) {
      return NextResponse.json(
        { error: 'Informe obraId Recap com número SEI' },
        { status: 400 },
      )
    }

    if (url) {
      url = normalizeSeiExibirUrl(url) || url
    }

    if (!url || !isSeiExibirUrl(url)) {
      const existing = await findObraBySei(supabase, sei, tabName || undefined)
      const fromDb = (existing?.sei_url ?? '').trim()
      if (fromDb) {
        url = normalizeSeiExibirUrl(fromDb) || fromDb
      }
    }

    if (!url || !isSeiExibirUrl(url)) {
      const resolved = await resolveSeiPublicUrlFromProtocolo(sei)
      if (!resolved.url) {
        return NextResponse.json(
          {
            error: resolved.error || 'Não foi possível obter o link do processo SEI',
            sei,
          },
          { status: 404 },
        )
      }
      url = resolved.url
    }

    const cookie = request.headers.get('cookie') ?? ''
    const origin = new URL(request.url).origin
    const statusRes = await fetch(`${origin}/api/obras/sei-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      body: JSON.stringify({ url }),
      cache: 'no-store',
    })
    const data = (await statusRes.json().catch(() => ({}))) as SeiStatusPayload

    if (!statusRes.ok || !data.descricao) {
      return NextResponse.json(
        {
          error: data.error || 'Falha ao ler andamento do SEI',
          details: data.details,
          sei_url: url,
          ...data,
        },
        { status: statusRes.ok ? 422 : statusRes.status },
      )
    }

    if (!recapItem) {
      return NextResponse.json(
        { error: 'obraId Recap é obrigatório para salvar no banco' },
        { status: 400 },
      )
    }

    const dbRow = await upsertObraSeiAndamento(supabase, {
      sei,
      tabName: tabName || 'Recap',
      recapItem,
      patch: {
        sei_url: url,
        sei_ultimo_andamento: data.descricao,
        sei_ultimo_andamento_data: data.dataIso ?? data.data ?? null,
        sei_alerta_andamento_desatualizado: Boolean(
          data.alerta_andamento_desatualizado,
        ),
        sei_data_mais_recente_concluido:
          data.sei_data_mais_recente_concluido ?? null,
        sei_descricao_mais_recente_concluido:
          data.sei_descricao_mais_recente_concluido ?? null,
        sei_todos_andamentos_concluidos: Boolean(data.todos_andamentos_concluidos),
        sei_ultimo_status: data.sei_ultimo_status ?? null,
        sei_ultimo_status_data: data.sei_ultimo_status_data ?? null,
        sei_plano_trabalho_url: data.sei_plano_trabalho_url ?? null,
        sei_plano_trabalho_tipo: data.sei_plano_trabalho_tipo ?? null,
        sei_plano_trabalho_numero: data.sei_plano_trabalho_numero ?? null,
      },
    })

    const seiFields = pickSeiFieldsFromDbRow(dbRow)

    return NextResponse.json({
      success: true,
      storage: 'database',
      ...data,
      sei_url: url,
      obra: {
        ...recapItem,
        tipo: tabName,
        ...seiFields,
      },
    })
  } catch (error: unknown) {
    console.error('[obras/recap/sei-status]', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Erro ao consultar andamento SEI',
      },
      { status: 500 },
    )
  }
}
