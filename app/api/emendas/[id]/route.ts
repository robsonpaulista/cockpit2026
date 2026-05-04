import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  const s = String(v).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function parseExercicio(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? Math.trunc(v) : Math.trunc(Number(String(v).trim()))
  if (!Number.isFinite(n) || n < 1900 || n > 2100) return null
  return n
}

function patchFromBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  const keys = [
    'bloco',
    'exercicio',
    'emenda',
    'municipio_beneficiario',
    'funcional',
    'gnd',
    'valor_indicado',
    'valor_empenhado',
    'valor_a_empenhar',
    'valor_pago',
    'valor_a_ser_pago',
    'empenho',
    'data_empenho',
    'portaria_convenio',
    'numero_proposta',
    'data_pagamento',
    'liderancas',
    'alteracao',
    'objeto',
  ] as const
  for (const k of keys) {
    if (!(k in body)) continue
    if (k.startsWith('valor_')) {
      out[k] = parseNum(body[k])
      continue
    }
    if (k === 'data_empenho' || k === 'data_pagamento') {
      out[k] = k === 'data_pagamento' ? parseDate(body.data_pagamento ?? body.pagamento) : parseDate(body[k])
      continue
    }
    if (k === 'exercicio') {
      out[k] = parseExercicio(body[k])
      continue
    }
    const v = body[k]
    if (v === null || v === undefined) {
      out[k] = null
      continue
    }
    out[k] = String(v).trim() || null
  }
  return out
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase.from('emendas').select('*').eq('id', id).maybeSingle()
    if (error) {
      console.error('emendas GET id:', error)
      return NextResponse.json({ error: 'Erro ao buscar emenda' }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ error: 'Não encontrada' }, { status: 404 })
    }
    return NextResponse.json({ emenda: data })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const patch = patchFromBody(body)
    if ('emenda' in patch && (patch.emenda === null || patch.emenda === '')) {
      return NextResponse.json({ error: 'Campo Emenda é obrigatório' }, { status: 400 })
    }

    const { data, error } = await supabase.from('emendas').update(patch).eq('id', id).select().single()
    if (error) {
      console.error('emendas PATCH:', error)
      return NextResponse.json({ error: 'Erro ao atualizar emenda' }, { status: 500 })
    }
    return NextResponse.json({ emenda: data })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { error } = await supabase.from('emendas').delete().eq('id', id)
    if (error) {
      console.error('emendas DELETE:', error)
      return NextResponse.json({ error: 'Erro ao excluir emenda' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
