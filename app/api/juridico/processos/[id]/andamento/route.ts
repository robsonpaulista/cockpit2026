import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAndamentoDatajud } from '@/lib/juridico-datajud-server'
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

    const andamento = await fetchAndamentoDatajud(processo)
    return NextResponse.json(andamento)
  } catch (error) {
    console.error('[juridico/processos/andamento]', error)
    return NextResponse.json({ error: 'Erro ao consultar andamento' }, { status: 500 })
  }
}
