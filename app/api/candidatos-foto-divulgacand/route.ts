import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  municipioChaveFoto,
  validarUrlHttp,
  type CargoFotoCandidato,
} from '@/lib/candidatos-foto-divulgacand'
import {
  formatarNomeMunicipioLista,
  normalizeMunicipioNome,
} from '@/lib/fns-municipio-normalize'

export const dynamic = 'force-dynamic'

const CARGOS: CargoFotoCandidato[] = ['prefeito', 'vereador']

function parseCargo(v: string | null): CargoFotoCandidato | null {
  const c = (v ?? '').trim().toLowerCase()
  return CARGOS.includes(c as CargoFotoCandidato) ? (c as CargoFotoCandidato) : null
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
    if (!municipio) {
      return NextResponse.json({ error: 'Município é obrigatório' }, { status: 400 })
    }

    const cargo = parseCargo(request.nextUrl.searchParams.get('cargo'))
    const ano = parseInt(request.nextUrl.searchParams.get('ano') || '2024', 10)
    const chave = municipioChaveFoto(municipio)

    let q = supabase
      .from('candidatos_foto_divulgacand')
      .select('*')
      .eq('municipio_chave', chave)
      .eq('ano_eleicao', ano)

    if (cargo) q = q.eq('cargo', cargo)

    const { data, error } = await q.order('nome_urna', { ascending: true })
    if (error) {
      console.error('candidatos-foto GET:', error)
      return NextResponse.json({ error: 'Erro ao listar fotos' }, { status: 500 })
    }

    return NextResponse.json({ fotos: data ?? [] })
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
    const municipio = String(body.municipio ?? '').trim()
    const cargo = parseCargo(String(body.cargo ?? ''))
    const numero_urna = String(body.numero_urna ?? '').trim()
    const nome_urna = String(body.nome_urna ?? '').trim()
    const url_imagem = String(body.url_imagem ?? '').trim()
    const url_divulgacand =
      body.url_divulgacand != null ? String(body.url_divulgacand).trim() || null : null
    const ano_eleicao = parseInt(String(body.ano_eleicao ?? '2024'), 10)

    if (!municipio || !cargo || !numero_urna || !nome_urna) {
      return NextResponse.json({ error: 'Dados do candidato incompletos' }, { status: 400 })
    }
    if (!url_imagem || !validarUrlHttp(url_imagem)) {
      return NextResponse.json({ error: 'URL da imagem inválida' }, { status: 400 })
    }
    if (url_divulgacand && !validarUrlHttp(url_divulgacand)) {
      return NextResponse.json({ error: 'URL do DivulgaCand inválida' }, { status: 400 })
    }

    const row = {
      municipio_chave: municipioChaveFoto(municipio),
      municipio_nome: formatarNomeMunicipioLista(municipio),
      cargo,
      ano_eleicao,
      numero_urna,
      nome_urna: normalizeMunicipioNome(nome_urna),
      url_imagem,
      url_divulgacand,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('candidatos_foto_divulgacand')
      .upsert(row, { onConflict: 'municipio_chave,cargo,ano_eleicao,numero_urna,nome_urna' })
      .select()
      .single()

    if (error) {
      console.error('candidatos-foto PUT:', error)
      return NextResponse.json({ error: 'Erro ao salvar foto' }, { status: 500 })
    }

    return NextResponse.json({ foto: data })
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

    const { error } = await supabase.from('candidatos_foto_divulgacand').delete().eq('id', id)
    if (error) {
      console.error('candidatos-foto DELETE:', error)
      return NextResponse.json({ error: 'Erro ao remover foto' }, { status: 500 })
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
