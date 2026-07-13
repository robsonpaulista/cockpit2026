import * as XLSX from 'xlsx'
import {
  IPT_FAIXAS,
  IPT_INDICADOR_OPCOES,
  IPT_SINAL_LABEL,
  type IptIndicador,
  type IptMunicipio,
  type IptPrioridade,
  type IptSinal,
} from '@/lib/ipt'
import {
  evolucaoDaLente,
  iptEvolucaoLabel,
  type IptEvolucao,
  type IptEvolucaoFiltro,
} from '@/lib/ipt-evolucao'
import {
  getTerritorioDesenvolvimentoPI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'

export type IptExportFiltros = {
  prioridade: IptPrioridade | null
  indicador: IptIndicador | 'geral'
  evolucao: IptEvolucaoFiltro
  td: TerritorioDesenvolvimentoPI | null
}

const PRIORIDADE_ORDEM: Record<IptPrioridade, number> = {
  critico: 0,
  atencao: 1,
  estavel: 2,
  forte: 3,
  sem_expectativa: 4,
}

function labelPrioridade(p: IptPrioridade): string {
  return IPT_FAIXAS.find((f) => f.prioridade === p)?.descricao ?? p
}

function labelSinal(s: IptSinal): string {
  return IPT_SINAL_LABEL[s]
}

function labelIndicador(id: IptIndicador | 'geral'): string {
  return IPT_INDICADOR_OPCOES.find((o) => o.id === id)?.label ?? id
}

function labelEvolucaoFiltro(f: IptEvolucaoFiltro): string {
  if (f === 'todos') return 'Todos'
  return iptEvolucaoLabel(f)
}

function formatPct(value: number | null | undefined, digits = 1): string | number {
  if (value == null || !Number.isFinite(value)) return ''
  return Math.round(value * 10 ** digits) / 10 ** digits
}

function formatMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

/** Ações práticas para assessores de campo, conforme sinais da linha. */
export function acoesSugeridasIpt(
  m: IptMunicipio,
  indicador: IptIndicador | 'geral'
): string {
  const acoes: string[] = []
  const lenteVisitas = indicador === 'geral' || indicador === 'visitas'
  const lentePesquisa = indicador === 'geral' || indicador === 'pesquisa'
  const lenteObras = indicador === 'geral' || indicador === 'obras'
  const lenteDigital = indicador === 'geral' || indicador === 'digital'

  if (lenteVisitas) {
    if (m.sinais.visitas === 'mal' || m.evolucao.visitas === 'diminuiu') {
      acoes.push('Priorizar visita de campo')
    } else if (m.detalhes.visitasNoPeriodo === 0 && m.prioridade !== 'sem_expectativa') {
      acoes.push('Agendar visita')
    }
  }

  if (lentePesquisa) {
    if (
      m.sinais.pesquisa === 'mal' ||
      m.evolucao.pesquisa === 'diminuiu' ||
      (m.detalhes.pesquisaPosicaoTop5 != null && m.detalhes.pesquisaPosicaoTop5 > 3)
    ) {
      acoes.push('Refazer pesquisa de intenção')
    } else if (m.sinais.pesquisa === 'sem_dado' && m.prioridade !== 'sem_expectativa') {
      acoes.push('Incluir na próxima rodada de pesquisa')
    }
  }

  if (lenteObras && m.detalhes.obrasQuantidade === 0 && m.prioridade !== 'sem_expectativa') {
    if (m.prioridade === 'critico' || m.prioridade === 'atencao') {
      acoes.push('Avaliar destinação de obra')
    }
  }

  if (lenteDigital && m.sinais.digital === 'sem_dado' && m.prioridade !== 'sem_expectativa') {
    if (m.pesoExpectativaPct >= 1) {
      acoes.push('Reforçar presença digital')
    }
  }

  if (acoes.length === 0) {
    if (m.prioridade === 'critico') return 'Revisão urgente do território'
    if (m.prioridade === 'atencao') return 'Acompanhar de perto'
    return 'Manter acompanhamento'
  }

  return [...new Set(acoes)].join('; ')
}

function slugFiltro(filtros: IptExportFiltros): string {
  const parts: string[] = [filtros.indicador]
  if (filtros.prioridade) parts.push(filtros.prioridade)
  if (filtros.evolucao !== 'todos') parts.push(filtros.evolucao)
  if (filtros.td) {
    parts.push(
      filtros.td
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 24)
    )
  }
  return parts.join('-')
}

function dataArquivo(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function nomeArquivoIptExport(filtros: IptExportFiltros): string {
  return `ipt-diagnostico-${slugFiltro(filtros)}-${dataArquivo()}.xlsx`
}

export function buildIptExportRows(
  municipios: IptMunicipio[],
  filtros: IptExportFiltros
): Record<string, string | number>[] {
  const ordenados = [...municipios].sort((a, b) => {
    const op = PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade]
    if (op !== 0) return op
    if (b.pesoExpectativaPct !== a.pesoExpectativaPct) {
      return b.pesoExpectativaPct - a.pesoExpectativaPct
    }
    return a.municipio.localeCompare(b.municipio, 'pt-BR')
  })

  const lente = filtros.indicador

  return ordenados.map((m) => {
    const td = getTerritorioDesenvolvimentoPI(m.municipio)
    const base: Record<string, string | number> = {
      Município: m.municipio,
      TD: td ?? '',
      Diagnóstico: labelPrioridade(m.prioridade),
      'Expectativa votos': m.expectativaVotos,
      'Peso expectativa %': formatPct(m.pesoExpectativaPct, 2),
    }

    if (lente === 'visitas') {
      return {
        ...base,
        'Sinal visitas': labelSinal(m.sinais.visitas),
        'Visitas 0–30d': m.detalhes.visitasNoPeriodo,
        'Visitas 31–60d': m.detalhes.visitasPeriodoAnterior,
        'Visitas histórico': m.detalhes.visitasHistorico,
        'Evolução visitas': iptEvolucaoLabel(m.evolucao.visitas),
        'Ações sugeridas': acoesSugeridasIpt(m, 'visitas'),
      }
    }

    if (lente === 'obras') {
      return {
        ...base,
        'Sinal obras': labelSinal(m.sinais.obras),
        'Qtd obras': m.detalhes.obrasQuantidade,
        'Valor obras (R$)': formatMoney(m.detalhes.obrasValorTotal),
        'Ações sugeridas': acoesSugeridasIpt(m, 'obras'),
      }
    }

    if (lente === 'pesquisa') {
      return {
        ...base,
        'Sinal pesquisa': labelSinal(m.sinais.pesquisa),
        'Posição top 5': m.detalhes.pesquisaPosicaoTop5 ?? '',
        'Média intenção %': formatPct(m.detalhes.pesquisaMediaPct),
        'Intenção recente %': formatPct(m.detalhes.pesquisaRecentePct),
        'Intenção anterior %': formatPct(m.detalhes.pesquisaAnteriorPct),
        'Delta pp': formatPct(m.detalhes.pesquisaDeltaPp),
        'Base pesquisa': m.detalhes.pesquisaBase ?? '',
        'Evolução pesquisa': iptEvolucaoLabel(m.evolucao.pesquisa),
        'Ações sugeridas': acoesSugeridasIpt(m, 'pesquisa'),
      }
    }

    if (lente === 'digital') {
      return {
        ...base,
        'Sinal digital': labelSinal(m.sinais.digital),
        Seguidores: m.detalhes.digitalSeguidores ?? '',
        'Seguidores %': formatPct(m.detalhes.digitalSeguidoresPct, 2),
        'Contas engajadas': m.detalhes.digitalContasEngajadas ?? '',
        'Evolução digital': iptEvolucaoLabel(m.evolucao.digitalSeguidores),
        'Ações sugeridas': acoesSugeridasIpt(m, 'digital'),
      }
    }

    // Geral: panorama completo (todas as lentes).
    const evolucaoLente: IptEvolucao = evolucaoDaLente(m, null)
    return {
      ...base,
      'Sinal visitas': labelSinal(m.sinais.visitas),
      'Visitas 0–30d': m.detalhes.visitasNoPeriodo,
      'Visitas 31–60d': m.detalhes.visitasPeriodoAnterior,
      'Visitas histórico': m.detalhes.visitasHistorico,
      'Evolução visitas': iptEvolucaoLabel(m.evolucao.visitas),
      'Sinal obras': labelSinal(m.sinais.obras),
      'Qtd obras': m.detalhes.obrasQuantidade,
      'Valor obras (R$)': formatMoney(m.detalhes.obrasValorTotal),
      'Sinal pesquisa': labelSinal(m.sinais.pesquisa),
      'Posição top 5': m.detalhes.pesquisaPosicaoTop5 ?? '',
      'Média intenção %': formatPct(m.detalhes.pesquisaMediaPct),
      'Intenção recente %': formatPct(m.detalhes.pesquisaRecentePct),
      'Intenção anterior %': formatPct(m.detalhes.pesquisaAnteriorPct),
      'Delta pp': formatPct(m.detalhes.pesquisaDeltaPp),
      'Base pesquisa': m.detalhes.pesquisaBase ?? '',
      'Evolução pesquisa': iptEvolucaoLabel(m.evolucao.pesquisa),
      'Sinal digital': labelSinal(m.sinais.digital),
      Seguidores: m.detalhes.digitalSeguidores ?? '',
      'Seguidores %': formatPct(m.detalhes.digitalSeguidoresPct, 2),
      'Contas engajadas': m.detalhes.digitalContasEngajadas ?? '',
      'Evolução digital': iptEvolucaoLabel(m.evolucao.digitalSeguidores),
      'Evolução (lente)': iptEvolucaoLabel(evolucaoLente),
      'Ações sugeridas': acoesSugeridasIpt(m, 'geral'),
    }
  })
}

function observacaoExport(filtros: IptExportFiltros): string {
  if (filtros.indicador === 'visitas') {
    return 'Colunas só da lente Visitas. Use para priorizar roteiro de campo.'
  }
  if (filtros.indicador === 'pesquisa') {
    return 'Colunas só da lente Pesquisa. Use para definir onde refazer intenção de votos.'
  }
  if (filtros.indicador === 'obras') {
    return 'Colunas só da lente Obras (cobertura e valor destinado).'
  }
  if (filtros.indicador === 'digital') {
    return 'Colunas só da lente Digital (presença Instagram por município).'
  }
  return 'Visão geral: todas as lentes. Para foco operacional, exporte com a lente Visitas ou Pesquisa ativa.'
}

function buildFiltrosSheet(
  filtros: IptExportFiltros,
  totalLinhas: number
): Record<string, string | number>[] {
  return [
    { Campo: 'Gerado em', Valor: new Date().toLocaleString('pt-BR') },
    { Campo: 'Municípios exportados', Valor: totalLinhas },
    {
      Campo: 'Escopo territorial',
      Valor: filtros.td ? filtros.td : 'Piauí (todos)',
    },
    {
      Campo: 'Diagnóstico',
      Valor: filtros.prioridade ? labelPrioridade(filtros.prioridade) : 'Todos',
    },
    { Campo: 'Lente / status', Valor: labelIndicador(filtros.indicador) },
    { Campo: 'Evolução', Valor: labelEvolucaoFiltro(filtros.evolucao) },
    { Campo: 'Observação', Valor: observacaoExport(filtros) },
  ]
}

/** Exporta Excel (.xlsx) com as linhas do mapa filtrado. */
export function exportarIptExcel(
  municipios: IptMunicipio[],
  filtros: IptExportFiltros
): void {
  const rows = buildIptExportRows(municipios, filtros)
  const wsDados = XLSX.utils.json_to_sheet(
    rows.length
      ? rows
      : [{ Município: 'Nenhum município com os filtros atuais', Diagnóstico: '' }]
  )
  const wsFiltros = XLSX.utils.json_to_sheet(buildFiltrosSheet(filtros, rows.length))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsDados, 'Municípios')
  XLSX.utils.book_append_sheet(wb, wsFiltros, 'Filtros aplicados')
  XLSX.writeFile(wb, nomeArquivoIptExport(filtros))
}
