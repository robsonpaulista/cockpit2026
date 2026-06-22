import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Mapa google_event_id → agenda de campo (para badges na página de compromissos). */
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
      .select('id, google_event_id, date, status, type')
      .not('google_event_id', 'is', null)

    if (error) {
      if (error.message.includes('google_event_id')) {
        return NextResponse.json({ links: {} })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const links: Record<
      string,
      { id: string; date: string; status: string; type: string }
    > = {}

    for (const row of data ?? []) {
      if (!row.google_event_id) continue
      links[row.google_event_id] = {
        id: row.id,
        date: row.date,
        status: row.status,
        type: row.type,
      }
    }

    return NextResponse.json({ links })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
