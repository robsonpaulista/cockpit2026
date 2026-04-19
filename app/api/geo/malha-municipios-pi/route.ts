import { NextResponse } from 'next/server'
import type { MalhaCollection, MalhaMapaPIPayload } from '@/lib/geo-malha-pi'
import { getTerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'

/** Malha municipal simplificada do IBGE (UF 22) — GeoJSON, ~100KB. */
const MALHA_PI_URL =
  'https://servicodados.ibge.gov.br/api/v2/malhas/22?resolucao=5&formato=application/vnd.geo+json&qualidade=3'

/** Contorno da UF (um polígono) — ~5KB; usado para limitar pan e desenhar a “moldura” do Piauí. */
const MALHA_UF_PI_URL =
  'https://servicodados.ibge.gov.br/api/v2/malhas/22?resolucao=2&formato=application/vnd.geo+json&qualidade=3'

const MUNICIPIOS_PI_URL =
  'https://servicodados.ibge.gov.br/api/v1/localidades/estados/22/municipios'

interface IBGEMunicipio {
  id: number
  nome: string
}

export async function GET() {
  try {
    const [malhaRes, munRes, ufRes] = await Promise.all([
      fetch(MALHA_PI_URL, { next: { revalidate: 86_400 } }),
      fetch(MUNICIPIOS_PI_URL, { next: { revalidate: 86_400 } }),
      fetch(MALHA_UF_PI_URL, { next: { revalidate: 86_400 } }),
    ])

    if (!malhaRes.ok) {
      return NextResponse.json(
        { error: 'Falha ao obter malha municipal do IBGE' },
        { status: 502 }
      )
    }
    if (!munRes.ok) {
      return NextResponse.json(
        { error: 'Falha ao obter lista de municípios do IBGE' },
        { status: 502 }
      )
    }

    const malha = (await malhaRes.json()) as MalhaCollection
    const municipios = (await munRes.json()) as IBGEMunicipio[]

    const idToNome = new Map<string, string>()
    for (const m of municipios) {
      idToNome.set(String(m.id), m.nome)
    }

    for (const f of malha.features) {
      const id = f.properties?.codarea
      const nome = id ? idToNome.get(id) ?? '' : ''
      f.properties.nm_mun = nome
      f.properties.td = nome ? getTerritorioDesenvolvimentoPI(nome) : null
    }

    let contornoUf: MalhaCollection | null = null
    if (ufRes.ok) {
      try {
        contornoUf = (await ufRes.json()) as MalhaCollection
      } catch {
        contornoUf = null
      }
    }

    const payload: MalhaMapaPIPayload = { municipios: malha, contornoUf }

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    })
  } catch (e) {
    console.error('[malha-municipios-pi]', e)
    return NextResponse.json({ error: 'Erro ao montar malha' }, { status: 500 })
  }
}
