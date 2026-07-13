import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  normalizarMunicipioMeta,
  normalizarNomeVereadorMeta,
  sanitizarValoresMeta,
} from '@/lib/atendimento-meta-territorio'

export const dynamic = 'force-dynamic'

const postSchema = z.object({
  cidade: z.string().min(1),
  vereadorNome: z.string().min(1),
  vereadorNumero: z.union([z.string(), z.number()]).optional().default(''),
  anoEleicao: z.coerce.number().int().min(2000).max(2100).optional().default(2024),
  valores: z.record(z.string(), z.number().nullable()).or(z.record(z.string(), z.any())),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const cidade = request.nextUrl.searchParams.get('cidade')?.trim()
    const vereadorNome = request.nextUrl.searchParams.get('vereador')?.trim()
    const vereadorNumero = String(request.nextUrl.searchParams.get('numero') ?? '').trim()
    const anoRaw = request.nextUrl.searchParams.get('ano')
    const anoEleicao = anoRaw ? Number(anoRaw) : 2024

    if (!cidade || !vereadorNome) {
      return NextResponse.json({ error: 'cidade e vereador são obrigatórios' }, { status: 400 })
    }

    const municipioNormalizado = normalizarMunicipioMeta(cidade)
    const vereadorNomeNormalizado = normalizarNomeVereadorMeta(vereadorNome)

    const { data, error } = await supabase
      .from('atendimento_meta_territorio')
      .select('valores, vereador_nome, municipio, updated_at')
      .eq('municipio_normalizado', municipioNormalizado)
      .eq('vereador_nome_normalizado', vereadorNomeNormalizado)
      .eq('vereador_numero', vereadorNumero)
      .eq('ano_eleicao', Number.isFinite(anoEleicao) ? anoEleicao : 2024)
      .maybeSingle()

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({
          setupRequired: true,
          valores: {},
          message: 'Execute database/create-atendimento-meta-territorio.sql no Supabase.',
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      setupRequired: false,
      valores: sanitizarValoresMeta(data?.valores),
      vereadorNome: data?.vereador_nome ?? vereadorNome,
      municipio: data?.municipio ?? cidade,
      updatedAt: data?.updated_at ?? null,
    })
  } catch (error) {
    console.error('[meta-territorio GET]', error)
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

    const body = postSchema.parse(await request.json())
    const municipio = body.cidade.trim()
    const municipioNormalizado = normalizarMunicipioMeta(municipio)
    const vereadorNome = body.vereadorNome.trim()
    const vereadorNomeNormalizado = normalizarNomeVereadorMeta(vereadorNome)
    const vereadorNumero = String(body.vereadorNumero ?? '').trim()
    const anoEleicao = body.anoEleicao
    const valores = sanitizarValoresMeta(body.valores)

    const payload = {
      municipio,
      municipio_normalizado: municipioNormalizado,
      vereador_nome: vereadorNome,
      vereador_nome_normalizado: vereadorNomeNormalizado,
      vereador_numero: vereadorNumero,
      ano_eleicao: anoEleicao,
      valores,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('atendimento_meta_territorio')
      .upsert(payload, {
        onConflict: 'municipio_normalizado,vereador_nome_normalizado,vereador_numero,ano_eleicao',
      })
      .select('valores, updated_at, vereador_nome')
      .maybeSingle()

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json(
          {
            error: 'Tabela atendimento_meta_territorio ausente. Execute database/create-atendimento-meta-territorio.sql.',
            setupRequired: true,
          },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Garante created_by na primeira inserção (upsert nem sempre preenche)
    if (data && user.id) {
      await supabase
        .from('atendimento_meta_territorio')
        .update({ created_by: user.id })
        .eq('municipio_normalizado', municipioNormalizado)
        .eq('vereador_nome_normalizado', vereadorNomeNormalizado)
        .eq('vereador_numero', vereadorNumero)
        .eq('ano_eleicao', anoEleicao)
        .is('created_by', null)
    }

    return NextResponse.json({
      ok: true,
      valores: sanitizarValoresMeta(data?.valores ?? valores),
      vereadorNome: data?.vereador_nome ?? vereadorNome,
      updatedAt: data?.updated_at ?? payload.updated_at,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Payload inválido', details: error.flatten() }, { status: 400 })
    }
    console.error('[meta-territorio POST]', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
