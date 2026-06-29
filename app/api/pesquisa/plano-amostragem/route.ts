import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  agregarBairrosTse,
  getLocaisVotacaoTsePorMunicipio,
  getMetaCacheEleitoradoLocais,
  locaisParaMapaPlano,
} from '@/lib/eleitorado-locais-pi'
import {
  gerarPlanoAmostragemPublico,
  listarMunicipiosPlanoAmostragem,
  sugerirEntrevistadores,
  type BairroReferencia,
} from '@/lib/plano-amostragem-publico'
import { atribuirLocaisAosBlocos, atribuirSetoresAosBlocos } from '@/lib/plano-amostragem-mapa'
import type { TipoPesquisaPublico } from '@/lib/plano-amostragem-publico-types'
import {
  getMetaSetoresCensitariosPi,
  getSetoresCensitariosPorMunicipio,
  setoresParaMapaPlano,
  setoresParaPlano,
} from '@/lib/setores-censitarios-pi'
import { normalizeMunicipioComparacao } from '@/lib/votacao-secao'
import { VOTACAO_SECAO_ANO_PADRAO } from '@/lib/votacao-secao'

export const dynamic = 'force-dynamic'

const AMOSTRAS_VALIDAS = new Set([400, 500, 600])

export type PesoTerritorialPlano = 'populacao_ibge' | 'eleitorado_tse'
export type CamadaMapaPlano = 'setores_ibge' | 'locais_tse' | 'hibrido'

function parseEntrevistadores(value: string | null, amostra: number): number {
  const n = Number.parseInt(value ?? '', 10)
  if (Number.isFinite(n) && n >= 1 && n <= 50) return n
  return sugerirEntrevistadores(amostra)
}

function parseTipo(value: string | null): TipoPesquisaPublico {
  return value === 'eleitoral' ? 'eleitoral' : 'opiniao'
}

function parseAmostra(value: string | null): number {
  const n = Number.parseInt(value ?? '', 10)
  if (AMOSTRAS_VALIDAS.has(n)) return n
  return 500
}

async function listarBairrosSupabase(
  supabase: ReturnType<typeof createClient>,
  municipio: string,
): Promise<BairroReferencia[]> {
  const alvo = normalizeMunicipioComparacao(municipio)

  const { data, error } = await supabase
    .from('votacao_secao_local')
    .select('nm_bairro, nm_municipio, qt_eleitores_secao')
    .eq('ano_eleicao', VOTACAO_SECAO_ANO_PADRAO)

  if (error || !data?.length) return []

  const contagem = new Map<string, { secoes: number; eleitores: number }>()
  for (const row of data) {
    const nomeMunicipio = String(row.nm_municipio ?? '')
    if (normalizeMunicipioComparacao(nomeMunicipio) !== alvo) continue
    const bairro = String(row.nm_bairro ?? '').trim() || 'Sem bairro informado'
    const prev = contagem.get(bairro) ?? { secoes: 0, eleitores: 0 }
    prev.secoes += 1
    prev.eleitores += Number(row.qt_eleitores_secao) || 0
    contagem.set(bairro, prev)
  }

  return [...contagem.entries()]
    .map(([nome, stats]) => ({
      nome,
      secoes: stats.secoes,
      eleitores: stats.eleitores,
    }))
    .sort((a, b) => (b.eleitores || b.secoes) - (a.eleitores || a.secoes))
}

function bairrosFromCacheTse(municipio: string) {
  const locais = getLocaisVotacaoTsePorMunicipio(municipio)
  const agregados = agregarBairrosTse(locais)
  const bairros: BairroReferencia[] = agregados.map((b) => ({
    nome: b.nome,
    secoes: b.secoes,
    eleitores: b.eleitores,
    zonaRural: b.zonaRural,
  }))

  const eleitoradoUrbano = locais
    .filter((l) => !l.zonaRural)
    .reduce((s, l) => s + l.qtEleitoresSecao, 0)
  const eleitoradoRural = locais
    .filter((l) => l.zonaRural)
    .reduce((s, l) => s + l.qtEleitoresSecao, 0)

  const meta = getMetaCacheEleitoradoLocais()

  return {
    bairros,
    eleitoradoUrbano,
    eleitoradoRural,
    locaisGeo: locaisParaMapaPlano(locais),
    fonte: meta.fonte ? `${meta.fonte} (${meta.ano ?? 2024})` : 'Cache TSE local',
  }
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
    const listOnly = sp.get('list') === 'municipios'

    if (listOnly) {
      return NextResponse.json({ municipios: listarMunicipiosPlanoAmostragem() })
    }

    const municipio = sp.get('municipio')?.trim()
    if (!municipio) {
      return NextResponse.json({ error: 'Informe o parâmetro municipio' }, { status: 400 })
    }

    const amostra = parseAmostra(sp.get('n'))
    const tipo = parseTipo(sp.get('tipo'))
    const instituto = sp.get('instituto')?.trim() || null
    const entrevistadores = parseEntrevistadores(sp.get('entrevistadores'), amostra)

    const setoresIbge = getSetoresCensitariosPorMunicipio(municipio)
    const metaSetores = getMetaSetoresCensitariosPi()
    const temSetoresIbge = setoresIbge.length > 0

    const popUrbanaSetor = setoresIbge
      .filter((s) => s.urbano)
      .reduce((acc, s) => acc + s.populacao, 0)
    const popRuralSetor = setoresIbge
      .filter((s) => !s.urbano)
      .reduce((acc, s) => acc + s.populacao, 0)

    const cacheTse = bairrosFromCacheTse(municipio)
    let bairros = cacheTse.bairros
    let locaisGeo = cacheTse.locaisGeo
    let fonteBairros: string | null = cacheTse.fonte

    if (bairros.length === 0) {
      bairros = await listarBairrosSupabase(supabase, municipio)
      fonteBairros = bairros.length > 0 ? 'Supabase votação por seção 2024' : null
    }

    const pesoTerritorial: PesoTerritorialPlano =
      tipo === 'eleitoral' ? 'eleitorado_tse' : 'populacao_ibge'
    const modoSetoresPlano =
      pesoTerritorial === 'populacao_ibge' && temSetoresIbge

    const plano = gerarPlanoAmostragemPublico({
      municipio,
      amostraTotal: amostra,
      tipoPesquisa: tipo,
      institutoDestino: instituto,
      bairros: modoSetoresPlano ? [] : bairros,
      setores: modoSetoresPlano ? setoresParaPlano(setoresIbge) : setoresParaPlano(setoresIbge),
      eleitoradoUrbanoTse: cacheTse.eleitoradoUrbano,
      eleitoradoRuralTse: cacheTse.eleitoradoRural,
      populacaoUrbanaSetor: popUrbanaSetor,
      populacaoRuralSetor: popRuralSetor,
      pesoTerritorial,
      pesoPorEleitores: pesoTerritorial === 'eleitorado_tse',
      modoSetoresIbge: modoSetoresPlano,
      entrevistadores,
    })

    let setoresGeo = temSetoresIbge ? setoresParaMapaPlano(setoresIbge) : []
    let camadaMapa: CamadaMapaPlano = 'locais_tse'

    if (modoSetoresPlano && setoresGeo.length > 0) {
      setoresGeo = atribuirSetoresAosBlocos(setoresGeo, plano.divisaoTerritorial)
      locaisGeo = []
      camadaMapa = 'setores_ibge'
    } else if (pesoTerritorial === 'eleitorado_tse') {
      if (locaisGeo.length > 0) {
        locaisGeo = atribuirLocaisAosBlocos(locaisGeo, plano.divisaoTerritorial)
      }
      camadaMapa = temSetoresIbge && locaisGeo.length > 0 ? 'hibrido' : 'locais_tse'
    } else if (locaisGeo.length > 0) {
      locaisGeo = atribuirLocaisAosBlocos(locaisGeo, plano.divisaoTerritorial)
      camadaMapa = 'locais_tse'
    }

    return NextResponse.json({
      plano,
      locais: locaisGeo,
      setores: setoresGeo,
      meta: {
        bairrosEncontrados: bairros.length,
        fonteBairros,
        locaisComGeo: locaisGeo.length,
        setoresIbge: setoresIbge.length,
        fonteSetores: metaSetores.fonte,
        pesoTerritorial,
        camadaMapa,
        modoSetoresPlano,
        mapaReferenciaIbge: temSetoresIbge && pesoTerritorial === 'eleitorado_tse',
        pesoPorEleitores: pesoTerritorial === 'eleitorado_tse',
        eleitoradoUrbanoTse: cacheTse.eleitoradoUrbano,
        eleitoradoRuralTse: cacheTse.eleitoradoRural,
        populacaoUrbanaSetor: popUrbanaSetor,
        populacaoRuralSetor: popRuralSetor,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar plano'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
