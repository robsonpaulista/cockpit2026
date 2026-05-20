import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const municipio = request.nextUrl.searchParams.get('municipio')?.trim()
    let q = supabase.from('emendas_suas').select('*').order('updated_at', { ascending: false })

    if (municipio) {
      q = q.eq('municipio', municipio)
    }

    const { data, error } = await q
    if (error) {
      console.error('emendas-suas GET:', error)
      return NextResponse.json({ error: 'Erro ao listar emendas SUAS' }, { status: 500 })
    }

    return NextResponse.json({ emendas: data ?? [] })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 },
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

    const body = (await request.json()) as Record<string, unknown>
    const municipio = String(body.municipio ?? '').trim()
    if (!municipio) {
      return NextResponse.json({ error: 'Município é obrigatório' }, { status: 400 })
    }

    const row = {
      municipio,
      tipo_proposta: String(body.tipo_proposta ?? 'INCREMENTO SUAS').trim(),
      tipo_recurso: String(body.tipo_recurso ?? 'EMENDA/PROJETO').trim(),
      valor_proposta: parseNum(body.valor_proposta),
      valor_pagar: parseNum(body.valor_pagar),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from('emendas_suas').insert(row).select().single()
    if (error) {
      console.error('emendas-suas POST:', error)
      return NextResponse.json({ error: 'Erro ao criar emenda SUAS' }, { status: 500 })
    }

    return NextResponse.json({ emenda: data })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 },
    )
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const id = String(body.id ?? '').trim()
    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const row = {
      municipio: String(body.municipio ?? '').trim(),
      tipo_proposta: String(body.tipo_proposta ?? 'INCREMENTO SUAS').trim(),
      tipo_recurso: String(body.tipo_recurso ?? 'EMENDA/PROJETO').trim(),
      valor_proposta: parseNum(body.valor_proposta),
      valor_pagar: parseNum(body.valor_pagar),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase.from('emendas_suas').update(row).eq('id', id).select().single()
    if (error) {
      console.error('emendas-suas PUT:', error)
      return NextResponse.json({ error: 'Erro ao atualizar emenda SUAS' }, { status: 500 })
    }

    return NextResponse.json({ emenda: data })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const id = request.nextUrl.searchParams.get('id')?.trim()
    if (!id) {
      return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    }

    const { error } = await supabase.from('emendas_suas').delete().eq('id', id)
    if (error) {
      console.error('emendas-suas DELETE:', error)
      return NextResponse.json({ error: 'Erro ao remover emenda SUAS' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 },
    )
  }
}
