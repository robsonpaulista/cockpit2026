import { NextResponse } from 'next/server'
import {
  getRecapTabItems,
  listRecapTabNames,
  readObrasRecapStore,
} from '@/lib/obras-recap-store'

export const dynamic = 'force-dynamic'

/** Lista abas e itens do storage local (sem Supabase). */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const tab = (searchParams.get('tab') ?? '').trim()
    const store = await readObrasRecapStore()
    const tabs = listRecapTabNames(store)

    if (tab) {
      return NextResponse.json({
        tabs,
        tab,
        obras: getRecapTabItems(store, tab),
      })
    }

    const obras = tabs.flatMap((name) =>
      getRecapTabItems(store, name).map((item) => ({ ...item, tipo: name })),
    )

    return NextResponse.json({ tabs, obras })
  } catch (error: unknown) {
    console.error('[obras/recap GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao ler storage' },
      { status: 500 },
    )
  }
}
