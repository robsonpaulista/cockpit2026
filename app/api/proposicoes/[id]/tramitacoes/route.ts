import { NextRequest, NextResponse } from 'next/server'

const CAMARA_API_BASE = 'https://dadosabertos.camara.leg.br/api/v2'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const dataInicio = searchParams.get('dataInicio') || ''
    const dataFim = searchParams.get('dataFim') || ''

    const queryParams = new URLSearchParams()
    if (dataInicio) queryParams.set('dataInicio', dataInicio)
    if (dataFim) queryParams.set('dataFim', dataFim)

    const qs = queryParams.toString()
    const url = `${CAMARA_API_BASE}/proposicoes/${id}/tramitacoes${qs ? `?${qs}` : ''}`

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Erro ao buscar tramitações da proposição' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro na API de tramitações:', error)
    return NextResponse.json(
      { error: 'Erro interno ao buscar tramitações' },
      { status: 500 }
    )
  }
}
