import {
  getTerritorioDesenvolvimentoPI,
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import type { IptMunicipio } from '@/lib/ipt'

/** Vista padrão — estado inteiro. */
export const IPT_MAP_VIEW_PI = {
  center: [-6.5, -43.0] as [number, number],
  zoom: 7,
}

/** Rótulos curtos para a toolbar — nomes oficiais completos no title da opção. */
export const IPT_TD_LABEL_CURTO: Record<TerritorioDesenvolvimentoPI, string> = {
  'Planície Litorânea': 'Litorânea',
  Cocais: 'Cocais',
  Carnaubais: 'Carnaubais',
  'Entre Rios': 'Entre Rios',
  'Vale do Sambito': 'Sambito',
  'Vale do Rio Guaribas': 'Guaribas',
  'Chapada do Vale do Rio Itaim': 'Itaim',
  'Vale do Canindé': 'Canindé',
  'Serra da Capivara': 'Capivara',
  'Vale dos Rios Piauí e Itaueira': 'Piauí e Itaueira',
  'Tabuleiros do Alto Parnaíba': 'Alto Parnaíba',
  'Chapada das Mangabeiras': 'Mangabeiras',
}

export function iptTdDoMunicipio(m: IptMunicipio): TerritorioDesenvolvimentoPI | null {
  return getTerritorioDesenvolvimentoPI(m.municipio)
}

export function filtrarIptMunicipiosPorTd(
  municipios: IptMunicipio[],
  td: TerritorioDesenvolvimentoPI | null
): IptMunicipio[] {
  if (!td) return municipios
  return municipios.filter((m) => getTerritorioDesenvolvimentoPI(m.municipio) === td)
}

export function buildContagemIptPorTd(municipios: IptMunicipio[]): Record<TerritorioDesenvolvimentoPI, number> {
  const map = Object.fromEntries(
    TERRITORIOS_DESENVOLVIMENTO_PI.map((td) => [td, 0])
  ) as Record<TerritorioDesenvolvimentoPI, number>

  for (const m of municipios) {
    const td = getTerritorioDesenvolvimentoPI(m.municipio)
    if (td) map[td] += 1
  }
  return map
}

export function iptLatLngPointsFromMunicipios(municipios: IptMunicipio[]): Array<[number, number]> {
  const pts: Array<[number, number]> = []
  for (const m of municipios) {
    if (Number.isFinite(m.lat) && Number.isFinite(m.lng)) pts.push([m.lat, m.lng])
  }
  return pts
}
