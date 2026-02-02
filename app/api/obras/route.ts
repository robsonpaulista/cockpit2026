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
    const municipio = searchParams.get('municipio')
    const status = searchParams.get('status')
    const statusMedicao = searchParams.get('status_medicao')
    const orgao = searchParams.get('orgao')
    const tipo = searchParams.get('tipo')

    let query = supabase.from('obras').select('*').order('created_at', { ascending: false })

    if (municipio) {
      query = query.eq('municipio', municipio)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (statusMedicao) {
      query = query.eq('status_medicao', statusMedicao)
    }
    if (orgao) {
      query = query.eq('orgao', orgao)
    }
    if (tipo) {
      query = query.eq('tipo', tipo)
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
      municipio,
      obra,
      orgao,
      tipo,
      sei,
      sei_medicao,
      status,
      publicacao_os,
      solicitacao_medicao,
      data_medicao,
      status_medicao,
      valor_total,
    } = body

    if (!obra) {
      return NextResponse.json(
        { error: 'Nome da obra é obrigatório' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('obras')
      .insert({
        municipio: municipio || null,
        obra: obra,
        orgao: orgao || null,
        tipo: tipo || null,
        sei: sei || null,
        sei_medicao: sei_medicao || null,
        status: status || null,
        publicacao_os: publicacao_os || null,
        solicitacao_medicao: solicitacao_medicao || null,
        data_medicao: data_medicao || null,
        status_medicao: status_medicao || null,
        valor_total: valor_total || null,
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
