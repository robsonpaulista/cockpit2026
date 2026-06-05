import type { ProcessoDimensao } from '@/lib/juridico-processos-dimensao'

export const JURIDICO_SORT_COLUMNS = [
  'rankingEstrategico',
  'processo',
  'acao',
  'area',
  'autor',
  'requerido',
  'orgaoJulgador',
  'varaOrigem',
  'municipioOrigem',
  'dataConsulta',
  'ultimaMovimentacao',
  'status',
  'prioridade',
  'observacoes',
  'fonte',
  'responsavel',
  'proximaAcao',
  'prazoInterno',
  'valorRisco',
  'valorAtualizado',
  'riscoFinanceiro',
  'riscoPatrimonial',
  'riscoJuridico',
  'prioridadeEstrategica',
  'tituloEstrategico',
  'porQueCritico',
  'acaoRecomendada',
  'poloDimensao',
  'linkPje',
] as const

export type JuridicoSortColumn = (typeof JURIDICO_SORT_COLUMNS)[number]

/** Colunas visíveis na tabela resumida (cabeçalho clicável). */
export const JURIDICO_TABLE_SORT_COLUMNS = [
  'processo',
  'status',
  'prioridade',
  'area',
  'orgaoJulgador',
  'poloDimensao',
  'municipioOrigem',
  'ultimaMovimentacao',
  'valorExibido',
] as const

export type JuridicoTableSortColumn = (typeof JURIDICO_TABLE_SORT_COLUMNS)[number]

/** Ordenação por campos que não aparecem na tabela (seletor nos filtros). */
export const JURIDICO_EXTRA_SORT_COLUMNS = JURIDICO_SORT_COLUMNS.filter(
  (col): col is JuridicoSortColumn =>
    !(JURIDICO_TABLE_SORT_COLUMNS as readonly string[]).includes(col)
)

export type JuridicoAnySortColumn = JuridicoSortColumn | 'valorExibido'

export const JURIDICO_TABLE_COLUMN_LABELS: Record<JuridicoTableSortColumn, string> = {
  processo: 'Processo',
  status: 'Status',
  prioridade: 'Prioridade',
  area: 'Área',
  orgaoJulgador: 'Órgão julgador',
  poloDimensao: 'Polo',
  municipioOrigem: 'Município',
  ultimaMovimentacao: 'Última mov.',
  valorExibido: 'Valor',
}

export function getJuridicoSortLabel(col: JuridicoAnySortColumn): string {
  if (col === 'valorExibido') return JURIDICO_TABLE_COLUMN_LABELS.valorExibido
  return JURIDICO_COLUMN_LABELS[col]
}

export function isJuridicoTableSortColumn(col: JuridicoAnySortColumn): col is JuridicoTableSortColumn {
  return (JURIDICO_TABLE_SORT_COLUMNS as readonly string[]).includes(col)
}

export const JURIDICO_COLUMN_LABELS: Record<JuridicoSortColumn, string> = {
  rankingEstrategico: 'Ranking',
  processo: 'Processo',
  acao: 'Ação',
  area: 'Área',
  autor: 'Autor',
  requerido: 'Requerido',
  orgaoJulgador: 'Órgão julgador',
  varaOrigem: 'Vara / origem',
  municipioOrigem: 'Município',
  dataConsulta: 'Data consulta',
  ultimaMovimentacao: 'Última movimentação',
  status: 'Status',
  prioridade: 'Prioridade',
  observacoes: 'Observações',
  fonte: 'Fonte',
  responsavel: 'Responsável',
  proximaAcao: 'Próxima ação',
  prazoInterno: 'Prazo interno',
  valorRisco: 'Valor / risco',
  valorAtualizado: 'Valor atualizado',
  riscoFinanceiro: 'Risco financeiro',
  riscoPatrimonial: 'Risco patrimonial',
  riscoJuridico: 'Risco jurídico',
  prioridadeEstrategica: 'Prioridade estratégica',
  tituloEstrategico: 'Título estratégico',
  porQueCritico: 'Por que crítico',
  acaoRecomendada: 'Ação recomendada',
  poloDimensao: 'Polo Dimensão',
  linkPje: 'Link PJe',
}

function strVal(v: string | null | undefined): string {
  return (v ?? '').toLowerCase()
}

function numVal(v: number | null | undefined): number {
  return v ?? Number.NEGATIVE_INFINITY
}

function dateVal(iso: string | null | undefined): number {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 0
  return new Date(`${iso}T12:00:00`).getTime()
}

function valorExibidoNum(p: ProcessoDimensao): number {
  const v = p.valorAtualizado ?? p.valorRisco
  return v != null && Number.isFinite(v) ? v : Number.NEGATIVE_INFINITY
}

export function getProcessoSortValue(p: ProcessoDimensao, col: JuridicoAnySortColumn): string | number {
  if (col === 'valorExibido') return valorExibidoNum(p)
  switch (col) {
    case 'rankingEstrategico':
      return numVal(p.rankingEstrategico)
    case 'processo':
      return strVal(p.processo)
    case 'acao':
      return strVal(p.acao)
    case 'area':
      return strVal(p.area)
    case 'autor':
      return strVal(p.autor)
    case 'requerido':
      return strVal(p.requerido)
    case 'orgaoJulgador':
      return strVal(p.orgaoJulgador)
    case 'varaOrigem':
      return strVal(p.varaOrigem)
    case 'municipioOrigem':
      return strVal(p.municipioOrigem)
    case 'dataConsulta':
      return dateVal(p.dataConsulta)
    case 'ultimaMovimentacao':
      return strVal(p.ultimaMovimentacao)
    case 'status':
      return strVal(p.status)
    case 'prioridade':
      return strVal(p.prioridade)
    case 'observacoes':
      return strVal(p.observacoes)
    case 'fonte':
      return strVal(p.fonte)
    case 'responsavel':
      return strVal(p.responsavel)
    case 'proximaAcao':
      return strVal(p.proximaAcao)
    case 'prazoInterno':
      return strVal(p.prazoInterno)
    case 'valorRisco':
      return numVal(p.valorRisco)
    case 'valorAtualizado':
      return numVal(p.valorAtualizado)
    case 'riscoFinanceiro':
      return strVal(p.riscoFinanceiro)
    case 'riscoPatrimonial':
      return strVal(p.riscoPatrimonial)
    case 'riscoJuridico':
      return strVal(p.riscoJuridico)
    case 'prioridadeEstrategica':
      return strVal(p.prioridadeEstrategica)
    case 'tituloEstrategico':
      return strVal(p.tituloEstrategico)
    case 'porQueCritico':
      return strVal(p.porQueCritico)
    case 'acaoRecomendada':
      return strVal(p.acaoRecomendada)
    case 'poloDimensao':
      return strVal(p.poloDimensao)
    case 'linkPje':
      return strVal(p.linkPje)
    default:
      return ''
  }
}

export function sortProcessosDimensao(
  processos: ProcessoDimensao[],
  column: JuridicoAnySortColumn | null,
  ascending: boolean,
  priorizarAtualizados = true
): ProcessoDimensao[] {
  if (!column) return processos
  return [...processos].sort((a, b) => {
    if (priorizarAtualizados) {
      const pa = a.movimentacaoAtualizadaEquipe ? 1 : 0
      const pb = b.movimentacaoAtualizadaEquipe ? 1 : 0
      if (pa !== pb) return pb - pa
    }
    const va = getProcessoSortValue(a, column)
    const vb = getProcessoSortValue(b, column)
    const cmp =
      typeof va === 'string' && typeof vb === 'string'
        ? va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' })
        : Number(va) - Number(vb)
    return ascending ? cmp : -cmp
  })
}
