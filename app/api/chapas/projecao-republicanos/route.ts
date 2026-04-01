import { createClient } from '@/lib/supabase/server'
import {
  nomePartidoEhRepublicanos,
  normalizarNomePartidoChapa,
} from '@/lib/chapas-republicanos-match'
import {
  calcularDistribuicaoDHondt,
  calcularDistanciaSegundaVagaRepublicanos,
} from '@/lib/chapas-segunda-vaga-republicanos'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
const ESTADUAL_PREFIX = 'estadual_'
const PARTIDO_ALVO_ETIQUETA = 'REPUBLICANOS'

/**
 * Mesma regra do client (chapasService): dono da base compartilhada de chapas.
 * Evita misturar cenários de usuários diferentes quando o RLS retorna todas as linhas.
 */
async function getChapasSharedOwnerUserId(
  supabase: ReturnType<typeof createClient>,
  fallbackUserId: string
): Promise<string> {
  const { data: ativo } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .not('id', 'like', `${ESTADUAL_PREFIX}%`)
    .eq('ativo', true)
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ativo?.user_id) return ativo.user_id

  const { data: base } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .eq('id', 'base')
    .not('id', 'like', `${ESTADUAL_PREFIX}%`)
    .limit(1)
    .maybeSingle()

  if (base?.user_id) return base.user_id

  const { data: first } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .not('id', 'like', `${ESTADUAL_PREFIX}%`)
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (first?.user_id) return first.user_id

  return fallbackUserId
}

/**
 * Mesma regra do client (chapas-estaduais-service): dono da base estadual (ids `estadual_%`).
 * Não usar o resolvedor federal aqui — cenários federais e estaduais podem ter `user_id` de origem diferente.
 */
async function getChapasEstaduaisSharedOwnerUserId(
  supabase: ReturnType<typeof createClient>,
  fallbackUserId: string
): Promise<string> {
  const baseEstadualId = `${ESTADUAL_PREFIX}base`

  const { data: ativo } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .like('id', `${ESTADUAL_PREFIX}%`)
    .eq('ativo', true)
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ativo?.user_id) return ativo.user_id

  const { data: base } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .eq('id', baseEstadualId)
    .limit(1)
    .maybeSingle()

  if (base?.user_id) return base.user_id

  const { data: first } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .like('id', `${ESTADUAL_PREFIX}%`)
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (first?.user_id) return first.user_id

  return fallbackUserId
}

type CenarioFederalRow = {
  id: string
  nome: string
  quociente_eleitoral: number | null
  user_id: string
  ativo: boolean | null
}

/**
 * Projeção federal no dashboard: alinhar à página Chapas — priorizar sempre o CENÁRIO PRINCIPAL
 * quando existir, em vez do Cenário Base ou de outra simulação só por estar marcada como ativa.
 */
function resolverCenarioFederalParaProjecao(cenarios: CenarioFederalRow[]): CenarioFederalRow | null {
  if (!cenarios.length) return null

  /** Reconhece ex. "CENÁRIO PRINCIPAL", títulos compostos e id tipo `cenario_principal`. */
  const nomeEhPrincipal = (nome: string) => {
    const semAcento = nome
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\s+/g, ' ')
    if (
      semAcento === 'principal' ||
      semAcento.startsWith('principal ') ||
      semAcento.endsWith(' principal')
    ) {
      return true
    }
    if (
      semAcento === 'cenario principal' ||
      semAcento.startsWith('cenario principal ') ||
      semAcento.includes('cenario principal')
    ) {
      return true
    }
    return false
  }

  const idEhPrincipal = (id: string) => {
    const s = id.trim().toLowerCase()
    return s === 'principal' || /(^|_)principal($|_)/.test(s)
  }

  const principal = cenarios.find((c) => idEhPrincipal(c.id) || nomeEhPrincipal(c.nome))
  const ativo = cenarios.find((c) => c.ativo)
  const base = cenarios.find((c) => c.id === 'base')

  if (principal) return principal
  if (ativo && ativo.id !== 'base') return ativo
  if (ativo) return ativo
  if (base) return base
  return cenarios[0]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const votosExpectativa = parseInt(searchParams.get('votosExpectativa') || '0', 10)
    const escopo = searchParams.get('escopo') === 'estadual' ? 'estadual' : 'federal'

    const supabase = createClient()

    // Verificar autenticação
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const chapasOwnerUserId =
      escopo === 'estadual'
        ? await getChapasEstaduaisSharedOwnerUserId(supabase, user.id)
        : await getChapasSharedOwnerUserId(supabase, user.id)

    let cenarioId = escopo === 'estadual' ? `${ESTADUAL_PREFIX}base` : 'base'
    let ownerUserId: string | null = null
    let quociente = escopo === 'estadual' ? 67000 : 190000
    const numVagas = escopo === 'estadual' ? 30 : 10
    let cenarioNome = 'Cenário Base'

    if (escopo === 'federal') {
      const { data: cenariosFederais } = await supabase
        .from('chapas_cenarios')
        .select('id, nome, quociente_eleitoral, user_id, ativo')
        .eq('user_id', chapasOwnerUserId)
        .not('id', 'like', `${ESTADUAL_PREFIX}%`)

      const escolhido = resolverCenarioFederalParaProjecao((cenariosFederais ?? []) as CenarioFederalRow[])
      if (escolhido) {
        cenarioId = escolhido.id
        ownerUserId = escolhido.user_id
        quociente = escolhido.quociente_eleitoral || 190000
        cenarioNome = escolhido.nome
      }
    } else {
      // Estadual: mesmo critério da página /dashboard/chapas-estaduais (cenário ativo estadual_*, senão base)
      const { data: cenarioAtivo } = await supabase
        .from('chapas_cenarios')
        .select('id, nome, quociente_eleitoral, user_id')
        .eq('user_id', chapasOwnerUserId)
        .eq('ativo', true)
        .like('id', `${ESTADUAL_PREFIX}%`)
        .order('atualizado_em', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cenarioAtivo) {
        cenarioId = cenarioAtivo.id
        ownerUserId = cenarioAtivo.user_id
        quociente = cenarioAtivo.quociente_eleitoral || 67000
        cenarioNome = cenarioAtivo.nome
      } else {
        const { data: cenarioBase } = await supabase
          .from('chapas_cenarios')
          .select('id, nome, quociente_eleitoral, user_id')
          .eq('user_id', chapasOwnerUserId)
          .eq('id', cenarioId)
          .like('id', `${ESTADUAL_PREFIX}%`)
          .maybeSingle()

        if (cenarioBase) {
          ownerUserId = cenarioBase.user_id
          quociente = cenarioBase.quociente_eleitoral || 67000
          cenarioNome = cenarioBase.nome
        }
      }
    }

    if (!ownerUserId) {
      return NextResponse.json(
        {
          escopo,
          message:
            escopo === 'estadual'
              ? 'Cenário estadual não configurado. Acesse Chapas Estaduais.'
              : 'Cenário federal não configurado. Acesse Chapas (federal).',
        },
        { status: 200 }
      )
    }

    // Buscar partidos do cenário
    const { data: partidosData, error: partidosError } = await supabase
      .from('chapas_partidos')
      .select('partido_nome, votos_legenda, candidato_nome, candidato_votos')
      .eq('user_id', ownerUserId)
      .eq('cenario_id', cenarioId)

    if (partidosError) {
      console.error('Erro ao buscar partidos:', partidosError)
      return NextResponse.json(
        {
          escopo,
          message:
            escopo === 'estadual'
              ? 'Não foi possível carregar chapas estaduais.'
              : 'Não foi possível carregar chapas federais.',
        },
        { status: 200 }
      )
    }

    if (!partidosData || partidosData.length === 0) {
      return NextResponse.json(
        {
          escopo,
          cenario: cenarioNome,
          message:
            escopo === 'estadual'
              ? 'Nenhum candidato neste cenário estadual. Verifique Chapas Estaduais.'
              : 'Nenhum candidato neste cenário federal. Verifique Chapas.',
        },
        { status: 200 }
      )
    }

    // Agrupar por partido e calcular votos totais
    const partidosMap: { [key: string]: { votosLegenda: number; votosCandidatos: number } } = {}

    partidosData.forEach((item) => {
      const chavePartido = normalizarNomePartidoChapa(item.partido_nome)
      if (!chavePartido) return

      if (!partidosMap[chavePartido]) {
        partidosMap[chavePartido] = {
          votosLegenda: 0,
          votosCandidatos: 0,
        }
      }

      const candRaw = (item.candidato_nome ?? '').trim()
      const cand = normalizarNomePartidoChapa(candRaw)
      // Igual à página Chapas: legenda pode estar só em votos_legenda (replicado nas linhas) ou na linha LEGENDA
      partidosMap[chavePartido].votosLegenda = Math.max(
        partidosMap[chavePartido].votosLegenda,
        item.votos_legenda || 0
      )
      if (cand === 'LEGENDA' || cand === 'VOTOS LEGENDA') {
        partidosMap[chavePartido].votosLegenda = Math.max(
          partidosMap[chavePartido].votosLegenda,
          item.candidato_votos || 0
        )
      } else {
        partidosMap[chavePartido].votosCandidatos += item.candidato_votos || 0
      }
    })

    // Calcular votos totais por partido
    const partidosComVotos = Object.entries(partidosMap).map(([nome, dados]) => {
      const votosTotal = dados.votosCandidatos + dados.votosLegenda
      const quocienteMinimo = quociente * 0.8
      const atingiuMinimo = votosTotal >= quocienteMinimo
      
      return {
        nome,
        votosTotal,
        atingiuMinimo
      }
    })

    // Calcular distribuição D'Hondt
    const distribuicao = calcularDistribuicaoDHondt(partidosComVotos, quociente, numVagas)

    // Encontrar o partido REPUBLICANOS
    const republicanos = distribuicao.find((p) => nomePartidoEhRepublicanos(p.nome))

    // Calcular distância para 2ª vaga do REPUBLICANOS
    const analiseSegundaVaga = calcularDistanciaSegundaVagaRepublicanos(
      partidosComVotos,
      quociente,
      numVagas
    )

    // Calcular ranking individual se votosExpectativa foi informado
    // Exclui o próprio Jadyel (REPUBLICANOS) da comparação, pois queremos saber
    // quantos dos DEMAIS candidatos têm votação acima da expectativa dele
    let rankingInfo = null
    if (votosExpectativa > 0) {
      const candidatosValidos = partidosData.filter((c) => {
        const n = normalizarNomePartidoChapa(c.candidato_nome)
        return (
          n !== 'LEGENDA' &&
          n !== 'VOTOS LEGENDA' &&
          !(c.candidato_nome && c.candidato_nome.toUpperCase().includes('JADYEL'))
        )
      })

      const todosOrdenados = candidatosValidos
        .map(c => ({
          nome: c.candidato_nome,
          partido: c.partido_nome,
          votos: c.candidato_votos || 0,
        }))
        .sort((a, b) => b.votos - a.votos)

      // Contar quantos candidatos têm votação acima da expectativa
      const acimaDaExpectativa = todosOrdenados.filter(c => c.votos > votosExpectativa).length
      const posicao = acimaDaExpectativa + 1

      rankingInfo = {
        posicao,
        totalCandidatos: todosOrdenados.length,
      }
    }

    if (!republicanos) {
      return NextResponse.json({
        partido: PARTIDO_ALVO_ETIQUETA,
        eleitos: 0,
        escopo,
        cenario: cenarioNome,
        quociente,
        numVagas,
        ranking: rankingInfo,
        segundaVaga: analiseSegundaVaga,
        message: `Partido ${PARTIDO_ALVO_ETIQUETA} (ou sigla REPUB) não encontrado no cenário.`
      })
    }

    return NextResponse.json({
      partido: PARTIDO_ALVO_ETIQUETA,
      eleitos: republicanos.vagasObtidas,
      escopo,
      cenario: cenarioNome,
      quociente,
      numVagas,
      ranking: rankingInfo,
      segundaVaga: analiseSegundaVaga,
    })
  } catch (error: unknown) {
    console.error('Erro ao calcular projeção:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
