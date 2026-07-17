import { NextResponse } from 'next/server'
import {
  buildCitySummariesFromDb,
  resolveCityLeaders,
  resolveCitySummary,
} from '@/lib/territorio-liderancas-db'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const cidade = body.cidade
    const refresh = body.refresh === true || body.refresh === '1'

    if (!cidade || typeof cidade !== 'string') {
      return NextResponse.json({ error: 'cidade é obrigatória' }, { status: 400 })
    }

    const { summaries: summariesByCity, leadersByCity } = await buildCitySummariesFromDb(
      Boolean(refresh),
    )

    if (summariesByCity.size === 0) {
      return NextResponse.json({
        expectativaVotos: 0,
        promessaVotos: 0,
        expectativaLegadoVotos: 0,
        votacaoFinal2022: 0,
        liderancas: 0,
        message: 'Tabela territorio_liderancas vazia',
        fonte: 'db',
      })
    }

    const citySummary = resolveCitySummary(cidade, summariesByCity)
    const cityLeaders = resolveCityLeaders(cidade, leadersByCity)

    return NextResponse.json({
      cidade,
      fonte: 'db',
      cenarioPadrao: 'legado_anterior',
      expectativaVotos: Math.round(citySummary.expectativaVotos),
      promessaVotos: Math.round(citySummary.promessaVotos),
      expectativaLegadoVotos: Math.round(citySummary.expectativaLegadoVotos || 0),
      votacaoFinal2022: Math.round(citySummary.votacaoFinal2022),
      liderancas: citySummary.liderancas,
      liderancasDetalhe: cityLeaders.map((leader) => ({
        nome: leader.nome,
        cargo: leader.cargo || '-',
        depEstadual: leader.depEstadual || '',
        projecaoVotos: Math.round(leader.projecaoVotos),
        projecaoAferida: Math.round(leader.projecaoAferida || 0),
        projecaoPromessa: Math.round(leader.projecaoPromessa || 0),
        projecaoLegado: Math.round(leader.projecaoLegado || 0),
        emDialogo: Boolean(leader.emDialogo),
      })),
    })
  } catch (error: unknown) {
    console.error('Erro ao buscar expectativa de votos por cidade (DB):', error)
    const err = error as { message?: string }
    return NextResponse.json(
      { error: err.message || 'Erro ao processar dados de territorio_liderancas' },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  try {
    const refresh = new URL(request.url).searchParams.get('refresh') === '1'
    const { summaries: summariesByCity } = await buildCitySummariesFromDb(refresh)
    const summariesObject = Object.fromEntries(summariesByCity.entries())

    return NextResponse.json({
      fonte: 'db',
      cenarioPadrao: 'legado_anterior',
      totalCidades: summariesByCity.size,
      summaries: summariesObject,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao processar resumo por cidade'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
