import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'

/**
 * Cores por TD — alinhadas à paleta Cockpit (accent gold, status, blues institucionais).
 * `fill` = preenchimento do marcador; `stroke` = contorno legível no mapa claro.
 */
export const CORES_TERRITORIO_DESENVOLVIMENTO_PI: Record<
  TerritorioDesenvolvimentoPI,
  { fill: string; stroke: string }
> = {
  'Planície Litorânea': { fill: '#3B82F6', stroke: '#1D4ED8' },
  Cocais: { fill: '#C6A15B', stroke: '#6b5428' },
  Carnaubais: { fill: '#22C55E', stroke: '#15803D' },
  'Entre Rios': { fill: '#60A5FA', stroke: '#2563EB' },
  'Vale do Sambito': { fill: '#A78BFA', stroke: '#6D28D9' },
  'Vale do Rio Guaribas': { fill: '#F59E0B', stroke: '#B45309' },
  'Chapada do Vale do Rio Itaim': { fill: '#F87171', stroke: '#B91C1C' },
  'Vale do Canindé': { fill: '#2DD4BF', stroke: '#0F766E' },
  'Serra da Capivara': { fill: '#FB923C', stroke: '#C2410C' },
  'Vale dos Rios Piauí e Itaueira': { fill: '#C084FC', stroke: '#7E22CE' },
  'Tabuleiros do Alto Parnaíba': { fill: '#94A3B8', stroke: '#475569' },
  'Chapada das Mangabeiras': { fill: '#34D399', stroke: '#065F46' },
}

export function getCorTerritorioDesenvolvimentoPI(
  td: TerritorioDesenvolvimentoPI
): { fill: string; stroke: string } {
  return CORES_TERRITORIO_DESENVOLVIMENTO_PI[td]
}
