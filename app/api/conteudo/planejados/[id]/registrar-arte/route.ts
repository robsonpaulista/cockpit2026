import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { registrarArteGeradaMcp } from '@/lib/mcp/data/conteudos'
import { supabaseNetworkErrorResponse } from '@/lib/supabase/network-error'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  imagemUrl: z.string().url(),
  canvaEditUrl: z.string().url().optional(),
  titulo: z.string().optional(),
  textoArte: z.string().optional(),
  legenda: z.string().optional(),
})

/** Registra arte externa (ex.: Canva) e marca status `gerado`. */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const json = await request.json()
    const body = bodySchema.parse(json)
    const result = await registrarArteGeradaMcp({
      conteudoId: params.id,
      imagemUrl: body.imagemUrl,
      canvaEditUrl: body.canvaEditUrl,
      titulo: body.titulo,
      textoArte: body.textoArte,
      legenda: body.legenda,
    })
    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }
    const networkResponse = supabaseNetworkErrorResponse(error)
    if (networkResponse) return networkResponse
    const msg = error instanceof Error ? error.message : 'Erro interno'
    const status = msg.includes('não encontrado') ? 404 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
