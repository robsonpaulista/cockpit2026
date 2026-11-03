import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { urgenciaExpiracao } from '@/lib/oportunidades-federais'
import { montarAlertasPrazo } from '@/lib/services/oportunidades-federais-cruzamento'
import { carregarBaseCruzamento } from '@/lib/services/oportunidades-federais-cruzamento-db'
import {
  fetchProgramasAbertosPI,
  filtrarRelevantesPi,
  linhaDbParaOportunidade,
} from '@/lib/services/transferegov-programas'
import { syncOportunidadesFederais } from '@/lib/services/oportunidades-federais-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function tabelaAusente(message: string): boolean {
  return /oportunidades_federais|schema cache|does not exist|relation/i.test(message)
}

async function payloadCruzamento(itens: ReturnType<typeof filtrarRelevantesPi>['itens']) {
  let base = {
    municipios: [] as Awaited<ReturnType<typeof carregarBaseCruzamento>>['municipios'],
    total: 0,
    comLideranca: 0,
    comEmenda: 0,
    expectativaTotal: 0,
  }
  try {
    base = await carregarBaseCruzamento()
  } catch (e) {
    console.warn('[oportunidades-federais] base territorial indisponível', e)
  }
  return {
    base,
    alertas: montarAlertasPrazo(itens),
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: syncMeta } = await supabase
      .from('oportunidades_federais_sync')
      .select('*')
      .eq('id', 'transferegov')
      .maybeSingle()

    const { data, error } = await supabase
      .from('oportunidades_federais')
      .select('*')
      .eq('uf', 'PI')
      .neq('expiracao_prop', 'PROG_EXPIRADO')
      .order('dt_fim_receb_prop', { ascending: true, nullsFirst: false })

    if (!error && data && data.length > 0) {
      const mapeados = data.map((row) => linhaDbParaOportunidade(row as Record<string, unknown>))
      const { itens, excluidosForaPi } = filtrarRelevantesPi(mapeados)
      itens.sort(
        (a, b) =>
          urgenciaExpiracao(a.expiracaoProp) - urgenciaExpiracao(b.expiracaoProp) ||
          (a.dtFimRecebProp ?? '').localeCompare(b.dtFimRecebProp ?? ''),
      )
      const cruzamento = await payloadCruzamento(itens)
      return NextResponse.json({
        itens,
        excluidosForaPi,
        origem: 'db',
        sync: syncMeta ?? null,
        aviso: null,
        ...cruzamento,
      })
    }

    // Fallback ao vivo se a tabela não existir ou estiver vazia
    const live = await fetchProgramasAbertosPI()
    const aviso = error
      ? tabelaAusente(error.message)
        ? 'Tabela ainda não criada no Supabase — mostrando dados ao vivo do Transferegov. Execute database/create-oportunidades-federais.sql.'
        : `Cache local indisponível (${error.message}). Dados ao vivo do Transferegov.`
      : data?.length === 0
        ? 'Cache local vazio — dados ao vivo do Transferegov. Use Sincronizar para gravar.'
        : null

    const cruzamento = await payloadCruzamento(live.itens)
    return NextResponse.json({
      itens: live.itens,
      excluidosForaPi: live.excluidosForaPi,
      origem: 'live',
      sync: syncMeta ?? { last_source_update: live.fonteAtualizacao },
      aviso,
      ...cruzamento,
    })
  } catch (e: unknown) {
    console.error('[oportunidades-federais GET]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 },
    )
  }
}

/** Sincronização manual (usuário autenticado). */
export async function POST() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Preferir service role se disponível (bypassa RLS de escrita)
    let admin
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      admin = createAdminClient()
    } catch {
      admin = supabase
    }

    const resultado = await syncOportunidadesFederais(admin)
    if (!resultado.ok && resultado.tableMissing) {
      // Ainda assim devolve live para a UI
      const live = await fetchProgramasAbertosPI()
      const cruzamento = await payloadCruzamento(live.itens)
      return NextResponse.json({
        ...resultado,
        itens: live.itens,
        excluidosForaPi: live.excluidosForaPi,
        aviso:
          'Execute database/create-oportunidades-federais.sql no Supabase para persistir o cache. Dados ao vivo carregados.',
        ...cruzamento,
      })
    }
    if (!resultado.ok) {
      return NextResponse.json(resultado, { status: 500 })
    }

    const { data } = await admin
      .from('oportunidades_federais')
      .select('*')
      .eq('uf', 'PI')
      .neq('expiracao_prop', 'PROG_EXPIRADO')
      .order('dt_fim_receb_prop', { ascending: true, nullsFirst: false })

    const filtrados = filtrarRelevantesPi(
      (data ?? []).map((row: Record<string, unknown>) => linhaDbParaOportunidade(row)),
    )
    const cruzamento = await payloadCruzamento(filtrados.itens)
    return NextResponse.json({
      ...resultado,
      itens: filtrados.itens,
      excluidosForaPi: filtrados.excluidosForaPi,
      ...cruzamento,
    })
  } catch (e: unknown) {
    console.error('[oportunidades-federais POST]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
