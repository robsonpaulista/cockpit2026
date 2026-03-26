import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveSurveyLists } from '@/lib/field-survey-default-lists'
import { parseStoredConfig, listsFromStored } from '@/lib/field-survey-config-schema'

export const dynamic = 'force-dynamic'

async function requirePesquisadorUser() {
  const supabase = createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'pesquisadores') {
    return { error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
  }
  return { supabase, user }
}

export async function GET() {
  const ctx = await requirePesquisadorUser()
  if ('error' in ctx) return ctx.error
  const { supabase } = ctx

  const { data: row } = await supabase
    .from('field_survey_settings')
    .select('config')
    .eq('id', 'default')
    .maybeSingle()

  const stored = parseStoredConfig(row?.config)
  const lists = resolveSurveyLists(listsFromStored(stored))

  return NextResponse.json({
    version: 1,
    lists,
    questionOrder: stored.questionOrder?.length ? stored.questionOrder : undefined,
    disabledQuestionIds: stored.disabledQuestionIds?.length ? stored.disabledQuestionIds : undefined,
  })
}
