/**
 * Interpretação da coluna “Liderança Atual?” / LIDERANCA ATUAL da planilha Território.
 */

export function normalizeLiderancaAtualValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** SIM / S / YES / TRUE / 1 */
export function isLiderancaAtualSim(value: unknown): boolean {
  const n = normalizeLiderancaAtualValue(value)
  return n === 'SIM' || n === 'S' || n === 'YES' || n === 'TRUE' || n === '1'
}

/** N / Não / NO / FALSE / 0 */
export function isLiderancaAtualNao(value: unknown): boolean {
  const n = normalizeLiderancaAtualValue(value)
  return n === 'N' || n === 'NAO' || n === 'NO' || n === 'FALSE' || n === '0'
}

/** EM DIÁLOGO / EM DIALOGO (e variantes com espaços) */
export function isLiderancaAtualEmDialogo(value: unknown): boolean {
  const n = normalizeLiderancaAtualValue(value).replace(/\s+/g, ' ')
  return n === 'EM DIALOGO' || n.includes('EM DIALOGO')
}

function numeroPositivo(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0
  const cleaned = String(value ?? '')
    .replace(/[R$\s]/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) && n > 0
}

/**
 * Inclusão na listagem/KPI de lideranças:
 * - LIDERANCA ATUAL = N/Não → exclui sempre
 * - SIM ou EM DIÁLOGO → inclui
 * - caso contrário, inclui se houver valor &gt; 0 em alguma coluna de votos
 */
export function deveIncluirLiderancaPlanilha(
  row: Record<string, unknown>,
  opts: {
    liderancaAtualCol?: string
    colunasVotos?: Array<string | undefined>
  }
): boolean {
  const liderancaAtualCol = opts.liderancaAtualCol
  const colunasVotos = (opts.colunasVotos ?? []).filter((c): c is string => Boolean(c))

  if (!liderancaAtualCol && colunasVotos.length === 0) return true

  if (liderancaAtualCol && isLiderancaAtualNao(row[liderancaAtualCol])) {
    return false
  }

  if (liderancaAtualCol && isLiderancaAtualSim(row[liderancaAtualCol])) {
    return true
  }

  if (liderancaAtualCol && isLiderancaAtualEmDialogo(row[liderancaAtualCol])) {
    return true
  }

  return colunasVotos.some((col) => numeroPositivo(row[col]))
}
