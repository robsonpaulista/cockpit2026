import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildComparativoExpectativa2022Lista,
  filterComparativoExpectativa2022Lista,
  CENARIO_EXPECTATIVA_ANTERIOR_2026,
  labelCenarioExpectativaComparativo,
  pickExpectativaComparativo,
  summarizeComparativoExpectativa2022,
  type CenarioExpectativaComparativo,
} from '@/lib/comparativo-expectativa-2022'
import { JADYEL_URNA_DEP_FEDERAL_2022 } from '@/lib/jadyel-federal-2022-pi-votos'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import {
  buildCitySummaries,
  getTerritorioExpectativaSheetConfig,
  getTerritorioExpectativaSheetCredentials,
} from '@/lib/territorio-expectativa-sheet'

export const dynamic = 'force-dynamic'

async function fetchVotos2022Jadyel(origin: string): Promise<Map<string, number>> {
  const url = new URL('/api/resumo-eleicoes', origin)
  url.searchParams.set('totals', 'federal2022PorMunicipio')
  url.searchParams.set('candidato', JADYEL_URNA_DEP_FEDERAL_2022)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return new Map()

  const data = (await res.json()) as { pontos?: Array<{ municipio: string; votos: number }> }
  const mapa = new Map<string, number>()
  for (const p of data.pontos ?? []) {
    const key = normalizeMunicipioNome(String(p.municipio ?? ''))
    if (!key) continue
    mapa.set(key, Number(p.votos) || 0)
  }
  return mapa
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const filtro = (searchParams.get('filtro') || 'caiu') as
      | 'caiu'
      | 'cresceu'
      | 'manteve'
      | 'todos'
    const cenario = (searchParams.get('cenario') ||
      CENARIO_EXPECTATIVA_ANTERIOR_2026) as CenarioExpectativaComparativo
    const modo = searchParams.get('modo') === 'lista' ? 'lista' : 'resumo'
    const limite = Math.min(Math.max(Number.parseInt(searchParams.get('limit') || '30', 10) || 30, 1), 224)

    const { spreadsheetId, sheetName } = getTerritorioExpectativaSheetConfig({})
    const credentials = getTerritorioExpectativaSheetCredentials(undefined, 'territorio')

    if (!spreadsheetId || !sheetName || !credentials) {
      return NextResponse.json(
        {
          error: 'Planilha de Território & Base não configurada no servidor.',
          rows: [],
          totalFiltrado: 0,
        },
        { status: 503 }
      )
    }

    const { summaries } = await buildCitySummaries(spreadsheetId, sheetName, undefined, credentials)
    const expectativaMap = new Map<string, number>()
    summaries.forEach((summary, key) => {
      expectativaMap.set(key, pickExpectativaComparativo(summary, cenario))
    })

    const votos2022 = await fetchVotos2022Jadyel(request.nextUrl.origin)
    const listaCompleta = buildComparativoExpectativa2022Lista(expectativaMap, votos2022)

    if (modo === 'resumo') {
      return NextResponse.json({
        cenario,
        cenarioLabel: labelCenarioExpectativaComparativo(cenario),
        filtro,
        modo: 'resumo',
        totalFiltrado: listaCompleta.length,
        resumo: summarizeComparativoExpectativa2022(listaCompleta),
        rows: [],
      })
    }

    const filtrada = filterComparativoExpectativa2022Lista(listaCompleta, filtro)
    const ordenada =
      filtro === 'caiu'
        ? [...filtrada].sort((a, b) => a.delta - b.delta || Math.abs(b.delta) - Math.abs(a.delta))
        : filtrada

    return NextResponse.json({
      cenario,
      cenarioLabel: labelCenarioExpectativaComparativo(cenario),
      filtro,
      modo: 'lista',
      totalFiltrado: ordenada.length,
      rows: ordenada.slice(0, limite),
    })
  } catch (error: unknown) {
    console.error('[territorio/comparativo-expectativa-2022]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
