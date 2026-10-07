import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { carregarResultadoSecao2026 } from '@/lib/services/resultado-secao-2026-store'

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
    const payload = await carregarResultadoSecao2026()
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao carregar resultado por seção'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
