import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  carregarResultadoSecao2026,
  versaoResultadoSecao2026,
} from '@/lib/services/resultado-secao-2026-store'

export const dynamic = 'force-dynamic'

/** O navegador guarda o JSON (7 MB), mas revalida sempre: só baixa de novo quando o arquivo é regenerado. */
const CACHE_CONTROL = 'private, no-cache'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    const etag = await versaoResultadoSecao2026()
    const headers = { 'Cache-Control': CACHE_CONTROL, ETag: etag }
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers })
    }
    const payload = await carregarResultadoSecao2026()
    return NextResponse.json(payload, { headers })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao carregar resultado por seção'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
