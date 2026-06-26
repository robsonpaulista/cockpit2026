import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getRecfaceApiUrl, recfaceFetch } from '@/lib/recface-server'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ path?: string[] }> }

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params
  const slug = path.join('/')
  const targetUrl = new URL(`${getRecfaceApiUrl()}/${slug}`)
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value)
  })

  const contentType = request.headers.get('content-type') ?? ''
  const init: RequestInit = {
    method: request.method,
    cache: 'no-store',
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (contentType.includes('multipart/form-data')) {
      init.body = await request.formData()
    } else if (contentType.includes('application/json')) {
      init.body = await request.text()
      init.headers = { 'Content-Type': 'application/json' }
    } else {
      const raw = await request.arrayBuffer()
      if (raw.byteLength > 0) init.body = raw
    }
  }

  try {
    const upstream = await fetch(targetUrl.toString(), { ...init, cache: 'no-store' })
    const body = await upstream.arrayBuffer()
    const responseContentType = upstream.headers.get('content-type') ?? 'application/json'

    return new NextResponse(body, {
      status: upstream.status,
      headers: { 'Content-Type': responseContentType },
    })
  } catch {
    return NextResponse.json(
      {
        error:
          'Serviço de reconhecimento facial indisponível. Execute: bash scripts/run-recface-server.sh',
      },
      { status: 503 },
    )
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params
  if (path.length === 0) {
    try {
      const health = await recfaceFetch('/health')
      const engine = await recfaceFetch('/engine')
      const healthJson = health.ok ? await health.json() : { status: 'down' }
      const engineJson = engine.ok ? await engine.json() : null
      return NextResponse.json({ ok: health.ok, ...healthJson, engine: engineJson })
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Serviço offline — bash scripts/run-recface-server.sh' },
        { status: 503 },
      )
    }
  }
  return proxyRequest(request, context)
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context)
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context)
}
