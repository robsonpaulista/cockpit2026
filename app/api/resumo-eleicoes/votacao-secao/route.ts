import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseVotacaoSecaoAno } from '@/lib/votacao-secao'
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
    const ano = parseVotacaoSecaoAno(sp.get('ano'))
    const onlyMunicipios = sp.get('only_municipios') === 'true'

    if (onlyMunicipios) {
      const municipios = await listMunicipiosVotacaoSecao(supabase, ano)
      return NextResponse.json({ municipios, ano })
    }

    const cidade = sp.get('cidade')?.trim()
    if (!cidade) {
      return NextResponse.json({ error: 'Informe o parâmetro cidade' }, { status: 400 })
    }

    const cargo = sp.get('cargo')
    const resultado = await getVotacaoSecaoPorMunicipio(supabase, cidade, {
      cargo: cargo === 'todos' ? null : cargo,
      ano,
    })

    if (!resultado) {
      return NextResponse.json(
        {
          error:
            `Nenhum dado de votação por seção para este município (${ano}). Verifique o nome ou importe o CSV.`,
          municipio: cidade,
          ano,
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
