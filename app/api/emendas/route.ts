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

function rowFromBody(body: Record<string, unknown>) {
  return {
    bloco: body.bloco != null ? String(body.bloco).trim() || null : null,
    exercicio: parseExercicio(body.exercicio),
    emenda: String(body.emenda ?? '').trim(),
    municipio_beneficiario:
      body.municipio_beneficiario != null ? String(body.municipio_beneficiario).trim() || null : null,
    funcional: body.funcional != null ? String(body.funcional).trim() || null : null,
    gnd: body.gnd != null ? String(body.gnd).trim() || null : null,
    valor_indicado: parseNum(body.valor_indicado),
    valor_empenhado: parseNum(body.valor_empenhado),
    valor_a_empenhar: parseNum(body.valor_a_empenhar),
    valor_pago: parseNum(body.valor_pago),
    valor_a_ser_pago: parseNum(body.valor_a_ser_pago),
    empenho: body.empenho != null ? String(body.empenho).trim() || null : null,
    data_empenho: parseDate(body.data_empenho),
    portaria_convenio: body.portaria_convenio != null ? String(body.portaria_convenio).trim() || null : null,
    numero_proposta: body.numero_proposta != null ? String(body.numero_proposta).trim() || null : null,
    data_pagamento: parseDate(body.data_pagamento ?? body.pagamento),
    liderancas: body.liderancas != null ? String(body.liderancas).trim() || null : null,
    alteracao: body.alteracao != null ? String(body.alteracao).trim() || null : null,
    objeto: body.objeto != null ? String(body.objeto).trim() || null : null,
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('emendas')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('emendas GET:', error)
      return NextResponse.json({ error: 'Erro ao listar emendas' }, { status: 500 })
    }

    return NextResponse.json({ emendas: data ?? [] })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
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

    const body = (await request.json()) as Record<string, unknown>
    const row = rowFromBody(body)
    if (!row.emenda) {
      return NextResponse.json({ error: 'Campo Emenda é obrigatório' }, { status: 400 })
    }

    const { data, error } = await supabase.from('emendas').insert(row).select().single()
    if (error) {
      console.error('emendas POST:', error)
      return NextResponse.json({ error: 'Erro ao criar emenda' }, { status: 500 })
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
