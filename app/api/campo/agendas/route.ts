import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const agendaSchema = z.object({
  date: z.string(),
  city_id: z.string().optional(), // Pode ser UUID ou código IBGE (ex: 'ibge-2201000')
  type: z.enum(['visita', 'evento', 'reuniao', 'outro']),
  status: z.enum(['planejada', 'concluida', 'cancelada']).optional(),
  description: z.string().optional(),
  google_event_id: z.string().optional(),
  hora_evento: z.string().optional(),
  incluir_fluxo_digital: z.boolean().optional(),
})

export async function GET() {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('agendas')
      .select(`
        *,
        cities (
          id,
          name,
          state
        )
      `)
      .order('date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validated = agendaSchema.parse(body)

    if (validated.google_event_id) {
      const { data: existing } = await supabase
        .from('agendas')
        .select('id')
        .eq('google_event_id', validated.google_event_id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: 'Este compromisso já está registrado em Campo & Agenda', existingId: existing.id },
          { status: 409 }
        )
      }
    }

    const { data, error } = await supabase
      .from('agendas')
      .insert({
        ...validated,
        candidate_id: user.id,
        status: validated.status || 'planejada',
        incluir_fluxo_digital: validated.incluir_fluxo_digital ?? false,
      })
      .select(`
        *,
        cities (
          id,
          name,
          state
        )
      `)
      .single()

    if (error) {
      const msg = error.message
      if (msg.includes('incluir_fluxo_digital')) {
        return NextResponse.json(
          {
            error:
              'Falta a coluna incluir_fluxo_digital em agendas. Execute database/add-agendas-fluxo-digital.sql no SQL Editor do Supabase.',
          },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    let pacoteCriado = 0
    if (data && (validated.incluir_fluxo_digital ?? false)) {
      try {
        const { seedProducaoFromAgenda } = await import('@/lib/fluxo-digital/seed-producao')
        const seed = await seedProducaoFromAgenda(String(data.id))
        pacoteCriado = seed.criados || (seed.jaExistia ? seed.total : 0)
      } catch (seedErr) {
        console.error('[campo/agendas] seed produção:', seedErr)
      }
    }

    return NextResponse.json(
      { ...data, pacote_conteudos: pacoteCriado },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

