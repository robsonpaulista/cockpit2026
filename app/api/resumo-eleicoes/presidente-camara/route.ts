import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const schema = z.object({
  cidade: z.string().min(1),
  vereadorNome: z.string().min(1),
})

function normalizeCity(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
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

    const cidade = request.nextUrl.searchParams.get('cidade')
    if (!cidade) {
      return NextResponse.json({ error: 'Cidade é obrigatória' }, { status: 400 })
    }

    const municipioNormalizado = normalizeCity(cidade)

    const { data, error } = await supabase
      .from('resumo_eleicoes_presidentes')
      .select('vereador_nome')
      .eq('municipio_normalizado', municipioNormalizado)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      presidente: data?.vereador_nome || null,
    })
  } catch (error) {
    console.error('Erro ao buscar presidente da câmara:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = schema.parse(body)
    const municipioNormalizado = normalizeCity(parsed.cidade)

    const { data, error } = await supabase
      .from('resumo_eleicoes_presidentes')
      .upsert(
        {
          municipio: parsed.cidade,
          municipio_normalizado: municipioNormalizado,
          vereador_nome: parsed.vereadorNome,
          created_by: user.id,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'municipio_normalizado',
        }
      )
      .select('vereador_nome')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      presidente: data.vereador_nome,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
    }
    console.error('Erro ao salvar presidente da câmara:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
