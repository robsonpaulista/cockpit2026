import { NextRequest, NextResponse } from 'next/server'
import { montarDistribuicaoCandidatoBweb } from '@/lib/candidato-distribuicao-bweb'
import {
  chaveMatchFromResumo,
  encontrarIdCandidatoMatriz,
  parseNumeroUrnaResumo,
  cargoResumoParaDsCargo,
  anoResumoSuportadoVotacaoSecao,
  parseCdCargoResumo,
} from '@/lib/candidato-votacao-secao-match'
import { parseVotosEleicao } from '@/lib/resumo-eleicoes-dados'
import { createClient } from '@/lib/supabase/server'
import { parseVotacaoSecaoAno } from '@/lib/votacao-secao'
import { getVotacaoSecaoPorMunicipioMultiAno } from '@/lib/votacao-secao-db'

export const dynamic = 'force-dynamic'

const CD_CARGO_POR_DS: Record<string, number> = {
  Governador: 3,
  Senador: 5,
  'Deputado Federal': 6,
  'Deputado Estadual': 7,
  Prefeito: 11,
  Vereador: 13,
}

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
    const cidade = sp.get('cidade')?.trim()
    if (!cidade) {
      return NextResponse.json({ error: 'Informe o parâmetro cidade' }, { status: 400 })
    }

    const ano = parseVotacaoSecaoAno(sp.get('ano'))
    const nr = parseNumeroUrnaResumo(sp.get('nr') ?? '')
    if (nr == null) {
      return NextResponse.json({ error: 'Informe nr (número de urna) válido' }, { status: 400 })
    }

    const cargoTexto = sp.get('cargo')?.trim() ?? ''
    const cdCargoParam = parseCdCargoResumo(sp.get('cd_cargo') ?? '')
    const dsCargo =
      cargoResumoParaDsCargo(cargoTexto, sp.get('cd_cargo') ?? '') ??
      (cargoTexto || null)
    if (!dsCargo) {
      return NextResponse.json({ error: 'Informe cargo ou cd_cargo válido' }, { status: 400 })
    }

    const cdCargo = cdCargoParam ?? CD_CARGO_POR_DS[dsCargo] ?? 0
    if (!cdCargo) {
      return NextResponse.json({ error: 'Cargo não reconhecido para votação por seção' }, { status: 400 })
    }

    const sqRaw = Number.parseInt(sp.get('sq') ?? '', 10)
    const sqCandidato = Number.isFinite(sqRaw) && sqRaw > 0 ? sqRaw : null
    const votosResumoParam = sp.get('votos_resumo')
    const votosResumo =
      votosResumoParam != null && votosResumoParam !== ''
        ? parseVotosEleicao(votosResumoParam)
        : null

    const chave = {
      ano: anoResumoSuportadoVotacaoSecao(String(ano)) ?? ano,
      cdCargo,
      dsCargo,
      nrVotavel: nr,
      sqCandidato,
    }

    const resultado = await getVotacaoSecaoPorMunicipioMultiAno(supabase, cidade, {
      cargo: dsCargo,
      anos: [chave.ano],
    })

    if (!resultado) {
      return NextResponse.json(
        {
          error: `Nenhum dado de votação por seção para ${cidade} (${chave.ano}).`,
          municipio: cidade,
          ano: chave.ano,
        },
        { status: 404 },
      )
    }

    const distribuicao = montarDistribuicaoCandidatoBweb(
      resultado.secoes,
      chave,
      votosResumo,
    )

    const chaveResumo = chaveMatchFromResumo({
      anoEleicao: String(chave.ano),
      cargo: dsCargo,
      codigoCargo: String(cdCargo),
      numeroUrna: String(nr),
      sequencialCandidato: sqCandidato != null ? String(sqCandidato) : '',
    })

    const candidatoId = encontrarIdCandidatoMatriz(resultado.secoes, chave)

    return NextResponse.json({
      municipio: resultado.resumo.municipio,
      resumoSecao: resultado.resumo,
      secoes: resultado.secoes,
      candidatoId,
      distribuicao,
      match: {
        chave,
        chaveResumoOk: chaveResumo != null,
        candidatoId,
      },
    })
  } catch (error: unknown) {
    console.error('votacao-secao/distribuicao GET:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
