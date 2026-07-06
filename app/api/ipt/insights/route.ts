import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildOverrideMapFromInsights,
  createIptInsightSchema,
  resolveAcaoAvaliacao,
  type IptMunicipioInsightRow,
} from '@/lib/ipt-insights'
import { normalizeIptMunicipio } from '@/lib/ipt'

export const dynamic = 'force-dynamic'

const SELECT_WITH_PROFILE = `
  id,
  municipio,
  municipio_normalizado,
  indicador,
  body,
  altera_avaliacao,
  sinal_override,
  restaurar_automatico,
  sinal_visitas_calculado,
  sinal_obras_calculado,
  sinal_pesquisa_calculado,
  prioridade_calculada,
  created_by,
  created_at,
  profiles:created_by ( name, email )
`

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const mode = request.nextUrl.searchParams.get('mode')
    const municipio = request.nextUrl.searchParams.get('municipio')?.trim()

    if (mode === 'overrides') {
      const { data, error } = await supabase
        .from('ipt_municipio_insights')
        .select(SELECT_WITH_PROFILE)
        .eq('altera_avaliacao', true)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('ipt insights overrides GET:', error)
        return NextResponse.json({ error: 'Erro ao carregar overrides IPT' }, { status: 500 })
      }

      const rows = (data ?? []) as unknown as IptMunicipioInsightRow[]
      const overrides = buildOverrideMapFromInsights(rows)
      const serialized: Record<string, Partial<Record<string, string>>> = {}
      for (const [key, patch] of overrides.entries()) {
        serialized[key] = patch
      }
      return NextResponse.json({ overrides: serialized })
    }

    let q = supabase
      .from('ipt_municipio_insights')
      .select(SELECT_WITH_PROFILE)
      .order('created_at', { ascending: false })
      .limit(municipio ? 50 : 200)

    if (municipio) {
      q = q.eq('municipio_normalizado', normalizeIptMunicipio(municipio))
    }

    const { data, error } = await q
    if (error) {
      console.error('ipt insights GET:', error)
      return NextResponse.json({ error: 'Erro ao listar insights IPT' }, { status: 500 })
    }

    return NextResponse.json({ insights: data ?? [] })
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

    const body = await request.json()
    const parsed = createIptInsightSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
        { status: 400 }
      )
    }

    const input = parsed.data
    const acao = resolveAcaoAvaliacao(input)
    const municipio = input.municipio.trim()

    const row = {
      municipio,
      municipio_normalizado: normalizeIptMunicipio(municipio),
      indicador: input.indicador,
      body: input.body.trim(),
      altera_avaliacao: acao.altera_avaliacao,
      sinal_override: acao.sinal_override,
      restaurar_automatico: acao.restaurar_automatico,
      sinal_visitas_calculado: input.sinal_visitas_calculado ?? null,
      sinal_obras_calculado: input.sinal_obras_calculado ?? null,
      sinal_pesquisa_calculado: input.sinal_pesquisa_calculado ?? null,
      prioridade_calculada: input.prioridade_calculada ?? null,
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('ipt_municipio_insights')
      .insert(row)
      .select(SELECT_WITH_PROFILE)
      .single()

    if (error) {
      console.error('ipt insights POST:', error)
      return NextResponse.json({ error: 'Erro ao salvar insight IPT' }, { status: 500 })
    }

    return NextResponse.json({ insight: data })
  } catch (e: unknown) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
