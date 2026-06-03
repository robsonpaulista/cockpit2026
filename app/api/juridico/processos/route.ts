import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildProcessosDimensaoKpis,
  filtrarProcessosDimensao,
} from '@/lib/juridico-processos-dimensao'
import { enrichProcessosComUltimaDjen } from '@/lib/juridico-comunica-server'
import { enrichProcessosComMovimentacoes } from '@/lib/juridico-movimentacoes-server'
import { loadProcessosDimensaoDataset } from '@/lib/juridico-processos-dimensao-server'

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
    const dataset = loadProcessosDimensaoDataset()
    const filtradosRaw = filtrarProcessosDimensao(dataset.processos, {
      q: searchParams.get('q') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      area: searchParams.get('area') ?? undefined,
      prioridade: searchParams.get('prioridade') ?? undefined,
    })
    let filtrados = await enrichProcessosComMovimentacoes(supabase, filtradosRaw)
    filtrados = await enrichProcessosComUltimaDjen(filtrados)

    const statusSet = new Set<string>()
    const areaSet = new Set<string>()
    const prioridadeSet = new Set<string>()
    for (const p of dataset.processos) {
      if (p.status) statusSet.add(p.status)
      if (p.area) areaSet.add(p.area)
      if (p.prioridade) prioridadeSet.add(p.prioridade)
    }

    return NextResponse.json({
      geradoEm: dataset.geradoEm,
      parteFiltro: dataset.parteFiltro,
      kpis: buildProcessosDimensaoKpis(dataset.processos),
      filtros: {
        status: [...statusSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        areas: [...areaSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        prioridades: [...prioridadeSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
      },
      total: filtrados.length,
      processos: filtrados,
    })
  } catch (error) {
    console.error('[juridico/processos]', error)
    return NextResponse.json({ error: 'Erro ao carregar processos' }, { status: 500 })
  }
}
