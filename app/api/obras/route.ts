import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
    const cidade = searchParams.get('cidade')
    const estado = searchParams.get('estado')
    const status = searchParams.get('status')
    const tipo = searchParams.get('tipo')

    let query = supabase.from('obras').select('*').order('created_at', { ascending: false })

    if (cidade) {
      query = query.eq('cidade', cidade)
    }
    if (estado) {
      query = query.eq('estado', estado)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (tipo) {
      query = query.eq('tipo_obra', tipo)
    }

    const { data, error } = await query

    if (error) {
      console.error('Erro ao buscar obras:', error)
      return NextResponse.json(
        { error: 'Erro ao buscar obras' },
        { status: 500 }
      )
    }

    return NextResponse.json({ obras: data || [] })
  } catch (error: unknown) {
    console.error('Erro ao buscar obras:', error)
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
    const {
      nome_obra,
      localizacao,
      cidade,
      estado,
      tipo_obra,
      status,
      data_inicio,
      data_prevista_conclusao,
      data_conclusao,
      valor_orcado,
      valor_executado,
      percentual_execucao,
      responsavel,
      observacoes,
    } = body

    if (!nome_obra) {
      return NextResponse.json(
        { error: 'Nome da obra é obrigatório' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('obras')
      .insert({
        nome_obra,
        localizacao: localizacao || null,
        cidade: cidade || null,
        estado: estado || null,
        tipo_obra: tipo_obra || null,
        status: status || null,
        data_inicio: data_inicio || null,
        data_prevista_conclusao: data_prevista_conclusao || null,
        data_conclusao: data_conclusao || null,
        valor_orcado: valor_orcado || null,
        valor_executado: valor_executado || null,
        percentual_execucao: percentual_execucao || null,
        responsavel: responsavel || null,
        observacoes: observacoes || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar obra:', error)
      return NextResponse.json(
        { error: 'Erro ao criar obra' },
        { status: 500 }
      )
    }

    return NextResponse.json({ obra: data })
  } catch (error: unknown) {
    console.error('Erro ao criar obra:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
