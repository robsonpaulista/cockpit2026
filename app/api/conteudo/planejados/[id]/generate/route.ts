import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { generateCardText } from '@/lib/conteudo/groq'
import { renderCardPng } from '@/lib/conteudo/card-render'
import { fetchMelhorReferenciaServer } from '@/lib/referencias-server'
import { tryGenerateInspiredBackgroundUrl } from '@/lib/conteudo/openai-inspired-background'
import { fetchUnsplashImage } from '@/lib/unsplash'

export const dynamic = 'force-dynamic'

function normalizeTemaFromTipo(tipo: string | null | undefined): string {
  const t = (tipo || 'geral').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (t.includes('pav')) return 'pavimentacao'
  if (t.includes('tur')) return 'turismo'
  if (t.includes('sau')) return 'saude'
  if (t.includes('edu')) return 'educacao'
  if (t.includes('sane')) return 'saneamento'
  if (t.includes('ilumin')) return 'iluminacao'
  return 'geral'
}

function normalizeFormato(input: string | null | undefined): 'feed' | 'story' | 'reels_capa' {
  const f = (input || '').trim().toLowerCase()
  if (f === 'story') return 'story'
  if (f === 'reels_capa' || f === 'reels' || f === 'capa_reels') return 'reels_capa'
  return 'feed'
}

type ObraJoin = {
  obra: string | null
  municipio: string | null
  tipo: string | null
  status: string | null
  valor_total: number | null
  parceiro: string | null
  orgao: string | null
  imagem_url: string | null
} | null

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

    const { data: row, error: fErr } = await supabase
      .from('conteudos_planejados')
      .select(
        `
        *,
        obras ( obra, municipio, tipo, status, valor_total, parceiro, orgao, imagem_url )
      `
      )
      .eq('id', id)
      .single()

    if (fErr || !row) {
      return NextResponse.json({ error: 'Conteúdo não encontrado' }, { status: 404 })
    }

    const obra = row.obras as ObraJoin
    const cidade =
      (row.cidade as string | null)?.trim() ||
      obra?.municipio?.trim() ||
      'Município'
    const tipo = obra?.tipo?.trim() || 'obra pública'
    const statusObra = obra?.status?.trim() || '—'
    const template = (row.template as string) || 'obra_impacto'
    const fase = (row.fase as string) || '—'
    const valor = obra?.valor_total != null ? Number(obra.valor_total) : undefined
    const parceiro = obra?.parceiro?.trim() || obra?.orgao?.trim() || undefined
    const territorio = (row.territorio as string | null)?.trim() || obra?.municipio?.trim() || undefined

    const texts = await generateCardText({
      cidade,
      territorio,
      tipo,
      status: statusObra,
      template,
      fase,
      parceiro,
      valor,
    })

    let subtitulo: string | null = null
    if (template === 'prestacao_contas') {
      const parts: string[] = []
      if (valor != null) parts.push(`R$ ${valor.toLocaleString('pt-BR')}`)
      if (parceiro) parts.push(parceiro)
      subtitulo = parts.length ? parts.join(' · ') : obra?.orgao ?? null
    } else if (obra?.obra) {
      subtitulo = obra.obra
    }

    const { error: uErr } = await supabase
      .from('conteudos_planejados')
      .update({
        titulo: texts.titulo,
        texto_arte: texts.texto_arte,
        legenda: texts.legenda,
      })
      .eq('id', id)

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 })
    }

    const formato = normalizeFormato(row.formato as string | null)
    const temaRef = normalizeTemaFromTipo(obra?.tipo)

    let imagemFundo: string | null = obra?.imagem_url ?? null
    let referenciaUsadaId: string | null = null
    let fundoOrigem: 'obra' | 'referencia' | 'referencia_ia' | 'unsplash' | 'solido' = imagemFundo
      ? 'obra'
      : 'solido'

    if (!imagemFundo) {
      const referencia = await fetchMelhorReferenciaServer(temaRef, formato)
      if (referencia) {
        referenciaUsadaId = referencia.id
        const inspirada = await tryGenerateInspiredBackgroundUrl({
          referenceImageUrl: referencia.imagem_url,
          tema: temaRef,
          cidade,
          tipoObra: tipo,
        })
        if (inspirada) {
          imagemFundo = inspirada
          fundoOrigem = 'referencia_ia'
        } else {
          imagemFundo = referencia.imagem_url
          fundoOrigem = 'referencia'
        }
      }
    }

    if (!imagemFundo) {
      const unsplash = await fetchUnsplashImage(temaRef)
      if (unsplash) {
        imagemFundo = unsplash
        fundoOrigem = 'unsplash'
      }
    }

    const png = await renderCardPng({
      template,
      titulo: texts.titulo,
      texto_arte: texts.texto_arte,
      cidade,
      subtitulo,
      imagemFundo,
    })

    const formatoRaw = (row.formato as string | null) || 'geral'
    const folder = formatoRaw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'geral'
    const fileName = `${id}-${Date.now()}.png`
    const storagePath = `${folder}/${fileName}`

    const admin = createAdminClient()
    const { error: upErr } = await admin.storage.from('rascunhos').upload(storagePath, png, {
      contentType: 'image/png',
      upsert: true,
    })

    if (upErr) {
      console.error(upErr)
      return NextResponse.json({ error: 'Falha ao enviar PNG para o Storage (rascunhos).' }, { status: 500 })
    }

    const { error: finErr } = await supabase
      .from('conteudos_planejados')
      .update({
        storage_path_rascunho: storagePath,
        referencia_id: referenciaUsadaId,
        fundo_origem: fundoOrigem,
        status: 'gerado',
      })
      .eq('id', id)

    if (finErr) {
      return NextResponse.json({ error: finErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, storagePath })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro interno'
    console.error(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
