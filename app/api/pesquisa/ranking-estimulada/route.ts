import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEleitoradoByCity } from '@/lib/eleitores'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const candidato = searchParams.get('candidato')

    if (!candidato) {
      return NextResponse.json({
        posicao: 0,
        totalCandidatos: 0,
        mediaCandidato: null,
        projecaoVotos: null,
        message: 'Candidato não especificado',
      })
    }

    // Buscar TODAS as pesquisas estimuladas para dep_federal de TODOS os candidatos
    // Incluir cidade para cálculo de projeção de votos
    const { data: polls, error } = await supabase
      .from('polls')
      .select(`
        candidato_nome, intencao, data, cidade_id,
        cities ( name )
      `)
      .eq('user_id', user.id)
      .eq('tipo', 'estimulada')
      .eq('cargo', 'dep_federal')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!polls || polls.length === 0) {
      return NextResponse.json({
        posicao: 0,
        totalCandidatos: 0,
        mediaCandidato: null,
        projecaoVotos: null,
        message: 'Nenhuma pesquisa estimulada para dep. federal encontrada',
      })
    }

    // Agrupar por candidato e calcular média de intenção de cada um
    const mediasPorCandidato: Map<string, { soma: number; count: number }> = new Map()

    polls.forEach((poll: Record<string, unknown>) => {
      const nome = poll.candidato_nome as string
      const intencao = (poll.intencao as number) || 0

      if (mediasPorCandidato.has(nome)) {
        const atual = mediasPorCandidato.get(nome)!
        atual.soma += intencao
        atual.count += 1
      } else {
        mediasPorCandidato.set(nome, { soma: intencao, count: 1 })
      }
    })

    // Calcular média final e ordenar por média (decrescente)
    const ranking = Array.from(mediasPorCandidato.entries())
      .map(([nome, { soma, count }]) => ({
        nome,
        media: Math.round((soma / count) * 10) / 10,
        totalPesquisas: count,
      }))
      .sort((a, b) => b.media - a.media)

    // Encontrar a posição do candidato especificado
    const posicaoCandidato = ranking.findIndex(
      (c) => c.nome.toUpperCase() === candidato.toUpperCase()
    )

    const dadosCandidato = posicaoCandidato >= 0 ? ranking[posicaoCandidato] : null

    // ---- Projeção de votos baseada nas pesquisas por cidade ----
    // Para cada cidade, pegar a ÚLTIMA pesquisa (mais recente) do candidato
    // e calcular: (intencao% / 100) × eleitorado da cidade
    let projecaoVotos: number | null = null
    let cidadesComPesquisa = 0

    const pollsDoCandidato = polls.filter(
      (p: Record<string, unknown>) => (p.candidato_nome as string).toUpperCase() === candidato.toUpperCase()
    )

    if (pollsDoCandidato.length > 0) {
      // Agrupar por cidade: guardar a pesquisa mais recente de cada cidade
      const ultimaPorCidade: Map<string, { intencao: number; data: string }> = new Map()

      pollsDoCandidato.forEach((poll: Record<string, unknown>) => {
        const cities = poll.cities as { name: string } | null
        const cidadeNome = cities?.name || null
        if (!cidadeNome || cidadeNome === 'Estado') return

        const dataStr = (poll.data as string) || ''
        const intencao = (poll.intencao as number) || 0

        const existente = ultimaPorCidade.get(cidadeNome)
        if (!existente || dataStr > existente.data) {
          ultimaPorCidade.set(cidadeNome, { intencao, data: dataStr })
        }
      })

      // Calcular projeção somando votos por cidade
      let totalVotosProjetados = 0
      let cidadesCalculadas = 0

      ultimaPorCidade.forEach(({ intencao }, cidadeNome) => {
        const eleitorado = getEleitoradoByCity(cidadeNome)
        if (eleitorado && eleitorado > 0) {
          const votos = Math.round((intencao / 100) * eleitorado)
          totalVotosProjetados += votos
          cidadesCalculadas++
        }
      })

      if (cidadesCalculadas > 0) {
        projecaoVotos = totalVotosProjetados
        cidadesComPesquisa = cidadesCalculadas
      }
    }

    return NextResponse.json({
      posicao: posicaoCandidato >= 0 ? posicaoCandidato + 1 : 0,
      totalCandidatos: ranking.length,
      mediaCandidato: dadosCandidato?.media ?? null,
      totalPesquisasCandidato: dadosCandidato?.totalPesquisas ?? 0,
      candidato,
      projecaoVotos,
      cidadesComPesquisa,
      // Top 5 para contexto
      top5: ranking.slice(0, 5).map((c, idx) => ({
        posicao: idx + 1,
        nome: c.nome,
        media: c.media,
      })),
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
