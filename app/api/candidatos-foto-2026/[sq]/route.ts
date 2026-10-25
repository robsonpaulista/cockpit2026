import { NextResponse } from 'next/server'
import { lerFotoCandidato2026, sqFotoCandidato2026Valido } from '@/lib/services/candidatos-foto-2026'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { sq: string } },
): Promise<NextResponse> {
  const sq = params.sq.trim()
  if (!sqFotoCandidato2026Valido(sq)) {
    return new NextResponse(null, { status: 400 })
  }

  try {
    const foto = await lerFotoCandidato2026(sq)
    if (!foto) return new NextResponse(null, { status: 404 })
    return new NextResponse(new Uint8Array(foto), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=604800',
      },
    })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}
