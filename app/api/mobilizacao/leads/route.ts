import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  extractCoordinatorFromLeaderJoin,
  fetchLeaderWithCoordinatorForPublicContext,
  insertMilitanciaLead,
} from '@/lib/mobilizacao-lead-capture'

export const dynamic = 'force-dynamic'

const createLeadBodySchema = z.object({
  nome: z.string().trim().min(2, 'Nome é obrigatório'),
  whatsapp: z.string().trim().min(8, 'WhatsApp é obrigatório'),
  instagram: z.string().trim().optional().nullable(),
  leader_id: z.string().uuid('leader_id inválido'),
  origem: z.string().trim().min(1).max(64).optional(),
})

type CoordinatorRow = {
  id: string
  nome: string
  regiao: string | null
}

type LeaderContextRow = {
  id: string
  nome: string
  cidade: string | null
  coordinator_id: string | null
  coordinators: CoordinatorRow | CoordinatorRow[] | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const leaderId = searchParams.get('leader_id')?.trim() ?? ''
    if (!leaderId) {
      return NextResponse.json({ error: 'leader_id é obrigatório' }, { status: 400 })
    }
    const parsedLeaderId = z.string().uuid().safeParse(leaderId)
    if (!parsedLeaderId.success) {
      return NextResponse.json({ error: 'leader_id inválido' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await fetchLeaderWithCoordinatorForPublicContext(admin, parsedLeaderId.data)

    if (error) {
      console.error('[mobilizacao/leads GET] erro ao buscar líder', error)
      return NextResponse.json({ error: 'Erro ao validar líder' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Liderança não encontrada' }, { status: 404 })
    }

    const row = data as LeaderContextRow
    const coordinator = extractCoordinatorFromLeaderJoin(row.coordinators)
    return NextResponse.json({
      leader: {
        id: row.id,
        nome: row.nome,
        cidade: row.cidade,
      },
      coordinator: coordinator
        ? {
            id: coordinator.id,
            nome: coordinator.nome,
            regiao: coordinator.regiao,
          }
        : null,
    })
  } catch (error) {
    console.error('[mobilizacao/leads GET] erro inesperado', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as unknown
    const parsed = createLeadBodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const result = await insertMilitanciaLead(admin, {
      nome: parsed.data.nome,
      whatsappRaw: parsed.data.whatsapp,
      instagramRaw: parsed.data.instagram,
      leaderId: parsed.data.leader_id,
      origem: parsed.data.origem?.trim() || 'qr',
    })

    if (!result.ok) {
      if (result.status >= 500) {
        console.error('[mobilizacao/leads POST]', result.message)
      }
      return NextResponse.json({ error: result.message }, { status: result.status })
    }

    return NextResponse.json({
      ok: true,
      lead: result.lead,
    })
  } catch (error) {
    console.error('[mobilizacao/leads POST] erro inesperado', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
