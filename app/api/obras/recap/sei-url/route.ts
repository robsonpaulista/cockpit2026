import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { findRecapItemById, type ObrasRecapItem } from '@/lib/obras-recap-store'
import {
  isSeiExibirUrl,
  normalizeSeiExibirUrl,
} from '@/lib/sei-protocolo-url'
import { upsertObraSeiAndamento } from '@/lib/obras-sei-db'

export const dynamic = 'force-dynamic'

type Body = {
  obraId?: string
  sei?: string
  tabName?: string
  url?: string
}

/**
 * Salva apenas o link md_pesq_processo_exibir.php?<token> no banco
 * (sem consultar andamento). Mesmo formato do Andamentos SEI clássico.
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
    const urlRaw = typeof body.url === 'string' ? body.url.trim() : ''
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

    if (!recapItem || !sei) {
      return NextResponse.json(
        { error: 'Informe obraId Recap com número SEI' },
        { status: 400 },
      )
    }

    const normalized = normalizeSeiExibirUrl(urlRaw) || urlRaw
    if (
      !normalized ||
      (!isSeiExibirUrl(normalized) && !/sei\.pi\.gov\.br/i.test(normalized))
    ) {
      return NextResponse.json(
        {
          error:
            'URL inválida. Use o formato ' +
            'https://sei.pi.gov.br/sei/modulos/pesquisa/md_pesq_processo_exibir.php?<token>',
        },
        { status: 400 },
      )
    }

    const dbRow = await upsertObraSeiAndamento(supabase, {
      sei,
      tabName: tabName || 'Recap',
      recapItem,
      patch: { sei_url: normalized },
    })

    return NextResponse.json({
      success: true,
      storage: 'database',
      sei_url: dbRow.sei_url ?? normalized,
      obra: {
        ...recapItem,
        tipo: tabName,
        sei_url: dbRow.sei_url ?? normalized,
        db_obra_id: dbRow.id,
      },
    })
  } catch (error: unknown) {
    console.error('[obras/recap/sei-url]', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Erro ao salvar link SEI',
      },
      { status: 500 },
    )
  }
}
