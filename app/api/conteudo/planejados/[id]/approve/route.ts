import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const id = params.id

    const { data: row, error } = await supabase
      .from('conteudos_planejados')
      .select('id, storage_path_rascunho, formato, status')
      .eq('id', id)
      .single()

    if (error || !row) {
      return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
    }

    if (!row.storage_path_rascunho) {
      return NextResponse.json({ error: 'Nenhuma imagem gerada para este conteúdo.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const src = row.storage_path_rascunho as string
    const fileName = src.split('/').pop() || `${id}.png`
    const formatoRaw = (row.formato as string | null) || 'geral'
    const folder = formatoRaw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'geral'
    const destPath = `${folder}/${fileName}`

    const { data: blob, error: dErr } = await admin.storage.from('rascunhos').download(src)
    if (dErr || !blob) {
      return NextResponse.json({ error: 'Não foi possível ler o arquivo em rascunhos.' }, { status: 500 })
    }

    const buf = Buffer.from(await blob.arrayBuffer())

    const { error: upErr } = await admin.storage.from('aprovados').upload(destPath, buf, {
      contentType: 'image/png',
      upsert: true,
    })
    if (upErr) {
      return NextResponse.json({ error: 'Erro ao copiar para aprovados.' }, { status: 500 })
    }

    await admin.storage.from('rascunhos').remove([src])

    const { data: pub } = admin.storage.from('aprovados').getPublicUrl(destPath)
    const imagemUrl = pub.publicUrl

    const { error: uErr } = await supabase
      .from('conteudos_planejados')
      .update({
        imagem_url: imagemUrl,
        storage_path: destPath,
        storage_path_rascunho: null,
        status: 'aprovado',
      })
      .eq('id', id)

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 })
    }

    return NextResponse.json({ imagemUrl, storagePath: destPath })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
