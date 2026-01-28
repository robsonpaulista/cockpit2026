import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar configuração do banco de dados
    const { data, error } = await supabase
      .from('google_calendar_config')
      .select('calendar_id, service_account_email, credentials, subject_user')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found
      console.error('Erro ao buscar configuração:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar configuração' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json({ config: null })
    }

    return NextResponse.json({
      config: {
        calendarId: data.calendar_id,
        serviceAccountEmail: data.service_account_email,
        credentials: data.credentials,
        subjectUser: data.subject_user,
      },
    })
  } catch (error: unknown) {
    console.error('Erro ao buscar configuração:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
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
    const { calendarId, serviceAccountEmail, credentials, subjectUser } = body

    if (!calendarId || !serviceAccountEmail || !credentials) {
      return NextResponse.json(
        { error: 'calendarId, serviceAccountEmail e credentials são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se já existe configuração
    const { data: existing } = await supabase
      .from('google_calendar_config')
      .select('id')
      .limit(1)
      .single()

    if (existing) {
      // Atualizar configuração existente
      const { data, error } = await supabase
        .from('google_calendar_config')
        .update({
          calendar_id: calendarId,
          service_account_email: serviceAccountEmail,
          credentials: credentials,
          subject_user: subjectUser || null,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Erro ao atualizar configuração:', error)
        return NextResponse.json(
          { error: 'Erro ao atualizar configuração' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        config: {
          calendarId: data.calendar_id,
          serviceAccountEmail: data.service_account_email,
          credentials: data.credentials,
          subjectUser: data.subject_user,
        },
      })
    } else {
      // Criar nova configuração
      const { data, error } = await supabase
        .from('google_calendar_config')
        .insert({
          calendar_id: calendarId,
          service_account_email: serviceAccountEmail,
          credentials: credentials,
          subject_user: subjectUser || null,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single()

      if (error) {
        console.error('Erro ao criar configuração:', error)
        return NextResponse.json(
          { error: 'Erro ao salvar configuração' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        config: {
          calendarId: data.calendar_id,
          serviceAccountEmail: data.service_account_email,
          credentials: data.credentials,
          subjectUser: data.subject_user,
        },
      })
    }
  } catch (error: unknown) {
    console.error('Erro ao salvar configuração:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
