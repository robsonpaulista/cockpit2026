import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import { ENGAJA_LEADERS, type EngajaLeaderRow } from '@/lib/arena/engaja-leaders'

export const dynamic = 'force-dynamic'

type LeaderDbRow = {
  id: string
  nome: string | null
  telefone: string | null
  email: string | null
  instagram: string | null
  cidade: string | null
  municipio: string | null
}

function normalizePhone(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '')
}

function normalizeHandle(raw: string | null | undefined): string {
  return String(raw ?? '').trim().replace(/^@/, '').toLowerCase()
}

function toResponseRow(l: EngajaLeaderRow, db: LeaderDbRow | null) {
  return {
    id: l.id,
    dbId: db?.id ?? null,
    name: db?.nome ? String(db.nome) : l.name,
    city: (db?.municipio || db?.cidade || l.city || null) as string | null,
    instagram: l.instagram,
    phone: normalizePhone(db?.telefone) || null,
    email: db?.email ?? null,
    afiliacaoUrl: l.afiliacaoUrl,
    lideradosCount: l.lideradosCount,
  }
}

/**
 * Lista lideranças da Arena — base estática (sem dados pessoais) + contato vindo de
 * `public.leaders`, cruzado pelo handle do Instagram.
 */
export async function GET() {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response

  const handles = ENGAJA_LEADERS.map((l) => normalizeHandle(l.instagram)).filter(Boolean)

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('leaders')
      .select('id, nome, telefone, email, instagram, cidade, municipio')
      .in('instagram', handles)

    if (error) {
      console.error('[api/arena/leaders]', error)
      return NextResponse.json({
        source: 'csv',
        leaders: ENGAJA_LEADERS.map((l) => toResponseRow(l, null)),
      })
    }

    const byHandle = new Map<string, LeaderDbRow>()
    for (const row of (data ?? []) as LeaderDbRow[]) {
      const handle = normalizeHandle(row.instagram)
      if (handle && !byHandle.has(handle)) byHandle.set(handle, row)
    }

    const leaders = ENGAJA_LEADERS.map((l) =>
      toResponseRow(l, byHandle.get(normalizeHandle(l.instagram)) ?? null),
    ).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

    return NextResponse.json({
      source: 'database',
      leaders,
      total: leaders.length,
    })
  } catch (e) {
    console.error('[api/arena/leaders]', e)
    return NextResponse.json({
      source: 'csv',
      leaders: ENGAJA_LEADERS.map((l) => toResponseRow(l, null)),
    })
  }
}
