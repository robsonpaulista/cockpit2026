import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
      return NextResponse.json({ valid: false, error: 'Token e Business Account ID são obrigatórios' }, { status: 400 })
    }

    // Validar token
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${businessAccountId}?fields=id&access_token=${token}`,
        {
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json()
        
        if (errorData.error?.code === 190 || errorData.error?.code === 100) {
          return NextResponse.json({ valid: false, error: 'Token expirado ou inválido' })
        }
        
        return NextResponse.json({ valid: false, error: errorData.error?.message || 'Erro ao validar token' })
      }

      const data = await response.json()
      return NextResponse.json({ valid: true, data })
    } catch (error: any) {
      clearTimeout(timeoutId)
      
      if (error.name === 'AbortError' || error.message?.includes('fetch')) {
        return NextResponse.json({ valid: true }) // Manter como válido para tentar novamente
      }
      
      return NextResponse.json({ valid: false, error: error.message || 'Erro ao validar token' })
    }
  } catch (error: any) {
    console.error('Erro ao validar token:', error)
    return NextResponse.json(
      { valid: false, error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

