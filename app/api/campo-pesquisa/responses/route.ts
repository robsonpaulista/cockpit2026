import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  localClientId: z.string().min(8).max(128),
  answers: z.record(z.string(), z.unknown()).default({}),
  questionnaireVersion: z.string().max(64).optional(),
  completedAt: z
    .string()
    .optional()
    .refine((s) => s === undefined || !Number.isNaN(Date.parse(s)), 'completedAt inválido'),
})

async function requirePesquisadorUser() {
  const supabase = createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }
  const { data: profile, error: pe } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (pe || !profile) {
    return { error: NextResponse.json({ error: 'Perfil não encontrado' }, { status: 403 }) }
  }
  if (profile.role !== 'pesquisadores') {
    return { error: NextResponse.json({ error: 'Acesso exclusivo para pesquisadores' }, { status: 403 }) }
  }
  return { supabase, user, profile }
}

export async function GET() {
  const ctx = await requirePesquisadorUser()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx

  const { data, error } = await supabase
    .from('field_survey_responses')
    .select('id, local_client_id, completed_at, created_at')
    .eq('interviewer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[field_survey] GET', error)
    return NextResponse.json({ error: 'Erro ao listar respostas' }, { status: 500 })
  }
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(request: Request) {
  const ctx = await requirePesquisadorUser()
  if ('error' in ctx) return ctx.error
  const { supabase, user } = ctx

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { localClientId, answers, questionnaireVersion, completedAt } = parsed.data

  const { data, error } = await supabase
    .from('field_survey_responses')
    .insert({
      interviewer_id: user.id,
      local_client_id: localClientId,
      answers: answers as Record<string, unknown>,
      questionnaire_version: questionnaireVersion ?? 'pi2026_premium_v1',
      completed_at: completedAt ?? new Date().toISOString(),
    })
    .select('id, local_client_id, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'duplicate', message: 'Entrevista já sincronizada (id local duplicado).' },
        { status: 409 }
      )
    }
    console.error('[field_survey] POST', error)
    return NextResponse.json({ error: 'Erro ao salvar entrevista' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, record: data })
}
