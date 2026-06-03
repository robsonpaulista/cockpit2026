import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  listMovimentacoesProcesso,
  registrarMovimentacao,
} from '@/lib/juridico-movimentacoes-server'
import type { RegistrarMovimentacaoInput } from '@/lib/juridico-movimentacoes'
import { loadProcessosDimensaoDataset } from '@/lib/juridico-processos-dimensao-server'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

function findProcesso(processoId: string) {
  const dataset = loadProcessosDimensaoDataset()
  return dataset.processos.find((p) => p.id === processoId || p.processo === processoId)
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await context.params
    const processoId = decodeURIComponent(id)
    if (!findProcesso(processoId)) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    const movimentacoes = await listMovimentacoesProcesso(supabase, processoId)
    const latest = movimentacoes[0] ?? null

    return NextResponse.json({
      processoId,
      ultimaMovimentacao: latest?.descricao ?? null,
      dataUltimaMovimentacao: latest?.dataMovimentacao ?? null,
      statusAtual: latest?.statusProcesso ?? null,
      movimentacoes,
    })
  } catch (error) {
    console.error('[juridico/processos/movimentacoes GET]', error)
    return NextResponse.json({ error: 'Erro ao carregar histórico' }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await context.params
    const processoId = decodeURIComponent(id)
    const processo = findProcesso(processoId)
    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    const body = (await request.json()) as RegistrarMovimentacaoInput
    const movimentacao = await registrarMovimentacao(supabase, processo.id, user.id, body)
    const movimentacoes = await listMovimentacoesProcesso(supabase, processo.id)

    return NextResponse.json({
      ok: true,
      movimentacao,
      ultimaMovimentacao: movimentacao.descricao,
      dataUltimaMovimentacao: movimentacao.dataMovimentacao,
      statusAtual: movimentacao.statusProcesso,
      movimentacoes,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao registrar movimentação'
    console.error('[juridico/processos/movimentacoes POST]', error)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
