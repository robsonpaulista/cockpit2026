import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar candidato padrão do query param
    const { searchParams } = new URL(request.url)
    const candidatoPadrao = searchParams.get('candidato')

    if (!candidatoPadrao) {
      return NextResponse.json({
        media: null,
        totalPesquisas: 0,
        message: 'Candidato padrão não especificado',
      })
    }

    // Buscar todas as pesquisas estimuladas do candidato padrão
    const { data: polls, error } = await supabase
      .from('polls')
      .select('intencao')
      .eq('user_id', user.id)
      .eq('candidato_nome', candidatoPadrao)
      .eq('tipo', 'estimulada')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!polls || polls.length === 0) {
      return NextResponse.json({
        media: null,
        totalPesquisas: 0,
        message: 'Nenhuma pesquisa estimulada encontrada',
      })
    }

    // Calcular média das intenções
    const somaIntencoes = polls.reduce((sum, poll) => sum + (poll.intencao || 0), 0)
    const media = Math.round((somaIntencoes / polls.length) * 10) / 10 // Arredondar para 1 casa decimal

    return NextResponse.json({
      media,
      totalPesquisas: polls.length,
      candidato: candidatoPadrao,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
