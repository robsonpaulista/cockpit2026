import { NextResponse } from 'next/server'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { resolveSeiPublicUrlFromProtocolo } from '@/lib/sei-protocolo-url'

export const dynamic = 'force-dynamic'

type Body = {
  sei?: string
  /** Resolve vários protocolos de uma vez (máx. 20). */
  seis?: string[]
}

/**
 * Resolve número SEI → URL pública md_pesq_processo_exibir.php?<token>
 * (Pesquisa Pública, sem captcha).
 */
export async function POST(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const body = (await request.json().catch(() => ({}))) as Body
    const single = typeof body.sei === 'string' ? body.sei.trim() : ''
    const list = Array.isArray(body.seis)
      ? body.seis
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean)
      : []
    const protocolos = [...new Set(single ? [single, ...list] : list)].slice(0, 20)

    if (protocolos.length === 0) {
      return NextResponse.json(
        { error: 'Informe sei ou seis[]' },
        { status: 400 },
      )
    }

    const urls: Record<string, string | null> = {}
    const errors: Record<string, string> = {}

    for (const sei of protocolos) {
      const result = await resolveSeiPublicUrlFromProtocolo(sei)
      urls[sei] = result.url
      if (result.error) errors[sei] = result.error
    }

    if (protocolos.length === 1) {
      const sei = protocolos[0]
      return NextResponse.json({
        sei,
        url: urls[sei] ?? null,
        error: errors[sei] ?? null,
      })
    }

    return NextResponse.json({ urls, errors })
  } catch (error: unknown) {
    console.error('[sei/resolve-url]', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Erro ao resolver link SEI',
      },
      { status: 500 },
    )
  }
}
