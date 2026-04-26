import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AGENDA_CONTEUDO_PACK } from '@/lib/conteudo/agenda-pack'

const bodySchema = z.object({
  date: z.string(),
  city_id: z.string().optional(),
  type: z.enum(['visita', 'evento', 'reuniao', 'outro']),
  status: z.enum(['planejada', 'concluida', 'cancelada']).optional(),
  description: z.string().optional(),
  obra_id: z.string().uuid().optional(),
  hora_evento: z.string().optional(),
  territorio: z.string().optional(),
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
      .select(
        `
        *,
        cities ( id, name, state ),
        obras ( id, obra, municipio )
      `
      )
      .order('date', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
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

    const json = await request.json()
    const validated = bodySchema.parse(json)

    const insertPayload: Record<string, unknown> = {
      date: validated.date,
      city_id: validated.city_id || null,
      type: validated.type,
      status: validated.status || 'planejada',
      description: validated.description || null,
      candidate_id: user.id,
    }

    if (validated.obra_id) insertPayload.obra_id = validated.obra_id
    if (validated.hora_evento) insertPayload.hora_evento = validated.hora_evento
    if (validated.territorio) insertPayload.territorio = validated.territorio

    const { data: agenda, error: aErr } = await supabase
      .from('agendas')
      .insert(insertPayload)
      .select(
        `
        *,
        cities ( id, name, state ),
        obras ( id, obra, municipio, territorio )
      `
      )
      .single()

    if (aErr || !agenda) {
      return NextResponse.json({ error: aErr?.message ?? 'Erro ao criar agenda' }, { status: 500 })
    }

    let packCreated = 0
    if (validated.obra_id) {
      const cityName =
        (agenda as { cities?: { name?: string } }).cities?.name?.trim() ||
        (agenda as { obras?: { municipio?: string } }).obras?.municipio?.trim() ||
        ''
      const terr =
        validated.territorio?.trim() ||
        (agenda as { obras?: { territorio?: string } }).obras?.territorio?.trim() ||
        null

      const rows = AGENDA_CONTEUDO_PACK.map((s) => ({
        obra_id: validated.obra_id!,
        agenda_id: agenda.id,
        cidade: cityName || null,
        territorio: terr,
        fase: s.fase,
        formato: s.formato,
        template: s.template,
        status: 'rascunho' as const,
        campanha_geral: false,
        data_sugerida: validated.date,
      }))

      const { data: ins, error: pErr } = await supabase.from('conteudos_planejados').insert(rows).select('id')
      if (!pErr && ins) packCreated = ins.length
      if (pErr) {
        console.error('Pacote de conteúdos não criado:', pErr.message)
      }
    }

    return NextResponse.json({ agenda, conteudos_criados: packCreated }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: e.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
