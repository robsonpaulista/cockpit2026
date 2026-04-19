import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import {
  buildCidadeToRegiaoMap,
  getRegiaoParaCidade,
  REGIOES_PI_ORDER,
  historicoIntencaoPorRegiaoVazio,
  normalizeMunicipioNome,
  pesquisasPorRegiaoVazio,
  type HistoricoIntencaoPorRegiaoMap,
  type HistoricoIntencaoPontoGrafico,
  type MediaIntencaoPorRegiao,
  type PesquisaLinhaPorRegiao,
  type PesquisasPorRegiaoMap,
  type RegiaoPiaui,
} from '@/lib/piaui-regiao'
import { getTerritorioDesenvolvimentoPI, type TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import {
  historicoIntencaoPorTdVazio,
  pesquisasPorTdVazio,
  TERRITORIOS_DESENVOLVIMENTO_PI_ORDER,
  type HistoricoIntencaoPorTdMap,
  type MediaIntencaoPorTd,
  type PesquisasPorTdMap,
} from '@/lib/pesquisa-historico-por-td'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const cidadeParaRegiao = buildCidadeToRegiaoMap(
  municipiosPiaui as ReadonlyArray<{ nome: string; lat: number }>
)

type BucketPorData = {
  intencao: number
  count: number
  institutos: string[]
  cidades: string[]
  dataOriginal: string
}

function normalizaDataHistoricoPoll(pollData: string): { dataNormalizada: string; dataOriginal: string } {
  const dataStr = pollData.includes('T') ? pollData.split('T')[0] : pollData
  let dataNormalizada: string
  let dataOriginal: string

  if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    dataNormalizada = dataStr
    dataOriginal = dataStr
  } else {
    const partes = dataStr.split(/[-/]/)
    if (partes.length === 3) {
      if (partes[0].length === 4) {
        dataNormalizada = `${partes[0]}-${partes[1]}-${partes[2]}`
        dataOriginal = dataNormalizada
      } else {
        dataNormalizada = `${partes[2]}-${partes[1]}-${partes[0]}`
        dataOriginal = dataNormalizada
      }
    } else {
      dataNormalizada = dataStr
      dataOriginal = dataStr
    }
  }
  return { dataNormalizada, dataOriginal }
}

function dataExibicaoCompleta(dataOriginal: string): string {
  const [y, m, d] = dataOriginal.split('-')
  if (y && m && d && y.length === 4) return `${d}/${m}/${y}`
  return dataOriginal
}

/**
 * Intenção numérica para agregados (null = sem valor utilizável — não entra na média da região).
 * Aceita vírgula decimal ("21,4") e strings vindas do Postgres.
 */
function parseIntencaoPoll(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  let s = String(raw).trim().replace(/\s/g, '')
  if (s === '') return null
  if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.')
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? n : null
}

function mapBucketsParaSerieGrafico(map: Map<string, BucketPorData>): HistoricoIntencaoPontoGrafico[] {
  return Array.from(map.entries())
    .map(([, { intencao, count, institutos, cidades, dataOriginal }]) => {
      const [, mes, dia] = dataOriginal.split('-')
      const dataExibicao = `${dia}/${mes}`
      return {
        date: dataExibicao,
        dateOriginal: dataOriginal,
        intencao: Math.round((intencao / count) * 10) / 10,
        instituto: institutos.join(', '),
        cidade: cidades.join(', '),
      }
    })
    .sort((a, b) => a.dateOriginal.localeCompare(b.dateOriginal))
}


export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    const isAdmin = Boolean(profile?.is_admin)
    const queryClient = isAdmin ? createAdminClient() : supabase

    // Buscar candidato padrão do localStorage (será passado via query param)
    const { searchParams } = new URL(request.url)
    const candidatoPadrao = searchParams.get('candidato')

    if (!candidatoPadrao) {
      return NextResponse.json({
        data: [],
        mediasPorRegiao: [] as MediaIntencaoPorRegiao[],
        historicoPorRegiao: historicoIntencaoPorRegiaoVazio(),
        pesquisasPorRegiao: pesquisasPorRegiaoVazio(),
        mediasPorTd: [] as MediaIntencaoPorTd[],
        historicoPorTd: historicoIntencaoPorTdVazio(),
        pesquisasPorTd: pesquisasPorTdVazio(),
        historicoMunicipioFiltro: [] as HistoricoIntencaoPontoGrafico[],
        mediaMunicipioFiltro: null as number | null,
        registrosMunicipioFiltro: 0,
        message: 'Candidato padrão não especificado',
      })
    }

    // Buscar todas as pesquisas do candidato padrão com join na tabela cities
    let historicoQuery = queryClient
      .from('polls')
      .select(`
        *,
        cities (
          name
        )
      `)
      .eq('candidato_nome', candidatoPadrao)
      .order('data', { ascending: true })

    if (!isAdmin) {
      historicoQuery = historicoQuery.eq('user_id', user.id)
    }
    const { data: polls, error } = await historicoQuery

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!polls || polls.length === 0) {
      return NextResponse.json({
        data: [],
        mediasPorRegiao: [] as MediaIntencaoPorRegiao[],
        historicoPorRegiao: historicoIntencaoPorRegiaoVazio(),
        pesquisasPorRegiao: pesquisasPorRegiaoVazio(),
        mediasPorTd: [] as MediaIntencaoPorTd[],
        historicoPorTd: historicoIntencaoPorTdVazio(),
        pesquisasPorTd: pesquisasPorTdVazio(),
        historicoMunicipioFiltro: [] as HistoricoIntencaoPontoGrafico[],
        mediaMunicipioFiltro: null as number | null,
        registrosMunicipioFiltro: 0,
        message: 'Nenhuma pesquisa encontrada',
      })
    }

    const pollRows = polls as any[]

    /** Nome vindo do embed PostgREST (objeto ou array) */
    function nomeCidadeNoEmbed(poll: any): string {
      const c = poll.cities
      if (!c) return ''
      if (Array.isArray(c)) return (c[0]?.name as string) || ''
      return (c.name as string) || ''
    }

    /** IDs de município presentes nas linhas (embed pode falhar por RLS / relação) */
    const cidadeIds = [...new Set(pollRows.map((p) => p.cidade_id).filter(Boolean))] as string[]
    const cidadeIdToName = new Map<string, string>()
    if (cidadeIds.length > 0) {
      const { data: cityRows } = await queryClient.from('cities').select('id, name').in('id', cidadeIds)
      for (const row of cityRows || []) {
        if (row.id && row.name) cidadeIdToName.set(String(row.id), String(row.name))
      }
    }

    function resolveNomeMunicipioPoll(poll: any): string {
      const embedded = nomeCidadeNoEmbed(poll)
      if (embedded) return embedded
      if (poll.cidade_id) {
        return cidadeIdToName.get(String(poll.cidade_id)) || 'Cidade não encontrada'
      }
      return 'Estado'
    }

    /** Média de intenção por região (PI), mesma lógica do mapa */
    const acumRegiao = new Map<string, { sum: number; count: number }>()
    pollRows.forEach((poll) => {
      const cidadeNome = resolveNomeMunicipioPoll(poll)
      if (
        !cidadeNome ||
        cidadeNome === 'Estado' ||
        cidadeNome === 'Cidade não encontrada'
      ) {
        return
      }
      const regiao = getRegiaoParaCidade(cidadeNome, cidadeParaRegiao)
      if (!regiao) return
      const int = parseIntencaoPoll(poll.intencao)
      if (int === null) return
      const cur = acumRegiao.get(regiao) ?? { sum: 0, count: 0 }
      cur.sum += int
      cur.count += 1
      acumRegiao.set(regiao, cur)
    })

    const mediasPorRegiao: MediaIntencaoPorRegiao[] = REGIOES_PI_ORDER.map((regiao) => {
      const b = acumRegiao.get(regiao)
      if (!b || b.count === 0) return null
      return {
        regiao,
        media: Math.round((b.sum / b.count) * 10) / 10,
        n: b.count,
      }
    }).filter((x): x is MediaIntencaoPorRegiao => x !== null)

    /** Média de intenção por Território de Desenvolvimento (malha TD / mapa). */
    const acumTd = new Map<TerritorioDesenvolvimentoPI, { sum: number; count: number }>()
    pollRows.forEach((poll) => {
      const cidadeNome = resolveNomeMunicipioPoll(poll)
      if (!cidadeNome || cidadeNome === 'Estado' || cidadeNome === 'Cidade não encontrada') return
      const td = getTerritorioDesenvolvimentoPI(cidadeNome)
      if (!td) return
      const int = parseIntencaoPoll(poll.intencao)
      if (int === null) return
      const cur = acumTd.get(td) ?? { sum: 0, count: 0 }
      cur.sum += int
      cur.count += 1
      acumTd.set(td, cur)
    })

    const mediasPorTd: MediaIntencaoPorTd[] = TERRITORIOS_DESENVOLVIMENTO_PI_ORDER.map((territorio) => {
      const b = acumTd.get(territorio)
      if (!b || b.count === 0) return null
      return {
        territorio,
        media: Math.round((b.sum / b.count) * 10) / 10,
        n: b.count,
      }
    }).filter((x): x is MediaIntencaoPorTd => x !== null)

    // Agrupar por data (todas as pesquisas) e por data+região (mini gráficos)
    const dadosPorData = new Map<string, BucketPorData>()
    const dadosPorDataPorRegiao = new Map<RegiaoPiaui, Map<string, BucketPorData>>()
    for (const r of REGIOES_PI_ORDER) {
      dadosPorDataPorRegiao.set(r, new Map())
    }

    const dadosPorDataPorTd = new Map<TerritorioDesenvolvimentoPI, Map<string, BucketPorData>>()
    for (const t of TERRITORIOS_DESENVOLVIMENTO_PI_ORDER) {
      dadosPorDataPorTd.set(t, new Map())
    }

    const linhasPorRegiao = new Map<RegiaoPiaui, PesquisaLinhaPorRegiao[]>()
    for (const r of REGIOES_PI_ORDER) {
      linhasPorRegiao.set(r, [])
    }

    const linhasPorTd = new Map<TerritorioDesenvolvimentoPI, PesquisaLinhaPorRegiao[]>()
    for (const t of TERRITORIOS_DESENVOLVIMENTO_PI_ORDER) {
      linhasPorTd.set(t, [])
    }

    pollRows.forEach((poll: any) => {
      const { dataNormalizada, dataOriginal } = normalizaDataHistoricoPoll(String(poll.data ?? ''))
      const cidadeNome = resolveNomeMunicipioPoll(poll)
      const instituto = poll.instituto || 'Não informado'
      const intParsed = parseIntencaoPoll(poll.intencao)
      const intencaoNum = intParsed ?? 0

      if (dadosPorData.has(dataNormalizada)) {
        const existente = dadosPorData.get(dataNormalizada)!
        existente.intencao += intencaoNum
        existente.count += 1
        if (!existente.institutos.includes(instituto)) {
          existente.institutos.push(instituto)
        }
        if (!existente.cidades.includes(cidadeNome)) {
          existente.cidades.push(cidadeNome)
        }
      } else {
        dadosPorData.set(dataNormalizada, {
          intencao: intencaoNum,
          count: 1,
          institutos: [instituto],
          cidades: [cidadeNome],
          dataOriginal,
        })
      }

      if (
        cidadeNome &&
        cidadeNome !== 'Estado' &&
        cidadeNome !== 'Cidade não encontrada'
      ) {
        const regiao = getRegiaoParaCidade(cidadeNome, cidadeParaRegiao)
        if (regiao) {
          const mapR = dadosPorDataPorRegiao.get(regiao)!
          if (mapR.has(dataNormalizada)) {
            const ex = mapR.get(dataNormalizada)!
            ex.intencao += intencaoNum
            ex.count += 1
            if (!ex.institutos.includes(instituto)) ex.institutos.push(instituto)
            if (!ex.cidades.includes(cidadeNome)) ex.cidades.push(cidadeNome)
          } else {
            mapR.set(dataNormalizada, {
              intencao: intencaoNum,
              count: 1,
              institutos: [instituto],
              cidades: [cidadeNome],
              dataOriginal,
            })
          }

          linhasPorRegiao.get(regiao)!.push({
            dateOriginal: dataOriginal,
            dataExibicao: dataExibicaoCompleta(dataOriginal),
            cidade: cidadeNome,
            instituto,
            intencao: intParsed === null ? 0 : Math.round(intParsed * 10) / 10,
          })
        }

        const td = getTerritorioDesenvolvimentoPI(cidadeNome)
        if (td) {
          const mapT = dadosPorDataPorTd.get(td)!
          if (mapT.has(dataNormalizada)) {
            const ex = mapT.get(dataNormalizada)!
            ex.intencao += intencaoNum
            ex.count += 1
            if (!ex.institutos.includes(instituto)) ex.institutos.push(instituto)
            if (!ex.cidades.includes(cidadeNome)) ex.cidades.push(cidadeNome)
          } else {
            mapT.set(dataNormalizada, {
              intencao: intencaoNum,
              count: 1,
              institutos: [instituto],
              cidades: [cidadeNome],
              dataOriginal,
            })
          }

          linhasPorTd.get(td)!.push({
            dateOriginal: dataOriginal,
            dataExibicao: dataExibicaoCompleta(dataOriginal),
            cidade: cidadeNome,
            instituto,
            intencao: intParsed === null ? 0 : Math.round(intParsed * 10) / 10,
          })
        }
      }
    })

    const historicoPorRegiao: HistoricoIntencaoPorRegiaoMap = {
      Norte: mapBucketsParaSerieGrafico(dadosPorDataPorRegiao.get('Norte')!),
      'Centro-Norte': mapBucketsParaSerieGrafico(dadosPorDataPorRegiao.get('Centro-Norte')!),
      'Centro-Sul': mapBucketsParaSerieGrafico(dadosPorDataPorRegiao.get('Centro-Sul')!),
      Sul: mapBucketsParaSerieGrafico(dadosPorDataPorRegiao.get('Sul')!),
    }

    const pesquisasPorRegiao: PesquisasPorRegiaoMap = {
      Norte: (linhasPorRegiao.get('Norte') ?? []).sort((a, b) => a.dateOriginal.localeCompare(b.dateOriginal)),
      'Centro-Norte': (linhasPorRegiao.get('Centro-Norte') ?? []).sort((a, b) =>
        a.dateOriginal.localeCompare(b.dateOriginal)
      ),
      'Centro-Sul': (linhasPorRegiao.get('Centro-Sul') ?? []).sort((a, b) =>
        a.dateOriginal.localeCompare(b.dateOriginal)
      ),
      Sul: (linhasPorRegiao.get('Sul') ?? []).sort((a, b) => a.dateOriginal.localeCompare(b.dateOriginal)),
    }

    const historicoPorTd: HistoricoIntencaoPorTdMap = historicoIntencaoPorTdVazio()
    const pesquisasPorTd: PesquisasPorTdMap = pesquisasPorTdVazio()
    for (const t of TERRITORIOS_DESENVOLVIMENTO_PI_ORDER) {
      historicoPorTd[t] = mapBucketsParaSerieGrafico(dadosPorDataPorTd.get(t)!)
      pesquisasPorTd[t] = (linhasPorTd.get(t) ?? []).sort((a, b) => a.dateOriginal.localeCompare(b.dateOriginal))
    }

    const municipioQuery = searchParams.get('municipio')?.trim() ?? ''
    const alvoMunNorm = municipioQuery ? normalizeMunicipioNome(municipioQuery) : ''

    let historicoMunicipioFiltro: HistoricoIntencaoPontoGrafico[] = []
    let mediaMunicipioFiltro: number | null = null
    let registrosMunicipioFiltro = 0

    if (alvoMunNorm) {
      const dadosPorDataMun = new Map<string, BucketPorData>()
      let sumM = 0
      let countM = 0
      pollRows.forEach((poll: any) => {
        const cidadeNome = resolveNomeMunicipioPoll(poll)
        if (!cidadeNome || cidadeNome === 'Estado' || cidadeNome === 'Cidade não encontrada') return
        if (normalizeMunicipioNome(cidadeNome) !== alvoMunNorm) return
        const intParsed = parseIntencaoPoll(poll.intencao)
        if (intParsed === null) return
        sumM += intParsed
        countM += 1
        const { dataNormalizada, dataOriginal } = normalizaDataHistoricoPoll(String(poll.data ?? ''))
        const instituto = poll.instituto || 'Não informado'
        const intencaoNum = intParsed
        if (dadosPorDataMun.has(dataNormalizada)) {
          const ex = dadosPorDataMun.get(dataNormalizada)!
          ex.intencao += intencaoNum
          ex.count += 1
          if (!ex.institutos.includes(instituto)) ex.institutos.push(instituto)
          if (!ex.cidades.includes(cidadeNome)) ex.cidades.push(cidadeNome)
        } else {
          dadosPorDataMun.set(dataNormalizada, {
            intencao: intencaoNum,
            count: 1,
            institutos: [instituto],
            cidades: [cidadeNome],
            dataOriginal,
          })
        }
      })
      historicoMunicipioFiltro = mapBucketsParaSerieGrafico(dadosPorDataMun)
      mediaMunicipioFiltro = countM > 0 ? Math.round((sumM / countM) * 10) / 10 : null
      registrosMunicipioFiltro = countM
    }

    // Converter para array e calcular média
    const dadosFormatados = Array.from(dadosPorData.entries())
      .map(([dataNormalizada, { intencao, count, institutos, cidades, dataOriginal }]) => {
        // Formatar data para exibição (DD/MM apenas, sem ano para manter visual limpo)
        const [ano, mes, dia] = dataOriginal.split('-')
        const dataExibicao = `${dia}/${mes}`
        
        return {
          date: dataExibicao,
          dateOriginal: dataOriginal, // Manter para ordenação correta
          intencao: Math.round((intencao / count) * 10) / 10, // Arredondar para 1 casa decimal
          instituto: institutos.join(', '), // Se houver múltiplos, separar por vírgula
          cidade: cidades.join(', '), // Se houver múltiplos, separar por vírgula
        }
      })
      .sort((a, b) => {
        // Ordenar usando a data original completa (YYYY-MM-DD) para garantir ordem cronológica correta
        return a.dateOriginal.localeCompare(b.dateOriginal)
      })

    return NextResponse.json({
      data: dadosFormatados,
      candidato: candidatoPadrao,
      mediasPorRegiao,
      historicoPorRegiao,
      pesquisasPorRegiao,
      mediasPorTd,
      historicoPorTd,
      pesquisasPorTd,
      historicoMunicipioFiltro,
      mediaMunicipioFiltro,
      registrosMunicipioFiltro,
      municipioFiltro: municipioQuery || null,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

