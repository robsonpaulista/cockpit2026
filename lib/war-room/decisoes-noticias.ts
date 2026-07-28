import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import {
  buildGoogleNewsRelatedHeatmap,
  type GoogleNewsHeatmapColumn,
  type PanoramaHeatmapRow,
} from '@/lib/monitoramento-panorama-charts'
import type { WarRoomDecisao } from '@/lib/war-room/decisoes'

function totalMenções(row: PanoramaHeatmapRow): number {
  return row.values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)
}

/**
 * Alerta único: candidato com mais menções de notícias no período do heatmap.
 */
export function buildDecisaoNoticiasLiderPeriodo(
  columns: GoogleNewsHeatmapColumn[],
  mentions: GoogleNewsMentionWithActor[],
  opts?: { windowDays?: number },
): WarRoomDecisao | null {
  const windowDays = opts?.windowDays ?? 7
  if (columns.length === 0) return null

  const heatmap = buildGoogleNewsRelatedHeatmap(columns, mentions, windowDays)
  if (heatmap.empty || heatmap.rows.length === 0) return null

  let lider: PanoramaHeatmapRow | null = null
  let liderTotal = 0
  for (const row of heatmap.rows) {
    const total = totalMenções(row)
    if (total > liderTotal) {
      lider = row
      liderTotal = total
    }
  }

  if (!lider || liderTotal <= 0) return null

  const diasLabel = windowDays === 1 ? '1 dia' : `${windowDays} dias`

  return {
    id: `noticias-lider:${lider.slug}`,
    prioridade: liderTotal >= 10 ? 'alta' : 'media',
    problema: `Mais notícias · ${lider.name}`,
    categoria: 'Notícias',
    hora: diasLabel,
    icone: 'mensagem',
    destaque: liderTotal >= 10,
    contexto: lider.slug,
    prazo: diasLabel,
    acao: `${liderTotal.toLocaleString('pt-BR')} menç${liderTotal === 1 ? 'ão' : 'ões'} · últimos ${diasLabel}`,
    href: '/dashboard/noticias/monitoramento?tab=google-news',
    status: 'pendente',
    createdAt: new Date().toISOString(),
  }
}
