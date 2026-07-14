import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

export type InstagramPostClassificationDto = {
  theme: string
  isBoosted: boolean
  obraMapaId: string | null
}

// Função para gerar ID único baseado em data + legenda
function generateIdFromDateAndCaption(date: string, caption: string): string {
  const dateStr = new Date(date).toISOString().split('T')[0]
  const captionHash = caption.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return `${dateStr}_${captionHash}`
}

function normalizeObraMapaId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

// GET - Buscar todas as classificações do usuário
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
      .from('instagram_post_classifications')
      .select('identifier, theme, is_boosted, obra_mapa_id')
      .eq('user_id', user.id)

    if (error) {
      console.error('Erro ao buscar classificações:', error)
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar classificações' },
        { status: 500 }
      )
    }

    const classifications: Record<string, InstagramPostClassificationDto> = {}

    if (data) {
      data.forEach((item) => {
        classifications[item.identifier] = {
          theme: item.theme,
          isBoosted: item.is_boosted,
          obraMapaId: item.obra_mapa_id ?? null,
        }
      })
    }

    return NextResponse.json({ success: true, classifications })
  } catch (error) {
    console.error('Erro ao buscar classificações:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// POST - Salvar ou atualizar classificação
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
    const { postId, postDate, postCaption, theme, isBoosted, obraMapaId } = body

    if (!theme || typeof isBoosted !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Tema e isBoosted são obrigatórios' },
        { status: 400 }
      )
    }

    let identifier: string
    if (postId) {
      identifier = postId
    } else if (postDate && postCaption) {
      identifier = generateIdFromDateAndCaption(postDate, postCaption)
    } else {
      return NextResponse.json(
        { success: false, error: 'É necessário fornecer postId ou (postDate + postCaption)' },
        { status: 400 }
      )
    }

    const obraId =
      String(theme).trim().toLowerCase() === 'obras' ? normalizeObraMapaId(obraMapaId) : null

    const { data: existing } = await supabase
      .from('instagram_post_classifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('identifier', identifier)
      .single()

    const classificationData = {
      user_id: user.id,
      post_id: postId || null,
      identifier,
      post_date: postDate ? new Date(postDate).toISOString() : null,
      post_caption: postCaption || null,
      theme,
      is_boosted: isBoosted,
      obra_mapa_id: obraId,
    }

    if (existing) {
      const { data, error } = await supabase
        .from('instagram_post_classifications')
        .update(classificationData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Erro ao atualizar classificação:', error)
        return NextResponse.json(
          { success: false, error: 'Erro ao atualizar classificação' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        id: data.id,
        identifier: data.identifier,
        data: {
          theme: data.theme,
          isBoosted: data.is_boosted,
          obraMapaId: data.obra_mapa_id ?? null,
        },
      })
    }

    const { data, error } = await supabase
      .from('instagram_post_classifications')
      .insert(classificationData)
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar classificação:', error)
      return NextResponse.json(
        { success: false, error: 'Erro ao criar classificação' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      identifier: data.identifier,
      data: {
        theme: data.theme,
        isBoosted: data.is_boosted,
        obraMapaId: data.obra_mapa_id ?? null,
      },
    })
  } catch (error) {
    console.error('Erro ao salvar classificação:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// PUT - Atualizar múltiplas classificações (batch)
export async function PUT(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { classifications } = body

    if (!Array.isArray(classifications)) {
      return NextResponse.json(
        { success: false, error: 'classifications deve ser um array' },
        { status: 400 }
      )
    }

    const results = []

    for (const classification of classifications) {
      const { postId, postDate, postCaption, theme, isBoosted, obraMapaId } = classification

      if (!theme || typeof isBoosted !== 'boolean') {
        continue
      }

      let identifier: string
      if (postId) {
        identifier = postId
      } else if (postDate && postCaption) {
        identifier = generateIdFromDateAndCaption(postDate, postCaption)
      } else {
        continue
      }

      const obraId =
        String(theme).trim().toLowerCase() === 'obras' ? normalizeObraMapaId(obraMapaId) : null

      const classificationData = {
        user_id: user.id,
        post_id: postId || null,
        identifier,
        post_date: postDate ? new Date(postDate).toISOString() : null,
        post_caption: postCaption || null,
        theme,
        is_boosted: isBoosted,
        obra_mapa_id: obraId,
      }

      const { data: existing } = await supabase
        .from('instagram_post_classifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('identifier', identifier)
        .single()

      if (existing) {
        await supabase
          .from('instagram_post_classifications')
          .update(classificationData)
          .eq('id', existing.id)
      } else {
        await supabase.from('instagram_post_classifications').insert(classificationData)
      }

      results.push({ identifier, success: true })
    }

    return NextResponse.json({
      success: true,
      saved: results.length,
      results,
    })
  } catch (error) {
    console.error('Erro ao atualizar classificações em lote:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
