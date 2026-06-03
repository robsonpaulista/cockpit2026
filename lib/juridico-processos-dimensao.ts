import type { ProcessoLinksConsulta } from '@/lib/juridico-links-consulta'

export const DIMENSAO_PARTY_LABEL = 'DIMENSÃO DISTRIBUIDORA DE MEDICAMENTOS EIRELI-ME'

export type ProcessoDimensaoPolo = 'autor' | 'requerido' | 'autor_e_requerido'

export type ProcessoDimensao = {
  id: string
  processo: string
  acao: string | null
  area: string | null
  autor: string | null
  requerido: string | null
  orgaoJulgador: string | null
  varaOrigem: string | null
  municipioOrigem: string | null
  dataConsulta: string | null
  ultimaMovimentacao: string | null
  status: string | null
  prioridade: string | null
  observacoes: string | null
  fonte: string | null
  responsavel: string | null
  proximaAcao: string | null
  prazoInterno: string | null
  valorRisco: number | null
  linkPje: string | null
  /** URL de consulta pública (sem SSO jus.br quando possível), preenchida na API */
  consultaPublicaUrl?: string | null
  /** Hub do tribunal com várias formas de consulta */
  portalTribunalUrl?: string | null
  /** Links de consulta externa (DJEN, tribunal) */
  linksConsulta?: ProcessoLinksConsulta
  valorAtualizado: number | null
  riscoFinanceiro: string | null
  riscoPatrimonial: string | null
  riscoJuridico: string | null
  prioridadeEstrategica: string | null
  rankingEstrategico: number | null
  tituloEstrategico: string | null
  porQueCritico: string | null
  acaoRecomendada: string | null
  poloDimensao: ProcessoDimensaoPolo
}

export type ProcessosDimensaoDataset = {
  geradoEm: string
  parteFiltro: string
  total: number
  processos: ProcessoDimensao[]
}

export type ProcessosDimensaoKpis = {
  total: number
  acompanhar: number
  prazoIntimacao: number
  prioridadeAlta: number
  conclusos: number
  encerrados: number
  porStatus: Record<string, number>
  porArea: Record<string, number>
}

function normParty(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim()
}

/** Autor ou requerido é a Dimensão Distribuidora. */
export function isDimensaoPartyName(s: string | null | undefined): boolean {
  const n = normParty(s ?? '')
  return n.includes('DIMENSAO') && n.includes('DISTRIBUIDORA') && n.includes('MEDICAMENTOS')
}

export function processoEnvolveDimensao(p: Pick<ProcessoDimensao, 'autor' | 'requerido'>): boolean {
  return isDimensaoPartyName(p.autor) || isDimensaoPartyName(p.requerido)
}

export function buildProcessosDimensaoKpis(processos: ProcessoDimensao[]): ProcessosDimensaoKpis {
  const porStatus: Record<string, number> = {}
  const porArea: Record<string, number> = {}

  let acompanhar = 0
  let prazoIntimacao = 0
  let prioridadeAlta = 0
  let conclusos = 0
  let encerrados = 0

  for (const p of processos) {
    const status = p.status ?? 'Sem status'
    porStatus[status] = (porStatus[status] ?? 0) + 1
    const area = p.area ?? 'Sem área'
    porArea[area] = (porArea[area] ?? 0) + 1

    if (status === 'Acompanhar') acompanhar += 1
    if (status === 'Prazo/Intimação') prazoIntimacao += 1
    if (status === 'Concluso') conclusos += 1
    if (status === 'Encerrado/Arquivado') encerrados += 1
    if (p.prioridade === 'Alta' || p.prioridadeEstrategica === 'Alta') prioridadeAlta += 1
  }

  return {
    total: processos.length,
    acompanhar,
    prazoIntimacao,
    prioridadeAlta,
    conclusos,
    encerrados,
    porStatus,
    porArea,
  }
}

export type ProcessosDimensaoFiltros = {
  q?: string
  status?: string
  area?: string
  prioridade?: string
}

export function filtrarProcessosDimensao(
  processos: ProcessoDimensao[],
  filtros: ProcessosDimensaoFiltros
): ProcessoDimensao[] {
  const q = filtros.q?.trim().toLowerCase() ?? ''
  return processos.filter((p) => {
    if (filtros.status && filtros.status !== 'all' && p.status !== filtros.status) return false
    if (filtros.area && filtros.area !== 'all' && p.area !== filtros.area) return false
    if (filtros.prioridade && filtros.prioridade !== 'all' && p.prioridade !== filtros.prioridade) {
      return false
    }
    if (!q) return true
    const blob = [
      p.processo,
      p.acao,
      p.area,
      p.autor,
      p.requerido,
      p.municipioOrigem,
      p.ultimaMovimentacao,
      p.observacoes,
      p.tituloEstrategico,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return blob.includes(q)
  })
}
