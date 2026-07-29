import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  aggregateFluxoCampanhasToDisparos,
  buildCampanhaDetalheTree,
  fetchFluxoCampanhasRows,
  getFluxoCampanhasConfig,
} from '@/lib/fluxo-campanhas'

export const dynamic = 'force-dynamic'

/**
 * Proxy autenticado → Fluxo 55Dynamics campanhas.
 *
 * - Sem filtro: lista agregada para o card Disparos.
 * - Com `campanha` ou `titulo`: detalhe cidade → liderança.
 */
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    if (!getFluxoCampanhasConfig()) {
      return NextResponse.json(
        {
          error:
            'API de campanhas não configurada (FLUXO_CAMPANHAS_API_URL / FLUXO_CAMPANHAS_API_KEY)',
          disparos: [],
          configured: false,
        },
        { status: 503 },
      )
    }

    const { searchParams } = new URL(request.url)
    const campanha = searchParams.get('campanha')?.trim() || ''
    const titulo = searchParams.get('titulo')?.trim() || ''
    const detalhe = searchParams.get('detalhe') === '1' || Boolean(campanha || titulo)

    if (detalhe && (campanha || titulo)) {
      const { rows, total } = await fetchFluxoCampanhasRows({
        limitPerPage: 100,
        maxPages: 20,
        campanha: campanha || undefined,
        titulo: campanha ? undefined : titulo || undefined,
      })

      const tree = buildCampanhaDetalheTree(rows, {
        campanhaId: campanha || null,
        titulo: campanha ? null : titulo || null,
      })

      return NextResponse.json({
        configured: true,
        detalhe: tree,
        meta: {
          enviosAmostrados: rows.length,
          enviosTotalApi: total,
          cidades: tree.cidades.length,
        },
      })
    }

    const limitRaw = Number.parseInt(searchParams.get('limit') || '8', 10)
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 30)
      : 8

    const { rows, total } = await fetchFluxoCampanhasRows({
      limitPerPage: 100,
      maxPages: 20,
    })

    const disparos = aggregateFluxoCampanhasToDisparos(rows).slice(0, limit)

    let periodoDe: string | null = null
    let periodoAte: string | null = null
    for (const row of rows) {
      const at = row.enviadoEm || row.createdAt || null
      if (!at) continue
      if (!periodoDe || at < periodoDe) periodoDe = at
      if (!periodoAte || at > periodoAte) periodoAte = at
    }

    return NextResponse.json({
      configured: true,
      disparos,
      meta: {
        enviosAmostrados: rows.length,
        enviosTotalApi: total,
        campanhas: disparos.length,
        periodoDe,
        periodoAte,
      },
    })
  } catch (error) {
    console.error('fluxo/campanhas', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Erro ao buscar campanhas',
        disparos: [],
        configured: true,
      },
      { status: 502 },
    )
  }
}
