import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildPeriodoResumo,
  buildResumoOperacional,
  type InstagramCredentials,
} from '@/lib/resumo-operacional'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function parseInstagramFromBody(body: unknown): InstagramCredentials | null {
  if (!body || typeof body !== 'object') return null
  const b = body as { token?: unknown; businessAccountId?: unknown }
  const token = typeof b.token === 'string' ? b.token.trim() : ''
  const businessAccountId =
    typeof b.businessAccountId === 'string' ? b.businessAccountId.trim() : ''
  if (!token || !businessAccountId) return null
  return { token, businessAccountId }
}

async function handleResumo(
  request: Request,
  daysParam: number,
  instagramFromBody: InstagramCredentials | null
) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const periodo = buildPeriodoResumo(daysParam)
  const admin = createAdminClient()
  const resumo = await buildResumoOperacional(
    admin,
    supabase,
    periodo,
    user.id,
    instagramFromBody
  )

  return NextResponse.json(resumo)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const daysParam = parseInt(searchParams.get('days') ?? '7', 10)
    return await handleResumo(request, daysParam, null)
  } catch (error) {
    console.error('[resumo-operacional]', error)
    return NextResponse.json({ error: 'Erro ao gerar resumo operacional' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const body = await request.json().catch(() => ({}))
    const daysFromBody =
      typeof (body as { days?: unknown }).days === 'number'
        ? (body as { days: number }).days
        : parseInt(searchParams.get('days') ?? '7', 10)
    const instagram = parseInstagramFromBody(body)
    return await handleResumo(request, daysFromBody, instagram)
  } catch (error) {
    console.error('[resumo-operacional]', error)
    return NextResponse.json({ error: 'Erro ao gerar resumo operacional' }, { status: 500 })
  }
}
