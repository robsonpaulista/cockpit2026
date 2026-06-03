import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchComunicacoesProcesso } from '@/lib/juridico-comunica-server'
import { loadProcessosDimensaoDataset } from '@/lib/juridico-processos-dimensao-server'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

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
    const dataset = loadProcessosDimensaoDataset()
    const processo = dataset.processos.find((p) => p.id === processoId || p.processo === processoId)

    if (!processo) {
      return NextResponse.json({ error: 'Processo não encontrado' }, { status: 404 })
    }

    const result = await fetchComunicacoesProcesso(processo)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[juridico/processos/comunicacoes]', error)
    return NextResponse.json({ error: 'Erro ao consultar comunicações' }, { status: 500 })
  }
}
