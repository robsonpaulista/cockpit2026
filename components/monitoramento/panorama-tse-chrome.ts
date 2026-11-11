import { RADAR_CORES_SERIE } from '@/components/monitoramento/radar-ui'

/** Estilos de gráfico alinhados às outras abas do Radar (RADAR_CORES_SERIE). */
export const PANORAMA_TSE_CHART = {
  grade: RADAR_CORES_SERIE.grade,
  tick: RADAR_CORES_SERIE.texto,
  tooltip: {
    fontSize: 12,
    borderRadius: 8,
    border: `1px solid ${RADAR_CORES_SERIE.grade}`,
    background: '#FFFFFF',
    color: '#333333',
  },
} as const
