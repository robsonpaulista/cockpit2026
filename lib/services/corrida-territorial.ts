import type { CorridaMunicipio, MunicipioCorrida } from '@/lib/corrida-territorial'

/** Vencedor de Deputado Federal por município em 2022 e 2026 (PI). */
export async function fetchCorridaFederal2022x2026(): Promise<MunicipioCorrida[]> {
  const res = await fetch('/api/resumo-eleicoes?totals=corridaFederal2022x2026')
  if (!res.ok) throw new Error('Não foi possível carregar os vencedores de 2022 e 2026')
  const data = (await res.json()) as { municipios?: MunicipioCorrida[] }
  return data.municipios ?? []
}

/** Votos de cada Deputado Federal em um município, em 2022 e 2026. */
export async function fetchCorridaFederalMunicipio(municipio: string): Promise<CorridaMunicipio> {
  const params = new URLSearchParams({ totals: 'corridaFederalMunicipio', municipio })
  const res = await fetch(`/api/resumo-eleicoes?${params}`)
  if (!res.ok) throw new Error(`Não foi possível carregar a corrida de ${municipio}`)
  return (await res.json()) as CorridaMunicipio
}
