import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRouteUser } from '@/lib/supabase/route-auth'
import { ensureMunicipioDistanciasEstrada } from '@/lib/municipio-distancia-estrada'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  municipios: z.array(z.string().min(1).max(120)).min(2).max(50),
})

/**
 * Garante km rodoviários entre municípios (cache Supabase + ORS Matrix se faltar).
 * POST { municipios: string[] }
 */
export async function POST(request: Request) {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    const json = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Informe entre 2 e 50 nomes de municípios.' },
        { status: 400 },
      )
    }

    const supabase = createAdminClient()
    const result = await ensureMunicipioDistanciasEstrada(supabase, parsed.data.municipios)

    return NextResponse.json({
      distancias: result.distancias,
      fonte: result.fonte,
      doCache: result.doCache,
      doOrs: result.doOrs,
      faltando: result.faltando,
      erro: result.erro ?? null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao garantir distâncias'
    console.error('[geo/municipio-distancias]', e)
    return NextResponse.json({ error: msg, distancias: {} }, { status: 500 })
  }
}
