import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type VisitEntry = {
  date: string
  visits: number
  notes?: string | null
}

function parseDays(raw: string | null): number {
  const n = Number.parseInt(raw || '30', 10)
  if (!Number.isFinite(n) || n < 1) return 30
  return Math.min(n, 365)
}

function normalizeEntries(raw: unknown): VisitEntry[] | null {
  if (!Array.isArray(raw)) return null
  const out: VisitEntry[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const date = typeof row.date === 'string' ? row.date.trim() : ''
    if (!DATE_RE.test(date)) continue
    const visitsRaw = row.visits
    const visits =
      typeof visitsRaw === 'number'
        ? visitsRaw
        : typeof visitsRaw === 'string'
          ? Number.parseInt(visitsRaw, 10)
          : NaN
    if (!Number.isFinite(visits) || visits < 0) continue
    const notes =
      typeof row.notes === 'string'
        ? row.notes.trim() || null
        : row.notes === null
          ? null
          : undefined
    out.push({
      date,
      visits: Math.round(visits),
      ...(notes !== undefined ? { notes } : {}),
    })
  }
  return out
}

/** GET — lista visitas manuais dos últimos N dias. */
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
    const days = parseDays(searchParams.get('days'))

    const start = new Date()
    start.setDate(start.getDate() - days)
    const startKey = start.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('instagram_profile_visits_manual')
      .select('visit_date, visits, notes')
      .eq('user_id', user.id)
      .gte('visit_date', startKey)
      .order('visit_date', { ascending: true })

    if (error) {
      console.error('Erro ao buscar visitas manuais:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const visits = (data ?? []).map((row) => ({
      date: row.visit_date as string,
      visits: Number(row.visits) || 0,
      notes: (row.notes as string | null) ?? null,
    }))

    return NextResponse.json({ visits })
  } catch (error) {
    console.error('Erro ao buscar visitas manuais:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}

/** PUT — upsert de uma ou mais datas (lançamento manual). */
export async function PUT(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as { entries?: unknown }
    const entries = normalizeEntries(body.entries)
    if (!entries || entries.length === 0) {
      return NextResponse.json(
        { error: 'Informe ao menos uma entrada { date, visits }' },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()
    const rows = entries.map((entry) => ({
      user_id: user.id,
      visit_date: entry.date,
      visits: entry.visits,
      ...(entry.notes !== undefined ? { notes: entry.notes } : {}),
      updated_at: now,
    }))

    const { data, error } = await supabase
      .from('instagram_profile_visits_manual')
      .upsert(rows, { onConflict: 'user_id,visit_date' })
      .select('visit_date, visits, notes')

    if (error) {
      console.error('Erro ao salvar visitas manuais:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      visits: (data ?? []).map((row) => ({
        date: row.visit_date as string,
        visits: Number(row.visits) || 0,
        notes: (row.notes as string | null) ?? null,
      })),
    })
  } catch (error) {
    console.error('Erro ao salvar visitas manuais:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
