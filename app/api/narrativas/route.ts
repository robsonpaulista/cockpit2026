import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logger, logError } from '@/lib/logger'

const isDev = process.env.NODE_ENV === 'development'

const narrativeSchema = z.object({
  theme: z.string().min(1, 'Tema é obrigatório'),
  target_audience: z.string().min(1, 'Público-alvo é obrigatório'),
  key_message: z.string().min(1, 'Mensagem-chave é obrigatória'),
  arguments: z.array(z.string()).default([]),
  proofs: z.array(z.any()).default([]),
  tested_phrases: z.array(z.string()).default([]),
  usage_count: z.number().int().min(0).default(0),
  performance_score: z.number().int().min(0).max(100).default(0),
  status: z.enum(['ativa', 'rascunho', 'arquivada']).default('ativa'),
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
    const theme = searchParams.get('theme')
    const target_audience = searchParams.get('target_audience')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    let query = supabase
      .from('narratives')
      .select('*')
      .order('created_at', { ascending: false })

    // Filtros
    if (theme) {
      query = query.eq('theme', theme)
    }

    if (target_audience) {
      query = query.eq('target_audience', target_audience)
    }

    if (status) {
      query = query.eq('status', status)
    }

    // Busca por texto (tema, mensagem ou público)
    if (search) {
      query = query.or(`theme.ilike.%${search}%,key_message.ilike.%${search}%,target_audience.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      logError('Erro ao buscar narrativas', error, {
        userId: user.id,
        endpoint: '/api/narrativas',
      })
      return NextResponse.json({ error: 'Erro ao buscar narrativas' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    console.error('Erro ao buscar narrativas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  let userId: string | undefined

  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    userId = user.id

    const body = await request.json()
    const validatedData = narrativeSchema.parse(body)

    const { data, error } = await supabase
      .from('narratives')
      .insert({
        theme: validatedData.theme,
        target_audience: validatedData.target_audience,
        key_message: validatedData.key_message,
        arguments: validatedData.arguments || [],
        proofs: validatedData.proofs || [],
        tested_phrases: validatedData.tested_phrases || [],
        usage_count: validatedData.usage_count || 0,
        performance_score: validatedData.performance_score || 0,
        status: validatedData.status || 'ativa',
      })
      .select()
      .single()

    if (error) {
      logError('Erro ao criar narrativa', error, {
        userId,
        endpoint: '/api/narrativas',
      })
      return NextResponse.json({ error: 'Erro ao criar narrativa' }, { status: 500 })
    }

    logger.info('Narrativa criada', { userId, narrativeId: data.id })
    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      logger.warn('Validação de narrativa falhou', {
        userId,
        errors: error.errors,
      })
      return NextResponse.json(
        { error: 'Dados inválidos', details: isDev ? error.errors : undefined },
        { status: 400 }
      )
    }

    logError('Erro ao criar narrativa', error, {
      userId,
      endpoint: '/api/narrativas',
    })
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}












