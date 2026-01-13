import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
    const { token, businessAccountId } = body

    if (!token || !businessAccountId) {
      return NextResponse.json(
        { error: 'Token e Business Account ID são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar token antes de salvar
    const validationResponse = await fetch(
      `https://graph.facebook.com/v18.0/${businessAccountId}?fields=id&access_token=${token}`
    )

    if (!validationResponse.ok) {
      const errorData = await validationResponse.json()
      if (errorData.error?.code === 190 || errorData.error?.code === 100) {
        return NextResponse.json(
          { error: 'Token expirado ou inválido' },
          { status: 401 }
        )
      }
      return NextResponse.json(
        { error: errorData.error?.message || 'Erro ao validar token' },
        { status: 400 }
      )
    }

    // Salvar no banco de dados (opcional - pode usar apenas localStorage no cliente)
    // Por enquanto, apenas retornar sucesso
    // O cliente salvará no localStorage

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Erro ao salvar configuração:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Retornar credenciais das variáveis de ambiente do servidor (seguro)
    // Usa variáveis SEM NEXT_PUBLIC_ para não expor no browser
    const token = process.env.INSTAGRAM_TOKEN || ''
    const businessAccountId = process.env.INSTAGRAM_BUSINESS_ID || ''

    // Só retornar se ambos estiverem configurados
    if (token && businessAccountId) {
      return NextResponse.json({ token, businessAccountId })
    }

    // Se não houver variáveis de ambiente, retornar vazio
    return NextResponse.json({ token: null, businessAccountId: null })
  } catch (error: unknown) {
    console.error('Erro ao buscar configuração:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}













