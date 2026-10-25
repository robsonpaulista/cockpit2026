import { NextResponse } from 'next/server'
import { anoFotoCandidato, lerFotoCandidato, sqFotoCandidatoValido } from '@/lib/services/candidatos-foto-2026'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { ano: string; sq: string } },
): Promise<NextResponse> {
  const ano = anoFotoCandidato(params.ano)
  const sq = params.sq.trim()
  if (!ano || !sqFotoCandidatoValido(sq)) {
    return new NextResponse(null, { status: 400 })
  }

  try {
    const foto = await lerFotoCandidato(ano, sq)
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
