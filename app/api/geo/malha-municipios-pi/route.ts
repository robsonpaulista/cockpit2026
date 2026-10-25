import { NextResponse } from 'next/server'
import type { MalhaCollection, MalhaMapaPIPayload } from '@/lib/geo-malha-pi'
import malhaBase from '@/lib/geo/malha-municipios-pi.json'
import contornoBase from '@/lib/geo/malha-uf-pi.json'
import municipiosIbge from '@/lib/geo/municipios-ibge-pi.json'
import { getTerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { requireRouteUser } from '@/lib/supabase/route-auth'

/**
 * Malha municipal do IBGE (UF 22, resolução 5) embutida no projeto.
 * Produção não depende de o servidor alcançar o IBGE a cada abertura do Território.
 */
let pronta: MalhaMapaPIPayload | null = null

function montarMalha(): MalhaMapaPIPayload {
  if (pronta) return pronta
  const nomes = new Map(municipiosIbge.map((m) => [String(m.id), m.nome]))
  const municipios: MalhaCollection = {
    type: malhaBase.type,
    features: malhaBase.features.map((f) => {
      const id = String(f.properties?.codarea ?? '')
      const nome = nomes.get(id) ?? ''
      return {
        type: f.type,
        geometry: f.geometry,
        properties: {
          codarea: id,
          centroide: f.properties?.centroide as [number, number] | undefined,
          nm_mun: nome,
          td: nome ? getTerritorioDesenvolvimentoPI(nome) : null,
        },
      }
    }),
  }
  pronta = {
    municipios,
    contornoUf: contornoBase as unknown as MalhaCollection,
  }
  return pronta
}

export async function GET() {
  try {
    const auth = await requireRouteUser()
    if (!auth.ok) return auth.response

    return NextResponse.json(montarMalha(), {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (e) {
    console.error('[malha-municipios-pi]', e)
    return NextResponse.json({ error: 'Erro ao montar malha' }, { status: 500 })
  }
}
