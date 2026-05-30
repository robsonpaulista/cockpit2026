import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getVotacaoSecaoPorMunicipio,
  listMunicipiosVotacaoSecao,
} from '@/lib/votacao-secao-db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const sp = request.nextUrl.searchParams
    const onlyMunicipios = sp.get('only_municipios') === 'true'

    if (onlyMunicipios) {
      const municipios = await listMunicipiosVotacaoSecao(supabase)
      return NextResponse.json({ municipios })
    }

    const cidade = sp.get('cidade')?.trim()
    if (!cidade) {
      return NextResponse.json({ error: 'Informe o parâmetro cidade' }, { status: 400 })
    }

    const cargo = sp.get('cargo')
    const resultado = await getVotacaoSecaoPorMunicipio(supabase, cidade, {
      cargo: cargo === 'todos' ? null : cargo,
    })

    if (!resultado) {
      return NextResponse.json(
        {
          error:
            'Nenhum dado de votação por seção para este município. Verifique o nome ou importe o CSV 2024.',
          municipio: cidade,
        },
        { status: 404 },
      )
    }

    return NextResponse.json(resultado)
  } catch (error: unknown) {
    console.error('votacao-secao GET:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
