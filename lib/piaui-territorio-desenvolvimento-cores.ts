import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'

/**
 * Cores por TD — alinhadas à paleta Cockpit (accent gold, status, blues institucionais).
 * `fill` = preenchimento do marcador; `stroke` = contorno legível no mapa claro.
 */
export const CORES_TERRITORIO_DESENVOLVIMENTO_PI: Record<
  TerritorioDesenvolvimentoPI,
  { fill: string; stroke: string }
> = {
  'Planície Litorânea': { fill: '#1368a8', stroke: '#062e52' },
  Cocais: { fill: '#C6A15B', stroke: '#6b5428' },
  Carnaubais: { fill: '#2E7D32', stroke: '#1b4d22' },
  'Entre Rios': { fill: '#0b4a7a', stroke: '#041e33' },
  'Vale do Sambito': { fill: '#7c6f9e', stroke: '#3d3558' },
  'Vale do Rio Guaribas': { fill: '#c77800', stroke: '#6e3f00' },
  'Chapada do Vale do Rio Itaim': { fill: '#9f2a2a', stroke: '#521616' },
  'Vale do Canindé': { fill: '#2d6a6a', stroke: '#163535' },
  'Serra da Capivara': { fill: '#b45309', stroke: '#5c2c05' },
  'Vale dos Rios Piauí e Itaueira': { fill: '#5c4d7d', stroke: '#2e263f' },
  'Tabuleiros do Alto Parnaíba': { fill: '#6b7280', stroke: '#3d4249' },
  'Chapada das Mangabeiras': { fill: '#1e5f4f', stroke: '#0f3028' },
}

export function getCorTerritorioDesenvolvimentoPI(
  td: TerritorioDesenvolvimentoPI
): { fill: string; stroke: string } {
  return CORES_TERRITORIO_DESENVOLVIMENTO_PI[td]
}
