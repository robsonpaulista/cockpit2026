import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { isSupabaseNetworkError } from '@/lib/supabase/network-error'
import { normalizeIptMunicipio } from '@/lib/ipt'

export const dynamic = 'force-dynamic'

type VisitRow = { id?: string; checkin_time?: string | null }
type CityRow = { name?: string | null; state?: string | null }

function nomeCidade(cities: unknown): string {
  if (!cities) return ''
  if (Array.isArray(cities)) {
    return String((cities[0] as CityRow | undefined)?.name ?? '').trim()
  }
  return String((cities as CityRow).name ?? '').trim()
}

function visitasDaAgenda(visits: unknown): VisitRow[] {
  if (!visits) return []
  return Array.isArray(visits) ? (visits as VisitRow[]) : [visits as VisitRow]
}

function parseRefMs(checkin: string | null | undefined, agendaDate: string): number {
  const raw = (checkin && String(checkin).trim()) || agendaDate
  if (!raw) return 0
  if (raw.includes('T')) {
    const t = new Date(raw).getTime()
    return Number.isFinite(t) ? t : 0
  }
  const [y, m, d] = raw.split('-').map(Number)
  if (!y || !m || !d) return 0
  return new Date(y, m - 1, d).getTime()
}

/**
 * Última visita com check-in (ou agenda concluída) no município informado.
 * Query: `?municipio=Nome`
 */
export async function GET(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const municipio = searchParams.get('municipio')?.trim()
    if (!municipio) {
      return NextResponse.json({ error: 'Informe o município' }, { status: 400 })
    }
    const alvo = normalizeIptMunicipio(municipio)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('agendas')
      .select(
        `
        id,
        date,
        type,
        status,
        description,
        hora_evento,
        cities ( name, state ),
        visits ( id, checkin_time )
      `
      )
      .eq('status', 'concluida')
      .order('date', { ascending: false })
      .limit(800)

    if (error) {
      if (isSupabaseNetworkError(error)) {
        return NextResponse.json(
          { error: 'Conexão instável', retryable: true },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    type Cand = {
      id: string
      date: string
      type: string
      status: string
      description: string | null
      horaEvento: string | null
      checkinTime: string | null
      municipio: string
      sortMs: number
    }

    const candidatos: Cand[] = []
    for (const row of data ?? []) {
      const cidade = nomeCidade(row.cities)
      if (!cidade || normalizeIptMunicipio(cidade) !== alvo) continue

      const visits = visitasDaAgenda(row.visits)
      const withCheckin = visits
        .map((v) => v.checkin_time?.trim() || null)
        .filter((t): t is string => Boolean(t))
        .sort((a, b) => b.localeCompare(a))
      const checkinTime = withCheckin[0] ?? null
      // Preferir agendas com check-in real; ainda assim listamos concluídas.
      const sortMs = parseRefMs(checkinTime, String(row.date ?? ''))
      if (sortMs <= 0) continue

      candidatos.push({
        id: String(row.id),
        date: String(row.date ?? ''),
        type: String(row.type ?? 'visita'),
        status: String(row.status ?? ''),
        description: row.description != null ? String(row.description) : null,
        horaEvento: row.hora_evento != null ? String(row.hora_evento) : null,
        checkinTime,
        municipio: cidade,
        sortMs,
      })
    }

    candidatos.sort((a, b) => {
      // Check-in explícito ganha de agenda só concluída na mesma data.
      const ac = a.checkinTime ? 1 : 0
      const bc = b.checkinTime ? 1 : 0
      if (ac !== bc) return bc - ac
      return b.sortMs - a.sortMs
    })

    const ultima = candidatos[0] ?? null
    if (!ultima) {
      return NextResponse.json({ visita: null })
    }

    return NextResponse.json({
      visita: {
        id: ultima.id,
        date: ultima.date,
        type: ultima.type,
        status: ultima.status,
        description: ultima.description,
        horaEvento: ultima.horaEvento,
        checkinTime: ultima.checkinTime,
        municipio: ultima.municipio,
      },
    })
  } catch (e: unknown) {
    if (isSupabaseNetworkError(e)) {
      return NextResponse.json(
        { error: 'Conexão instável', retryable: true },
        { status: 503 }
      )
    }
    console.error('ultima-visita GET:', e)
    return NextResponse.json({ error: 'Erro ao buscar última visita' }, { status: 500 })
  }
}
