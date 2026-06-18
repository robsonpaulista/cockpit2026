import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getInstagramPostsByPublishDate } from '@/lib/instagram-snapshot-server'

export const dynamic = 'force-dynamic'

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
    const publishDate = searchParams.get('publish_date')

    if (!publishDate || !/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
      return NextResponse.json({ error: 'publish_date inválido' }, { status: 400 })
    }

    const posts = await getInstagramPostsByPublishDate(supabase, user.id, publishDate)

    return NextResponse.json({ posts, publish_date: publishDate })
  } catch (error: unknown) {
    console.error('Erro ao buscar publicações do dia:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
