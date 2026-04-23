import type { ClassificacaoTerritorioTd } from '@/lib/piaui-territorio-classificacao'

const fmt0 = new Intl.NumberFormat('pt-BR')
const fmt1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/**
 * Indicador alinhado aos marcadores do mapa Digital IG: comentários vinculados ÷ postagens processadas × 100
 * (sem teto — pode ultrapassar 100%).
 */
export function pctComentariosPorPostagensProcessadas(comentarios: number, postagensProcessadas: number): number {
  if (!Number.isFinite(postagensProcessadas) || postagensProcessadas <= 0) return 0
  if (!Number.isFinite(comentarios) || comentarios < 0) return 0
  return (comentarios / postagensProcessadas) * 100
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
      : `${fmt0.format(comentarios)} comentários ÷ ${fmt0.format(postagensProcessadas)} postagens processadas = ${fmt1.format(pctEngajamento)}%.`
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
