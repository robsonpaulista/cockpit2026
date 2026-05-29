/** Normaliza itens da API pública do Consulta FNS para exibição na ficha. */

export const URL_CONSULTA_FNS = 'https://consultafns.saude.gov.br/'

export interface FnsPagamento {
  data?: string
  valor?: number
  [key: string]: unknown
}

export interface PropostaFnsCompleta {
  nuProposta: string
  municipio: string
  vlProposta: number
  vlPagar: number
  vlPago: number
  coTipoProposta: string
  dsTipoRecurso: string
  dtCadastramento: string
  dsSituacaoProposta: string
  nuProcesso: string
  constituidoProcesso: boolean
  parlamentares: string[]
  pagamentos: FnsPagamento[]
  linhaPropostas: Record<string, unknown>[]
  nmPrograma?: string
  acao?: string
  urlConsultaFns: string
  exercicio?: number
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function parseNum(v: unknown): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function formatParlamentar(item: unknown): string {
  if (typeof item === 'string') return item.trim()
  const r = asRecord(item)
  const nome = String(r.nome ?? r.noParlamentar ?? r.nomeParlamentar ?? '').trim()
  const partido = String(r.partido ?? r.sgPartido ?? '').trim()
  if (nome && partido) return `${nome} (${partido})`
  return nome || partido || ''
}

function extrairDataPagamentos(pagamentos: FnsPagamento[]): string {
  for (const p of pagamentos) {
    const data = String(p.data ?? p.dtPagamento ?? p.dataPagamento ?? '').trim()
    if (data) return data
  }
  return ''
}

function inferirSituacao(params: {
  dsSituacaoProposta: string
  vlProposta: number
  vlPagar: number
  vlPago: number
  constituidoProcesso: boolean
  nuProcesso: string
}): string {
  if (params.dsSituacaoProposta.trim()) return params.dsSituacaoProposta.trim()
  const { vlProposta, vlPagar, vlPago, constituidoProcesso, nuProcesso } = params
  if (vlProposta > 0 && vlPago >= vlProposta) return 'Pago integral'
  if (vlPago > 0 && vlPago < vlProposta) return 'Pago parcial'
  if (vlPagar > 0) return 'Valor a pagar'
  if (constituidoProcesso) return 'Processo constituído'
  if (nuProcesso && nuProcesso !== 'N/A') return 'Com nº processo'
  return 'Sem processo'
}

function inferirIdentificador(raw: Record<string, unknown>): string {
  const nuProposta = String(raw.nuProposta ?? '').trim()
  if (nuProposta) return nuProposta

  const nuProcesso = String(raw.nuProcesso ?? '').trim()
  if (nuProcesso && nuProcesso !== 'N/A') return nuProcesso

  const tipo = String(raw.coTipoProposta ?? 'Proposta').trim()
  const recurso = String(raw.dsTipoRecurso ?? '').trim()
  if (recurso) return `${tipo} — ${recurso}`
  return tipo || 'Proposta FNS'
}

export function normalizePropostaFns(
  raw: Record<string, unknown>,
  municipio: string,
  exercicio?: number,
): PropostaFnsCompleta {
  const vlProposta = parseNum(raw.vlProposta)
  const vlPagar = parseNum(raw.vlPagar)
  const vlPago = parseNum(raw.vlPago)
  const nuProcesso = String(raw.nuProcesso ?? '').trim() || 'N/A'
  const constituidoProcesso = Boolean(raw.constituidoProcesso)

  const pagamentos = (Array.isArray(raw.pagamentos) ? raw.pagamentos : []).map((p) =>
    asRecord(p),
  ) as FnsPagamento[]

  const parlamentares = (Array.isArray(raw.parlamentares) ? raw.parlamentares : [])
    .map(formatParlamentar)
    .filter(Boolean)

  const linhaPropostas = (Array.isArray(raw.linhaPropostas) ? raw.linhaPropostas : []).map((p) =>
    asRecord(p),
  )

  const dtCadastramento =
    String(raw.dtCadastramento ?? '').trim() || extrairDataPagamentos(pagamentos)

  const dsSituacaoProposta = inferirSituacao({
    dsSituacaoProposta: String(raw.dsSituacaoProposta ?? ''),
    vlProposta,
    vlPagar,
    vlPago,
    constituidoProcesso,
    nuProcesso,
  })

  return {
    nuProposta: inferirIdentificador(raw),
    municipio,
    vlProposta,
    vlPagar,
    vlPago,
    coTipoProposta: String(raw.coTipoProposta ?? ''),
    dsTipoRecurso: String(raw.dsTipoRecurso ?? ''),
    dtCadastramento,
    dsSituacaoProposta,
    nuProcesso,
    constituidoProcesso,
    parlamentares,
    pagamentos,
    linhaPropostas,
    nmPrograma: raw.nmPrograma != null ? String(raw.nmPrograma) : undefined,
    acao: raw.acao != null ? String(raw.acao) : undefined,
    urlConsultaFns: URL_CONSULTA_FNS,
    exercicio,
  }
}
