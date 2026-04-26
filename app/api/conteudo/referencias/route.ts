import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const uploadMetaSchema = z.object({
  tema: z.enum(['pavimentacao', 'turismo', 'saude', 'educacao', 'saneamento', 'iluminacao', 'geral']),
  formato: z.enum(['feed', 'story', 'reels_capa']),
  engajamento: z.enum(['alto', 'medio', 'baixo']),
  origem: z.enum(['instagram', 'criado_no_cockpit']),
  observacoes: z.string().optional(),
})

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_').slice(0, 180) || 'referencia'
}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const tema = searchParams.get('tema')
    const formato = searchParams.get('formato')
    const engajamento = searchParams.get('engajamento')
    const ativa = searchParams.get('ativa')

    let query = supabase.from('referencias_visuais').select('*').order('created_at', { ascending: false })
    if (tema) query = query.eq('tema', tema)
    if (formato) query = query.eq('formato', formato)
    if (engajamento) query = query.eq('engajamento', engajamento)
    if (ativa === 'true' || ativa === 'false') query = query.eq('ativa', ativa === 'true')

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data: usos } = await supabase
      .from('conteudos_planejados')
      .select('referencia_id')
      .not('referencia_id', 'is', null)

    const usageMap: Record<string, number> = {}
    for (const u of usos ?? []) {
      const rid = u.referencia_id as string
      usageMap[rid] = (usageMap[rid] ?? 0) + 1
    }

    const rows = (data ?? []).map((r) => ({
      ...r,
      uso_em_cards: usageMap[r.id as string] ?? 0,
    }))

    return NextResponse.json(rows)
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
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

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo ausente ou inválido' }, { status: 400 })
    }

    const meta = uploadMetaSchema.parse({
      tema: String(formData.get('tema') ?? ''),
      formato: String(formData.get('formato') ?? ''),
      engajamento: String(formData.get('engajamento') ?? ''),
      origem: String(formData.get('origem') ?? ''),
      observacoes: formData.get('observacoes') ? String(formData.get('observacoes')) : undefined,
    })

    const fileName = `${Date.now()}-${sanitizeFileName(file.name)}`
    const storagePath = `${meta.formato}/${fileName}`

    const buf = Buffer.from(await file.arrayBuffer())
    const contentType = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'

    const admin = createAdminClient()
    const { error: upErr } = await admin.storage.from('referencias').upload(storagePath, buf, {
      contentType,
      upsert: false,
    })

    if (upErr) {
      return NextResponse.json(
        { error: `Storage: ${upErr.message}`, code: upErr.name },
        { status: 400 }
      )
    }

    const { data: publicUrlData } = admin.storage.from('referencias').getPublicUrl(storagePath)

    const { data: row, error: insErr } = await admin
      .from('referencias_visuais')
      .insert({
        imagem_url: publicUrlData.publicUrl,
        storage_path: storagePath,
        tema: meta.tema,
        formato: meta.formato,
        engajamento: meta.engajamento,
        origem: meta.origem,
        observacoes: meta.observacoes ?? null,
      })
      .select()
      .single()

    if (insErr) {
      await admin.storage.from('referencias').remove([storagePath]).catch(() => undefined)
      return NextResponse.json({ error: `Banco: ${insErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ ...row, uso_em_cards: 0 }, { status: 201 })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Metadados inválidos', details: e.errors }, { status: 400 })
    }
    console.error(e)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
