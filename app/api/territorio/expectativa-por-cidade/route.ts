import { NextResponse } from 'next/server'
import {
  buildCitySummaries,
  getTerritorioExpectativaSheetConfig,
  getTerritorioExpectativaSheetCredentials,
  resolveCityLeaders,
  resolveCitySummary,
} from '@/lib/territorio-expectativa-sheet'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const cidade = body.cidade
    const credentials = body.credentials as string | Record<string, unknown> | undefined
    const range = body.range as string | undefined

    if (!cidade || typeof cidade !== 'string') {
      return NextResponse.json({ error: 'cidade é obrigatória' }, { status: 400 })
    }

    const { spreadsheetId, sheetName } = getTerritorioExpectativaSheetConfig(body)

    if (!spreadsheetId || !sheetName) {
      return NextResponse.json(
        {
          error:
            'spreadsheet_id e sheet_name são obrigatórios. Configure nas variáveis de ambiente ou envie no corpo da requisição.',
        },
        { status: 400 }
      )
    }

    const credentialsObj = getTerritorioExpectativaSheetCredentials(
      credentials as string | Record<string, unknown> | undefined,
      'territorio'
    )

    if (!credentialsObj) {
      return NextResponse.json(
        {
          error:
            'Credenciais não encontradas. Configure GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY e GOOGLE_SERVICE_ACCOUNT_EMAIL nas variáveis de ambiente ou envie no corpo da requisição.',
        },
        { status: 400 }
      )
    }

    const { summaries: summariesByCity, leadersByCity } = await buildCitySummaries(
      spreadsheetId,
      sheetName,
      range,
      credentialsObj
    )

    if (summariesByCity.size === 0) {
      return NextResponse.json({
        expectativaVotos: 0,
        promessaVotos: 0,
        expectativaLegadoVotos: 0,
        votacaoFinal2022: 0,
        liderancas: 0,
        message: 'Planilha vazia',
      })
    }

    const citySummary = resolveCitySummary(cidade, summariesByCity)
    const cityLeaders = resolveCityLeaders(cidade, leadersByCity)

    return NextResponse.json({
      cidade,
      expectativaVotos: Math.round(citySummary.expectativaVotos),
      promessaVotos: Math.round(citySummary.promessaVotos),
      expectativaLegadoVotos: Math.round(citySummary.expectativaLegadoVotos || 0),
      votacaoFinal2022: Math.round(citySummary.votacaoFinal2022),
      liderancas: citySummary.liderancas,
      liderancasDetalhe: cityLeaders.map((leader) => ({
        nome: leader.nome,
        cargo: leader.cargo || '-',
        projecaoVotos: Math.round(leader.projecaoVotos),
        projecaoAferida: Math.round(leader.projecaoAferida || 0),
        projecaoPromessa: Math.round(leader.projecaoPromessa || 0),
        projecaoLegado: Math.round(leader.projecaoLegado || 0),
      })),
    })
  } catch (error: unknown) {
    console.error('Erro ao buscar expectativa de votos por cidade:', error)
    const err = error as { code?: number; message?: string }

    if (err.code === 403) {
      return NextResponse.json(
        { error: 'Acesso negado. Verifique se a planilha foi compartilhada com o email do Service Account.' },
        { status: 403 }
      )
    }

    if (err.code === 404) {
      return NextResponse.json({ error: 'Planilha não encontrada. Verifique o ID da planilha.' }, { status: 404 })
    }

    return NextResponse.json(
      { error: err.message || 'Erro ao processar dados da planilha' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const body: Record<string, unknown> = {}
    const { spreadsheetId, sheetName, range } = getTerritorioExpectativaSheetConfig(body)
    const credentialsObj = getTerritorioExpectativaSheetCredentials(undefined, 'territorio')

    if (!spreadsheetId || !sheetName || !credentialsObj) {
      return NextResponse.json(
        { error: 'Configuração de planilha/credenciais não disponível para gerar resumo por cidade.' },
        { status: 400 }
      )
    }

    const { summaries: summariesByCity } = await buildCitySummaries(spreadsheetId, sheetName, range, credentialsObj)
    const summariesObject = Object.fromEntries(summariesByCity.entries())

    return NextResponse.json({
      totalCidades: summariesByCity.size,
      summaries: summariesObject,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao processar resumo por cidade'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
