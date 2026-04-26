import type { ClassificacaoTerritorioTd } from '@/lib/piaui-territorio-classificacao'

const fmt0 = new Intl.NumberFormat('pt-BR')
const fmt1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/**
 * % das postagens processadas na conta em que houve pelo menos um comentário vinculado ao recorte (liderados).
 * Usa mídias distintas (`instagram_media_id`), não o total de comentários — teto 100%.
 */
export function pctMidiasComComentarioPorPostagensProcessadas(
  midiasDistintasComComentario: number,
  postagensProcessadas: number
): number {
  if (!Number.isFinite(postagensProcessadas) || postagensProcessadas <= 0) return 0
  if (!Number.isFinite(midiasDistintasComComentario) || midiasDistintasComComentario < 0) return 0
  return Math.min(100, (midiasDistintasComComentario / postagensProcessadas) * 100)
}

/**
 * Eng. IG: abaixo de 50% → baixo; 50% a 80% (inclusive) → médio; acima de 80% → alto.
 * Reutiliza `ClassificacaoTerritorioTd` para cores/ícones do badge existente.
 */
export function classificacaoTerritorioTdPorPctEngajamentoIg(pct: number): ClassificacaoTerritorioTd {
  if (!Number.isFinite(pct) || pct < 50) return 'baixo-impacto'
  if (pct <= 80) return 'atencao'
  return 'estrategico'
}

export function rotuloEngajamentoIgPorTipo(tipo: ClassificacaoTerritorioTd): string {
  if (tipo === 'estrategico') return 'Alto Engajamento'
  if (tipo === 'atencao') return 'Médio Engajamento'
  return 'Baixo Engajamento'
}

export function tituloTooltipEngajamentoIgComentarios(
  comentarios: number,
  postagensProcessadas: number,
  pctEngajamento: number,
  extra?: string
): string {
  const faixas = 'Faixas: abaixo de 50% baixo; 50% a 80% médio; acima de 80% alto.'
  const base =
    postagensProcessadas <= 0
      ? 'Sem postagens processadas na conta; engajamento considerado baixo.'
      : `${fmt0.format(comentarios)} comentários vinculados; taxa na coluna = mídias com comentário ÷ ${fmt0.format(postagensProcessadas)} postagens processadas = ${fmt1.format(pctEngajamento)}%.`
  return [base, faixas, extra].filter((s) => s && s.trim()).join(' ')
}

export function tituloTooltipEngajamentoIgMidias(
  midiasComComentario: number,
  postagensProcessadas: number,
  pctEngajamento: number,
  extra?: string
): string {
  const faixas = 'Faixas: abaixo de 50% baixo; 50% a 80% médio; acima de 80% alto.'
  const base =
    postagensProcessadas <= 0
      ? 'Sem postagens processadas na conta; engajamento considerado baixo.'
      : `${fmt0.format(midiasComComentario)} mídias com comentário ÷ ${fmt0.format(postagensProcessadas)} postagens processadas = ${fmt1.format(pctEngajamento)}%.`
  return [base, faixas, extra].filter((s) => s && s.trim()).join(' ')
}
