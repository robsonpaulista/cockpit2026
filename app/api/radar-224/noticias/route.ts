import { NextRequest, NextResponse } from 'next/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import {
  buscarNoticiasRadarLote,
  buscarNoticiasRadarMunicipio,
} from '@/lib/radar-224/buscar-noticias'
import { buildRadar224TopMunicipios } from '@/lib/radar-224/build-radar-224'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Busca notícias ao vivo (Google News RSS) para o Radar 224.
 *
 * GET  ?municipio=Teresina
 * POST { municipio?: string, top?: number, apenasEstaduais?: boolean }
 *   — se `top` (1–10), busca os N primeiros do ranking Legado (só estaduais por padrão)
 */
export async function GET(request: NextRequest) {
  const auth = await requireRouteUser()
  if (!auth.ok) return auth.response

  const municipio = request.nextUrl.searchParams.get('municipio')?.trim()
  if (!municipio) {
    return NextResponse.json(
      { error: 'Informe municipio (ex.: ?municipio=Teresina)' },
      { status: 400 },
    )
  }

  try {
    const result = await buscarNoticiasRadarMunicipio(municipio)
    return NextResponse.json({
      ok: true,
      modo: 'municipio',
      ...result,
      total: result.itens.length,
      filtro: 'mencao_explicita_municipio',
    })
  } catch (error) {
    console.error('[radar-224/noticias GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro na busca de notícias' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRouteUser()
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      municipio?: string
      top?: number
      apenasEstaduais?: boolean
    }

    const municipio = body.municipio?.trim()
    if (municipio) {
      const result = await buscarNoticiasRadarMunicipio(municipio, {
        apenasEstaduais: body.apenasEstaduais,
      })
      return NextResponse.json({
        ok: true,
        modo: 'municipio',
        ...result,
        total: result.itens.length,
        filtro: 'mencao_explicita_municipio',
      })
    }

    const topRaw = Number(body.top ?? 5)
    const top = Number.isFinite(topRaw) ? Math.min(Math.max(Math.round(topRaw), 1), 10) : 5
    const { municipios } = await buildRadar224TopMunicipios({ topN: top })
    const nomes = municipios.map((m) => m.municipio)
    const result = await buscarNoticiasRadarLote({
      municipios: nomes,
      apenasEstaduais: body.apenasEstaduais !== false,
    })

    return NextResponse.json({
      ok: true,
      modo: 'lote',
      top,
      municipios: nomes,
      ...result,
      total: result.itens.length,
      filtro: 'mencao_explicita_municipio',
    })
  } catch (error) {
    console.error('[radar-224/noticias POST]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro na busca de notícias' },
      { status: 500 },
    )
  }
}
