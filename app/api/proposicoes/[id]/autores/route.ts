import { NextRequest, NextResponse } from 'next/server'

const CAMARA_API_BASE = 'https://dadosabertos.camara.leg.br/api/v2'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const response = await fetch(
      `${CAMARA_API_BASE}/proposicoes/${id}/autores`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 600 },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Erro ao buscar autores da proposição' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro na API de autores:', error)
    return NextResponse.json(
      { error: 'Erro interno ao buscar autores' },
      { status: 500 }
    )
  }
}
