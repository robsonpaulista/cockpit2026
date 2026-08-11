import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAllowedInstagramCdnHost } from '@/lib/instagram-cdn-proxy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FETCH_HEADERS: HeadersInit = {
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://www.instagram.com/',
  Origin: 'https://www.instagram.com',
}

/**
 * Proxy same-origin para thumbs do Instagram CDN (Apify displayUrl / Graph media_url).
 * O browser com Referrer-Policy da app costuma receber 403 do CDN; o fetch no server
 * com Referer do Instagram contorna o bloqueio de hotlink.
 */
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const raw = new URL(request.url).searchParams.get('url')?.trim()
    if (!raw) {
      return NextResponse.json({ error: 'url obrigatória' }, { status: 400 })
    }

    let target: URL
    try {
      target = new URL(raw)
    } catch {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
    }

    if (target.protocol !== 'https:' && target.protocol !== 'http:') {
      return NextResponse.json({ error: 'Protocolo inválido' }, { status: 400 })
    }
    if (!isAllowedInstagramCdnHost(target.hostname)) {
      return NextResponse.json({ error: 'Host não permitido' }, { status: 400 })
    }

    const upstream = await fetch(target.toString(), {
      headers: FETCH_HEADERS,
      redirect: 'follow',
      cache: 'no-store',
    })

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `CDN respondeu ${upstream.status}` },
        { status: upstream.status === 404 ? 404 : 502 },
      )
    }

    const contentType = upstream.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Resposta não é imagem' }, { status: 502 })
    }

    const buffer = await upstream.arrayBuffer()
    if (buffer.byteLength < 32) {
      return NextResponse.json({ error: 'Imagem vazia' }, { status: 502 })
    }

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType.split(';')[0].trim() || 'image/jpeg',
        'Cache-Control': 'private, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('instagram-cdn-proxy:', error)
    return NextResponse.json({ error: 'Falha ao carregar imagem' }, { status: 500 })
  }
}
