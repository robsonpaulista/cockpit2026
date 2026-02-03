import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID da obra é obrigatório' }, { status: 400 })
    }

    const body = await request.json()
    const {
      municipio,
      obra,
      orgao,
      tipo,
      sei,
      sei_medicao,
      sei_url,
      sei_ultimo_andamento,
      sei_ultimo_andamento_data,
      sei_alerta_andamento_desatualizado,
      status,
      publicacao_os,
      solicitacao_medicao,
      data_medicao,
      status_medicao,
      valor_total,
    } = body

    const updates: Record<string, unknown> = {}
    if (municipio !== undefined) updates.municipio = municipio ?? null
    if (obra !== undefined) updates.obra = obra ?? null
    if (orgao !== undefined) updates.orgao = orgao ?? null
    if (tipo !== undefined) updates.tipo = tipo ?? null
    if (sei !== undefined) updates.sei = sei ?? null
    if (sei_medicao !== undefined) updates.sei_medicao = sei_medicao ?? null
    if (sei_url !== undefined) updates.sei_url = sei_url ?? null
    if (sei_ultimo_andamento !== undefined) updates.sei_ultimo_andamento = sei_ultimo_andamento ?? null
    if (sei_ultimo_andamento_data !== undefined) updates.sei_ultimo_andamento_data = sei_ultimo_andamento_data ?? null
    if (sei_alerta_andamento_desatualizado !== undefined) updates.sei_alerta_andamento_desatualizado = Boolean(sei_alerta_andamento_desatualizado)
    if (status !== undefined) updates.status = status ?? null
    if (publicacao_os !== undefined) updates.publicacao_os = publicacao_os || null
    if (solicitacao_medicao !== undefined) updates.solicitacao_medicao = solicitacao_medicao || null
    if (data_medicao !== undefined) updates.data_medicao = data_medicao || null
    if (status_medicao !== undefined) updates.status_medicao = status_medicao ?? null
    if (valor_total !== undefined) updates.valor_total = valor_total ?? null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
    }
    if (updates.obra !== undefined && !String(updates.obra || '').trim()) {
      return NextResponse.json({ error: 'Nome da obra é obrigatório' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('obras')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Erro ao atualizar obra:', error)
      return NextResponse.json(
        { error: 'Erro ao atualizar obra' },
        { status: 500 }
      )
    }

    return NextResponse.json({ obra: data })
  } catch (error: unknown) {
    console.error('Erro ao atualizar obra:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'ID da obra é obrigatório' }, { status: 400 })
    }

    const { error } = await supabase.from('obras').delete().eq('id', id)

    if (error) {
      console.error('Erro ao excluir obra:', error)
      return NextResponse.json(
        { error: 'Erro ao excluir obra' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Erro ao excluir obra:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
