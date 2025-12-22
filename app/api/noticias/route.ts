import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const newsSchema = z.object({
  title: z.string().min(1),
  source: z.string().min(1),
  url: z.string().url().optional(),
  content: z.string().optional(),
  sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  risk_level: z.enum(['low', 'medium', 'high']).optional(),
  theme: z.string().optional(),
  actor: z.string().optional(),
  published_at: z.string().optional(),
  crisis_id: z.string().uuid().optional(),
})

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sentiment = searchParams.get('sentiment')
    const risk_level = searchParams.get('risk_level')
    const theme = searchParams.get('theme')
    const processed = searchParams.get('processed')
    const feedIds = searchParams.get('feed_ids') // IDs dos feeds selecionados (formato: 'type-id,type-id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('news')
      .select('*')
      .order('collected_at', { ascending: false })
      .range(offset, offset + limit - 1)
    
    // Filtrar por feeds específicos se selecionados
    if (feedIds) {
      const feedIdArray = feedIds.split(',')
      const userFeedIds: string[] = []
      const adversaryIds: string[] = []
      
      feedIdArray.forEach(feedId => {
        // O formato é "type-uuid", mas UUIDs têm hífens também
        // Então precisamos fazer split apenas no primeiro hífen
        const firstDashIndex = feedId.indexOf('-')
        if (firstDashIndex === -1) return
        
        const type = feedId.substring(0, firstDashIndex)
        const id = feedId.substring(firstDashIndex + 1) // Resto após o primeiro hífen
        
        if (type === 'user_feed') {
          userFeedIds.push(id)
        } else if (type === 'adversary_feed') {
          adversaryIds.push(id)
        }
      })
      
      // Construir filtro OR para múltiplos tipos de feeds
      if (userFeedIds.length > 0 && adversaryIds.length > 0) {
        // Ambos tipos selecionados: fazer duas queries e combinar
        // Ou usar uma query com OR
        const conditions: string[] = []
        
        // Para cada feed do usuário
        userFeedIds.forEach(id => {
          conditions.push(`feed_id.eq.${id}`)
        })
        
        // Para cada adversário
        adversaryIds.forEach(id => {
          conditions.push(`adversary_id.eq.${id}`)
        })
        
        // Usar OR com todas as condições
        if (conditions.length > 0) {
          query = query.or(conditions.join(','))
        }
      } else if (userFeedIds.length > 0) {
        // Apenas feeds do usuário
        query = query.in('feed_id', userFeedIds)
      } else if (adversaryIds.length > 0) {
        // Apenas feeds de adversários
        query = query.in('adversary_id', adversaryIds)
      }
    }
    // Se nenhum feed selecionado, mostra todas

    if (sentiment) {
      query = query.eq('sentiment', sentiment)
    }

    if (risk_level) {
      query = query.eq('risk_level', risk_level)
    }

    if (theme) {
      query = query.eq('theme', theme)
    }

    if (processed !== null) {
      query = query.eq('processed', processed === 'true')
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
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
    const validated = newsSchema.parse(body)

    const { data, error } = await supabase
      .from('news')
      .insert({
        ...validated,
        published_at: validated.published_at || new Date().toISOString(),
        processed: validated.sentiment && validated.risk_level ? true : false,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}


