import { NextRequest, NextResponse } from 'next/server'

const CAMARA_API_BASE = 'https://dadosabertos.camara.leg.br/api/v2'
const DEPUTADO_ID = 220697

interface CamaraLink {
  rel: string
  href: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fetchAll = searchParams.get('fetchAll') === 'true'

    if (fetchAll) {
      const allDados: unknown[] = []
      let page = 1
      let hasMore = true

      while (hasMore) {
        const params = new URLSearchParams({
          idDeputadoAutor: String(DEPUTADO_ID),
          ordem: 'DESC',
          ordenarPor: 'ano',
          pagina: String(page),
          itens: '200',
        })

        const res = await fetch(
          `${CAMARA_API_BASE}/proposicoes?${params.toString()}`,
          { headers: { Accept: 'application/json' } }
        )

        if (!res.ok) break

        const data = await res.json()
        allDados.push(...(data.dados || []))
        hasMore = (data.links || []).some((l: CamaraLink) => l.rel === 'next')
        page++
      }

      return NextResponse.json({ dados: allDados, total: allDados.length })
    }

    const pagina = searchParams.get('pagina') || '1'
    const itens = searchParams.get('itens') || '15'
    const ano = searchParams.get('ano') || ''
    const siglaTipo = searchParams.get('siglaTipo') || ''
    const keyword = searchParams.get('keyword') || ''

    const params = new URLSearchParams({
      idDeputadoAutor: String(DEPUTADO_ID),
      ordem: 'DESC',
      ordenarPor: 'ano',
      pagina,
      itens,
    })

    if (ano) params.set('ano', ano)
    if (siglaTipo) params.set('siglaTipo', siglaTipo)
    if (keyword) params.set('keywords', keyword)

    const response = await fetch(
      `${CAMARA_API_BASE}/proposicoes?${params.toString()}`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 300 },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Erro ao buscar proposições da Câmara' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro na API de proposições:', error)
    return NextResponse.json(
      { error: 'Erro interno ao buscar proposições' },
      { status: 500 }
    )
  }
}
