import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
      .from('pages')
      .select('id, key, label, path')
      .order('path')

    if (error) {
      console.error('Erro ao buscar páginas:', error)
      return NextResponse.json({ error: 'Erro ao buscar páginas' }, { status: 500 })
    }
    return NextResponse.json({ pages: data ?? [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
