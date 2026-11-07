import { NextRequest, NextResponse } from 'next/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { buscarNoticiasPortalMunicipio } from '@/lib/radar-224/buscar-noticias-portal'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Notícias regionais da cidade (scrape das listagens do catálogo Radar 224).
 * Ex.: ?municipio=Picos → Portal Grande Picos /politica
 */
export async function GET(request: NextRequest) {
  const auth = await requireRouteUser()
  if (!auth.ok) return auth.response

  const municipio = request.nextUrl.searchParams.get('municipio')?.trim()
  if (!municipio) {
    return NextResponse.json(
      { error: 'Informe municipio (ex.: ?municipio=Picos)' },
      { status: 400 },
    )
  }

  try {
    const result = await buscarNoticiasPortalMunicipio(municipio)
    return NextResponse.json({
      ok: true,
      ...result,
      total: result.itens.length,
      modo: 'portal_listagem',
    })
  } catch (error) {
    console.error('[resumo-eleicoes/noticias GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro na busca de notícias' },
      { status: 500 },
    )
  }
}
