import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureGestaoPesquisasAccess } from '@/lib/auth-gestao-pesquisas'
import { fieldSurveyStoredConfigSchema, parseStoredConfig } from '@/lib/field-survey-config-schema'
import { DEFAULT_FIELD_SURVEY_QUESTION_ORDER } from '@/lib/field-survey-question-catalog'

export const dynamic = 'force-dynamic'

const SETTINGS_ID = 'default'

async function loadConfigRow(): Promise<FieldSurveyStoredConfig> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('field_survey_settings')
    .select('config')
    .eq('id', SETTINGS_ID)
    .maybeSingle()

  if (error || !data?.config) {
    return {}
  }
  return parseStoredConfig(data.config)
}

export async function GET() {
  const supabase = createClient()
  const gate = await ensureGestaoPesquisasAccess(supabase)
  if (gate instanceof NextResponse) return gate

  const config = await loadConfigRow()
  return NextResponse.json({
    config,
    defaultQuestionOrder: DEFAULT_FIELD_SURVEY_QUESTION_ORDER,
  })
}

export async function PUT(request: Request) {
  const supabase = createClient()
  const gate = await ensureGestaoPesquisasAccess(supabase)
  if (gate instanceof NextResponse) return gate

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = fieldSurveyStoredConfigSchema.safeParse(
    body && typeof body === 'object' && 'config' in body
      ? (body as { config: unknown }).config
      : body
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Config inválida', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const admin = createAdminClient()
    const { error } = await admin.from('field_survey_settings').upsert(
      {
        id: SETTINGS_ID,
        config: parsed.data as Record<string, unknown>,
        updated_at: new Date().toISOString(),
        updated_by: gate.profile.id,
      },
      { onConflict: 'id' }
    )

    if (error) {
      console.error('[field-survey-settings] upsert', error)
      return NextResponse.json({ error: 'Erro ao salvar no banco' }, { status: 500 })
    }
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Service role não configurada' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
