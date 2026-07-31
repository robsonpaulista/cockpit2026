import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getRecapTabItems,
  listRecapTabNames,
  readObrasRecapStore,
  type ObrasRecapItem,
} from '@/lib/obras-recap-store'
import {
  loadSeiFieldsBySeiKeys,
  pickSeiFieldsFromDbRow,
  seiLookupKey,
  type ObraSeiRow,
} from '@/lib/obras-sei-db'

export const dynamic = 'force-dynamic'

/** Remove campos SEI residuais do JSON antigo — andamento vem do banco. */
function stripLocalSeiFields(
  item: ObrasRecapItem & Record<string, unknown>,
): ObrasRecapItem & { tipo?: string } {
  const cleaned = { ...item }
  delete cleaned.sei_url
  delete cleaned.sei_ultimo_andamento
  delete cleaned.sei_ultimo_andamento_data
  delete cleaned.sei_ultimo_status
  delete cleaned.sei_ultimo_status_data
  delete cleaned.sei_alerta_andamento_desatualizado
  delete cleaned.sei_data_mais_recente_concluido
  delete cleaned.sei_descricao_mais_recente_concluido
  delete cleaned.sei_todos_andamentos_concluidos
  delete cleaned.sei_andamento_consultado_em
  return cleaned
}

/** Lista abas Recap (JSON local) mesclando andamentos SEI do banco. DOE vem do local. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tab = (searchParams.get('tab') ?? '').trim()
    const store = await readObrasRecapStore()
    const tabs = listRecapTabNames(store)

    const baseItems = tab
      ? getRecapTabItems(store, tab).map((item) => ({ ...item, tipo: tab }))
      : tabs.flatMap((name) =>
          getRecapTabItems(store, name).map((item) => ({ ...item, tipo: name })),
        )

    const seiList = baseItems
      .map((item) => (item.sei ?? '').trim())
      .filter(Boolean)

    let seiMap = new Map<string, ObraSeiRow>()
    try {
      const supabase = createClient()
      seiMap = await loadSeiFieldsBySeiKeys(supabase, seiList)
    } catch (err) {
      console.warn(
        '[obras/recap GET] merge SEI do banco falhou, retornando só local:',
        err,
      )
    }

    const obras = baseItems.map((item) => {
      const local = stripLocalSeiFields(item)
      const db = seiMap.get(seiLookupKey(item.sei))
      if (!db) return local
      return {
        ...local,
        ...pickSeiFieldsFromDbRow(db),
      }
    })

    if (tab) {
      return NextResponse.json({ tabs, tab, obras })
    }
    return NextResponse.json({ tabs, obras })
  } catch (error: unknown) {
    console.error('[obras/recap GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao ler storage' },
      { status: 500 },
    )
  }
}
