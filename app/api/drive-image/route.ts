import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/** Busca imagem pública do Google Drive pelo ID do arquivo (padrão Power BI / uc?export=view). */
async function fetchDriveImage(
  fileId: string,
  width?: number | null
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const sources: string[] = []

  if (width && width > 0) {
    sources.push(
      `https://lh3.googleusercontent.com/d/${fileId}=w${width}`,
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`
    )
  }

  sources.push(
    `https://drive.google.com/uc?export=view&id=${fileId}`,
    `https://drive.usercontent.google.com/download?id=${fileId}&export=view`,
    `https://drive.google.com/uc?export=download&id=${fileId}`
  )

  for (const url of sources) {
    try {
      const res = await fetch(url, { redirect: 'follow', cache: 'no-store' })
      const contentType = res.headers.get('content-type') ?? ''
      if (!res.ok || !contentType.startsWith('image/')) continue
      const buffer = await res.arrayBuffer()
      if (buffer.byteLength < 64) continue
      return { buffer, contentType }
    } catch {
      // tenta próxima fonte
    }
  }

  return null
}

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
    const fileId = searchParams.get('id')?.trim()
    const widthRaw = searchParams.get('w')
    const width = widthRaw ? Number.parseInt(widthRaw, 10) : null

    if (!fileId || !/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) {
      return NextResponse.json({ error: 'ID de arquivo inválido' }, { status: 400 })
    }

    const image = await fetchDriveImage(fileId, Number.isFinite(width) ? width : null)
    if (!image) {
      return NextResponse.json(
        { error: 'Não foi possível carregar a imagem. Verifique se o arquivo está compartilhado publicamente.' },
        { status: 404 }
      )
    }

    return new Response(image.buffer, {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('drive-image proxy:', error)
    return NextResponse.json({ error: 'Falha ao carregar imagem' }, { status: 500 })
  }
}
