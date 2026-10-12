import type { MalhaMapaPIPayload } from '@/lib/geo-malha-pi'

/** Malha municipal do Piauí (IBGE) com `nm_mun` preenchido em cada feature. */
export async function fetchMalhaMunicipiosPI(): Promise<MalhaMapaPIPayload> {
  const res = await fetch('/api/geo/malha-municipios-pi')
  const json = (await res.json()) as MalhaMapaPIPayload & { error?: string }
  if (!res.ok) throw new Error(json.error || 'Erro ao carregar o mapa do Piauí')
  return json
}
