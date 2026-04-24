import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'

export type FetchMobilizacaoPorTdMapsResult =
  | { ok: true; lideradosPorTd: Map<TerritorioDesenvolvimentoPI, number>; lideresPorTd: Map<TerritorioDesenvolvimentoPI, number> }
  | { ok: false; status: number }

function mapFromRecord(rec: Record<string, number> | undefined): Map<TerritorioDesenvolvimentoPI, number> {
  const map = new Map<TerritorioDesenvolvimentoPI, number>()
  for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
    const n = rec?.[td]
    map.set(td, typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0)
  }
  return map
}

/** Contagens da mobilização por TD: `leaders` e `leads_militancia` pelo município/cidade da liderança (mapa oficial), mesma base de /dashboard/mobilizacao/config */
export async function fetchMobilizacaoPorTdMaps(): Promise<FetchMobilizacaoPorTdMapsResult> {
  const res = await fetch('/api/mobilizacao/liderados-por-td')
  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: res.status }
  }
  if (!res.ok) {
    return { ok: false, status: res.status }
  }
  const data = (await res.json()) as { porTd?: Record<string, number>; lideresPorTd?: Record<string, number> }
  return {
    ok: true,
    lideradosPorTd: mapFromRecord(data.porTd),
    lideresPorTd: mapFromRecord(data.lideresPorTd),
  }
}
