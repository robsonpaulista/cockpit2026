import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const bodySchema = z.object({
  plataforma: z.string().min(1),
  link: z.string().min(1),
  data_coleta: z.string().optional(),
  views: z.number().int().optional(),
  likes: z.number().int().optional(),
  comentarios: z.number().int().optional(),
  compartilhamentos: z.number().int().optional(),
  observacoes: z.string().optional(),
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const json = await request.json()
    const body = bodySchema.parse(json)

    const { data: row, error: fErr } = await supabase
      .from('conteudos_planejados')
      .select('id, imagem_url, status')
      .eq('id', params.id)
      .single()

    if (fErr || !row) {
      return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
    }

    if (!row.imagem_url) {
      return NextResponse.json({ error: 'Card precisa estar aprovado antes de publicar.' }, { status: 400 })
    }

    const hoje = new Date().toISOString().slice(0, 10)
    const dataColeta = body.data_coleta?.slice(0, 10) || hoje

    const { error: iErr } = await supabase.from('publicacoes_conteudo').insert({
      conteudo_id: params.id,
      plataforma: body.plataforma,
      link: body.link,
      data_coleta: dataColeta,
      views: body.views ?? null,
      likes: body.likes ?? null,
      comentarios: body.comentarios ?? null,
      compartilhamentos: body.compartilhamentos ?? null,
      observacoes: body.observacoes ?? null,
    })

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 500 })
    }

    const { error: uErr } = await supabase
      .from('conteudos_planejados')
      .update({ status: 'publicado' })
      .eq('id', params.id)

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: e.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
