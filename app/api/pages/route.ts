import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PERMISSION_PAGES } from '@/lib/page-permissions-catalog'

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

    const pages = PERMISSION_PAGES.map((page) => ({
      id: page.key,
      key: page.key,
      label: page.label,
      path: page.path,
    }))
    return NextResponse.json({ pages })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
