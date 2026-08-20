import {
  emendaEstaPaga,
  filtrarEmendasPorMunicipio,
  totaisEmendas,
  type EmendaRegistro,
} from '@/lib/emendas-filtro'
import { agruparEmendasPorExercicio } from '@/lib/ficha-lideranca-resumo'
import { normalizeIptMunicipio } from '@/lib/ipt'
import {
  anoFromDataDemanda,
  groupObrasByTipoSortedByStatus,
  type BlocoObrasPorTipo,
} from '@/lib/mapa-obras-lista-tipo'
import {
  classificarObraFase,
  isObraLinhaTotalPlanilha,
  valorExibidoMapaObra,
  type ObraFaseMapa,
  type ObraMapaRow,
} from '@/lib/obras-mapa'

export type RelatorioEmendaStatus = 'PAGO' | 'EMPENHADO' | 'INDICADO'

export type RelatorioEmendaLinha = {
  id: string
  exercicio: number | null
  emenda: string
  objeto: string
  indicado: number
  empenhado: number
  pago: number
  status: RelatorioEmendaStatus
}

export type RelatorioStatusValor = {
  status: string
  valor: number
  count: number
}

export type RelatorioAnoBloco = {
  ano: number | string
  emendasTotal: number
  emendasPorStatus: RelatorioStatusValor[]
  emendasSemRegistro: boolean
  obrasTotal: number
  obrasPorStatus: RelatorioStatusValor[]
  obrasSemValor: boolean
}

export type RelatorioObraFaseKpis = {
  registros: number
  valorMapeado: number
  acoesExecutadas: number
  emExecucao: number
  aguardando: number
}

export type RelatorioLeituraRapida = {
  id: string
  titulo: string
  texto: string
}

export type RelatorioAcervoItem = {
  /** ID persistido em `relatorio_executivo_acervo` (se já salvo). */
  id: string | null
  /** Obra vinculada (quando o item veio do Bloco 02). */
  obraId: string | null
  titulo: string
  status: string
  /** URL do repositório (Drive/pasta) — clicável no PDF. */
  driveUrl: string | null
  /** Texto do link no PDF / botão. */
  driveName: string | null
}

export type RelatorioExecutivoMunicipio = {
  municipio: string
  emendasTotalIndicado: number
  emendasCount: number
  obrasValorMapeado: number
  obrasCount: number
  porAno: RelatorioAnoBloco[]
  emendas: RelatorioEmendaLinha[]
  emendasTotais: {
    indicado: number
    empenhado: number
    pago: number
  }
  leiturasRapidas: RelatorioLeituraRapida[]
  obrasKpis: RelatorioObraFaseKpis
  obrasPorTipo: Array<
    BlocoObrasPorTipo & {
      valor: number
      count: number
    }
  >
  acervo: RelatorioAcervoItem[]
}

export function statusEmendaRelatorio(r: EmendaRegistro): RelatorioEmendaStatus {
  if (emendaEstaPaga(r)) return 'PAGO'
  const emp = Number(r.valor_empenhado)
  if (Number.isFinite(emp) && emp > 0) return 'EMPENHADO'
  return 'INDICADO'
}

function valorNum(n: number | null | undefined): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

function labelFaseObra(fase: ObraFaseMapa, statusRaw: string | null | undefined): string {
  const raw = (statusRaw ?? '').trim()
  if (raw) return raw.toUpperCase()
  if (fase === 'finalizada') return 'AÇÃO EXECUTADA'
  if (fase === 'em_andamento') return 'OBRA EM EXECUÇÃO'
  if (fase === 'a_iniciar') return 'AGUARDANDO'
  return 'OUTROS'
}

function pushStatusValor(
  map: Map<string, RelatorioStatusValor>,
  status: string,
  valor: number,
) {
  const key = status || 'SEM STATUS'
  const cur = map.get(key) ?? { status: key, valor: 0, count: 0 }
  cur.valor += valor
  cur.count += 1
  map.set(key, cur)
}

/** Glossário fixo do Bloco 01 (modelo Relatório Executivo). */
const LEITURAS_RAPIDAS_BLOCO_01: RelatorioLeituraRapida[] = [
  {
    id: 'pap',
    titulo: 'PAP',
    texto:
      'Custeio da Atenção Primária: mantém e fortalece os serviços da rede básica de saúde.',
  },
  {
    id: 'mac',
    titulo: 'MAC',
    texto: 'Média e Alta Complexidade: serviços especializados e hospitalares.',
  },
  {
    id: 'custeio',
    titulo: 'CUSTEIO',
    texto:
      'Mantém serviços e políticas funcionando. Não significa, sozinho, obra ou bem permanente.',
  },
  {
    id: 'investimento',
    titulo: 'INVESTIMENTO',
    texto: 'Estrutura, obra e bens permanentes conforme o objeto aprovado.',
  },
]

/** Termos do Bloco 01 — glossário do modelo (PAP · MAC · CUSTEIO · INVESTIMENTO). */
export function leiturasRapidasDeEmendas(
  emendas: EmendaRegistro[],
): RelatorioLeituraRapida[] {
  if (emendas.length === 0) return []
  return [...LEITURAS_RAPIDAS_BLOCO_01]
}

export type PlanoDriveLinkLite = {
  obra_id: string
  drive_web_view_link?: string | null
  drive_file_name?: string | null
}

export type RelatorioAcervoSalvoLite = {
  id: string
  obra_id: string | null
  titulo: string
  status: string
  url: string
  label: string | null
}

/**
 * Monta o modelo do Relatório Executivo municipal
 * (capa + emendas + obras + acervo), sem somar emendas com obras.
 */
export function buildRelatorioExecutivoMunicipio(input: {
  municipio: string
  emendas: EmendaRegistro[]
  obras: ObraMapaRow[]
  planosDrive?: PlanoDriveLinkLite[]
  acervoSalvo?: RelatorioAcervoSalvoLite[]
}): RelatorioExecutivoMunicipio | null {
  const municipio = input.municipio.trim()
  if (!municipio) return null

  const key = normalizeIptMunicipio(municipio)
  const emendasMun = filtrarEmendasPorMunicipio(input.emendas, municipio)
  const obrasMun = input.obras
    .filter((o) => normalizeIptMunicipio(o.municipio ?? '') === key)
    .filter((o) => !isObraLinhaTotalPlanilha(o))

  const totaisE = totaisEmendas(emendasMun)
  const obrasValorMapeado = obrasMun.reduce(
    (s, o) => s + (valorExibidoMapaObra(o) ?? 0),
    0,
  )

  const emendasLinhas: RelatorioEmendaLinha[] = emendasMun
    .map((e) => ({
      id: e.id,
      exercicio: e.exercicio,
      emenda: e.emenda?.trim() || '—',
      objeto: e.objeto?.trim() || '—',
      indicado: valorNum(e.valor_indicado),
      empenhado: valorNum(e.valor_empenhado),
      pago: valorNum(e.valor_pago),
      status: statusEmendaRelatorio(e),
    }))
    .sort((a, b) => {
      const ya = a.exercicio ?? 0
      const yb = b.exercicio ?? 0
      if (yb !== ya) return yb - ya
      return b.indicado - a.indicado
    })

  // —— Por ano (emendas e obras separados) ——
  const anos = new Set<number | string>()
  const emPorAno = agruparEmendasPorExercicio(emendasMun)
  for (const bloco of emPorAno) anos.add(bloco.exercicio)

  const obrasPorAno = new Map<string, ObraMapaRow[]>()
  for (const obra of obrasMun) {
    const ano = anoFromDataDemanda(obra.data_demanda)
    const k = ano === '—' ? 'Sem ano' : ano
    anos.add(k === 'Sem ano' ? k : Number(k) || k)
    const list = obrasPorAno.get(k) ?? []
    list.push(obra)
    obrasPorAno.set(k, list)
  }

  const anosOrdenados = [...anos].sort((a, b) => {
    const na = typeof a === 'number' ? a : Number(a)
    const nb = typeof b === 'number' ? b : Number(b)
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
    if (Number.isFinite(na)) return -1
    if (Number.isFinite(nb)) return 1
    return String(a).localeCompare(String(b), 'pt-BR')
  })

  const porAno: RelatorioAnoBloco[] = anosOrdenados.map((ano) => {
    const exNum = typeof ano === 'number' ? ano : Number(ano)
    const emAno = Number.isFinite(exNum)
      ? emPorAno.find((b) => b.exercicio === exNum)
      : undefined
    const emStatusMap = new Map<string, RelatorioStatusValor>()
    for (const e of emAno?.itens ?? []) {
      pushStatusValor(emStatusMap, statusEmendaRelatorio(e), valorNum(e.valor_indicado))
    }

    const anoKey = typeof ano === 'number' ? String(ano) : String(ano)
    const obrasAno = obrasPorAno.get(anoKey === 'Sem ano' ? 'Sem ano' : anoKey) ?? []
    const obStatusMap = new Map<string, RelatorioStatusValor>()
    let obrasTotal = 0
    let temValor = false
    for (const o of obrasAno) {
      const fase = classificarObraFase(o.status)
      const label = labelFaseObra(fase, o.status)
      const valor = valorExibidoMapaObra(o)
      if (valor != null && valor > 0) {
        temValor = true
        obrasTotal += valor
        pushStatusValor(obStatusMap, label, valor)
      } else {
        pushStatusValor(obStatusMap, label || 'SEM VALOR', 0)
      }
    }

    return {
      ano,
      emendasTotal: emAno?.valorIndicado ?? 0,
      emendasPorStatus: [...emStatusMap.values()].sort((a, b) => b.valor - a.valor),
      emendasSemRegistro: !emAno || emAno.itens.length === 0,
      obrasTotal,
      obrasPorStatus: [...obStatusMap.values()].sort((a, b) => b.valor - a.valor),
      obrasSemValor: obrasAno.length > 0 && !temValor,
    }
  })

  let acoesExecutadas = 0
  let emExecucao = 0
  let aguardando = 0
  for (const o of obrasMun) {
    const fase = classificarObraFase(o.status)
    if (fase === 'finalizada') acoesExecutadas += 1
    else if (fase === 'em_andamento') emExecucao += 1
    else aguardando += 1
  }

  const obrasPorTipo = groupObrasByTipoSortedByStatus(obrasMun).map((bloco) => ({
    ...bloco,
    count: bloco.obras.length,
    valor: bloco.obras.reduce((s, o) => s + (valorExibidoMapaObra(o) ?? 0), 0),
  }))

  const planosByObra = new Map(
    (input.planosDrive ?? []).map((p) => [p.obra_id, p] as const),
  )
  const salvos = input.acervoSalvo ?? []
  const salvosByObra = new Map(
    salvos
      .filter((s) => s.obra_id?.trim())
      .map((s) => [s.obra_id!.trim(), s] as const),
  )
  const salvosLivres = salvos.filter((s) => !s.obra_id?.trim())

  const acervoBase: RelatorioAcervoItem[] = obrasMun
    .filter((o) => {
      const fase = classificarObraFase(o.status)
      return (
        fase === 'finalizada' ||
        planosByObra.has(o.id) ||
        salvosByObra.has(o.id)
      )
    })
    .map((o) => {
      const plano = planosByObra.get(o.id)
      const salvo = salvosByObra.get(o.id)
      const driveUrl =
        salvo?.url?.trim() ||
        plano?.drive_web_view_link?.trim() ||
        null
      const driveName =
        salvo?.label?.trim() ||
        plano?.drive_file_name?.trim() ||
        (driveUrl ? 'Abrir repositório' : null)
      return {
        id: salvo?.id ?? null,
        obraId: o.id,
        titulo: salvo?.titulo?.trim() || o.obra?.trim() || o.tipo?.trim() || 'Registro',
        status:
          salvo?.status?.trim() ||
          labelFaseObra(classificarObraFase(o.status), o.status),
        driveUrl,
        driveName,
      }
    })

  const acervoManuais: RelatorioAcervoItem[] = salvosLivres.map((s) => ({
    id: s.id,
    obraId: null,
    titulo: s.titulo.trim() || 'Acervo',
    status: s.status.trim() || 'ACERVO',
    driveUrl: s.url.trim() || null,
    driveName: s.label?.trim() || 'Abrir repositório',
  }))

  const acervo: RelatorioAcervoItem[] = [...acervoBase, ...acervoManuais].sort(
    (a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'),
  )

  return {
    municipio,
    emendasTotalIndicado: totaisE.valorIndicado,
    emendasCount: emendasMun.length,
    obrasValorMapeado,
    obrasCount: obrasMun.length,
    porAno,
    emendas: emendasLinhas,
    emendasTotais: {
      indicado: totaisE.valorIndicado,
      empenhado: totaisE.valorEmpenhado,
      pago: totaisE.valorPago,
    },
    leiturasRapidas: leiturasRapidasDeEmendas(emendasMun),
    obrasKpis: {
      registros: obrasMun.length,
      valorMapeado: obrasValorMapeado,
      acoesExecutadas,
      emExecucao,
      aguardando,
    },
    obrasPorTipo,
    acervo,
  }
}

export function formatRelatorioBrl(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatRelatorioBrlCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return 'SEM VALOR'
  return formatRelatorioBrl(n)
}
