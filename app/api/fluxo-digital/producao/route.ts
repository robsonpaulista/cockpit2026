import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import {
  buildProducaoFromConteudos,
  seedProducaoFromAgenda,
} from '@/lib/fluxo-digital/seed-producao'
import { supabaseNetworkErrorResponse } from '@/lib/supabase/network-error'

export const dynamic = 'force-dynamic'

/** Lista peças / KPI Produzido das agendas do Fluxo Digital. */
export async function GET() {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const data = await buildProducaoFromConteudos()
    return NextResponse.json(data)
  } catch (error: unknown) {
    const networkResponse = supabaseNetworkErrorResponse(error)
    if (networkResponse) return networkResponse
    console.error('[fluxo-digital/producao GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

const postSchema = z.object({
  agendaId: z.string().uuid(),
})

/** Cria o pacote de templates (6 peças) para uma visita da programação. */
export async function POST(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { agendaId } = postSchema.parse(body)
    const result = await seedProducaoFromAgenda(agendaId)
    return NextResponse.json(result, { status: result.jaExistia ? 200 : 201 })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }
    const networkResponse = supabaseNetworkErrorResponse(error)
    if (networkResponse) return networkResponse
    console.error('[fluxo-digital/producao POST]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
