import {
  avaliarRelevanciaPiaui,
  classificarArea,
  type ExpiracaoProg,
  type OportunidadeFederal,
} from '@/lib/oportunidades-federais'

const BASE = 'https://api-publica.transferegov.gestao.gov.br/discricionarias'
const UF_PADRAO = 'PI'
const QUALIFICACAO = 'Proposta Voluntária'
const SITUACAO = 'DISPONIBILIZADO'

const EXPIRACOES_ATIVAS: ExpiracaoProg[] = [
  'EXPIRACAO_PROG_MUITO_PROX',
  'EXPIRACAO_PROG_PROX',
  'EXPIRACAO_PROG_DISTANTE',
]

type ProgramaRaw = {
  id_programa?: number | null
  cod_orgao_sup_programa?: string | null
  desc_orgao_sup_programa?: string | null
  orgao_executor?: string | null
  cod_programa?: string | null
  ano_programa?: string | null
  nome_programa?: string | null
  acao_orcamentaria?: string | null
  sit_programa?: string | null
  data_disponibilizacao?: string | null
  ano_disponibilizacao?: string | null
  dt_prog_ini_receb_prop?: string | null
  dt_prog_fim_receb_prop?: string | null
  expiracao_prog_prop_voluntaria?: string | null
  descricao?: string | null
  observacao?: string | null
  criterios_de_selecao?: string | null
  chamamento_projeto?: string | null
  emenda?: string | null
  modalidade_programa?: string | null
  natureza_juridica_programa?: string | null
  uf_programa?: string | null
  qualificacao_proposta?: string | null
}

type Pagina = {
  data?: ProgramaRaw[]
  total_pages?: number
  total_items?: number
  page_number?: number
  page_size?: number
}

function texto(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length ? s : null
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

export function mapearProgramaRaw(raw: ProgramaRaw): OportunidadeFederal | null {
  const idPrograma = num(raw.id_programa)
  const nome = texto(raw.nome_programa)
  if (idPrograma == null || !nome) return null
  const descricao = texto(raw.descricao)
  const observacao = texto(raw.observacao)
  const criteriosSelecao = texto(raw.criterios_de_selecao)
  const blobArea = [nome, descricao, raw.desc_orgao_sup_programa, raw.orgao_executor, raw.acao_orcamentaria]
    .filter(Boolean)
    .join(' ')
  const relevancia = avaliarRelevanciaPiaui(nome, descricao, observacao, criteriosSelecao)
  return {
    idPrograma,
    codPrograma: texto(raw.cod_programa),
    nome,
    descricao,
    observacao,
    criteriosSelecao,
    orgaoSuperior: texto(raw.desc_orgao_sup_programa),
    codOrgaoSuperior: texto(raw.cod_orgao_sup_programa),
    orgaoExecutor: texto(raw.orgao_executor),
    acaoOrcamentaria: texto(raw.acao_orcamentaria),
    situacao: texto(raw.sit_programa),
    modalidade: texto(raw.modalidade_programa),
    qualificacaoProposta: texto(raw.qualificacao_proposta),
    naturezaJuridica: texto(raw.natureza_juridica_programa),
    uf: texto(raw.uf_programa),
    area: classificarArea(blobArea),
    dataDisponibilizacao: texto(raw.data_disponibilizacao),
    dtIniRecebProp: texto(raw.dt_prog_ini_receb_prop),
    dtFimRecebProp: texto(raw.dt_prog_fim_receb_prop),
    expiracaoProp: texto(raw.expiracao_prog_prop_voluntaria),
    chamamentoProjeto: texto(raw.chamamento_projeto),
    fonte: 'transferegov',
    relevantePi: relevancia.relevante,
    motivoForaPi: relevancia.motivoFora,
  }
}

async function buscarPagina(params: URLSearchParams): Promise<Pagina> {
  const url = `${BASE}/todos-programas?${params.toString()}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'CockpitX/oportunidades-federais' },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Transferegov ${res.status}: falha ao consultar programas`)
  }
  return (await res.json()) as Pagina
}

/** Busca todas as páginas de um filtro (tamanho máximo razoável). */
async function buscarTodas(paramsBase: Record<string, string>, tamanho = 100): Promise<ProgramaRaw[]> {
  const out: ProgramaRaw[] = []
  let pagina = 1
  let totalPages = 1
  do {
    const params = new URLSearchParams({
      ...paramsBase,
      pagina: String(pagina),
      tamanho_da_pagina: String(tamanho),
    })
    const json = await buscarPagina(params)
    const lote = Array.isArray(json.data) ? json.data : []
    out.push(...lote)
    totalPages = Math.max(1, Number(json.total_pages) || 1)
    pagina += 1
    if (pagina > 40) break // segurança
  } while (pagina <= totalPages)
  return out
}

export async function fetchDataAtualizacaoTransferegov(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/data-atualizacao`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = (await res.json()) as { data_ultima_atualizacao?: string }
    return json.data_ultima_atualizacao ?? null
  } catch {
    return null
  }
}

/**
 * Programas discricionários abertos a proposta voluntária no PI
 * (situação DISPONIBILIZADO, prazo ainda não expirado).
 */
export async function fetchProgramasAbertosPI(): Promise<{
  itens: OportunidadeFederal[]
  excluidosForaPi: number
  fonteAtualizacao: string | null
}> {
  const brutos: ProgramaRaw[] = []
  for (const exp of EXPIRACOES_ATIVAS) {
    const lote = await buscarTodas({
      sit_programa: SITUACAO,
      uf_programa: UF_PADRAO,
      qualificacao_proposta: QUALIFICACAO,
      expiracao_prog_prop_voluntaria: String(exp),
    })
    brutos.push(...lote)
  }

  const porId = new Map<number, OportunidadeFederal>()
  for (const raw of brutos) {
    const item = mapearProgramaRaw(raw)
    if (!item) continue
    if (item.expiracaoProp === 'PROG_EXPIRADO') continue
    if (!porId.has(item.idPrograma)) porId.set(item.idPrograma, item)
  }

  const todos = [...porId.values()]
  const itens = todos
    .filter((i) => i.relevantePi !== false)
    .sort((a, b) => {
      const da = a.dtFimRecebProp ?? '9999-99-99'
      const db = b.dtFimRecebProp ?? '9999-99-99'
      return da.localeCompare(db) || a.nome.localeCompare(b.nome, 'pt-BR')
    })

  return {
    itens,
    excluidosForaPi: todos.filter((i) => i.relevantePi === false).length,
    fonteAtualizacao: await fetchDataAtualizacaoTransferegov(),
  }
}

export function oportunidadeParaLinhaDb(o: OportunidadeFederal) {
  return {
    id_programa: o.idPrograma,
    cod_programa: o.codPrograma,
    nome_programa: o.nome,
    descricao: o.descricao,
    observacao: o.observacao,
    criterios_selecao: o.criteriosSelecao,
    orgao_superior: o.orgaoSuperior,
    cod_orgao_superior: o.codOrgaoSuperior,
    orgao_executor: o.orgaoExecutor,
    acao_orcamentaria: o.acaoOrcamentaria,
    situacao: o.situacao,
    modalidade: o.modalidade,
    qualificacao_proposta: o.qualificacaoProposta,
    natureza_juridica: o.naturezaJuridica,
    uf: o.uf,
    area: o.area,
    data_disponibilizacao: o.dataDisponibilizacao,
    ano_disponibilizacao: o.dataDisponibilizacao?.slice(0, 4) ?? null,
    dt_ini_receb_prop: o.dtIniRecebProp,
    dt_fim_receb_prop: o.dtFimRecebProp,
    expiracao_prop: o.expiracaoProp,
    chamamento_projeto: o.chamamentoProjeto,
    emenda_flag: '0',
    fonte: o.fonte,
    synced_at: new Date().toISOString(),
  }
}

export function linhaDbParaOportunidade(row: Record<string, unknown>): OportunidadeFederal {
  const nome = String(row.nome_programa ?? '')
  const descricao = (row.descricao as string | null) ?? null
  const observacao = (row.observacao as string | null) ?? null
  const criteriosSelecao = (row.criterios_selecao as string | null) ?? null
  const relevancia = avaliarRelevanciaPiaui(nome, descricao, observacao, criteriosSelecao)
  return {
    idPrograma: Number(row.id_programa),
    codPrograma: (row.cod_programa as string | null) ?? null,
    nome,
    descricao,
    observacao,
    criteriosSelecao,
    orgaoSuperior: (row.orgao_superior as string | null) ?? null,
    codOrgaoSuperior: (row.cod_orgao_superior as string | null) ?? null,
    orgaoExecutor: (row.orgao_executor as string | null) ?? null,
    acaoOrcamentaria: (row.acao_orcamentaria as string | null) ?? null,
    situacao: (row.situacao as string | null) ?? null,
    modalidade: (row.modalidade as string | null) ?? null,
    qualificacaoProposta: (row.qualificacao_proposta as string | null) ?? null,
    naturezaJuridica: (row.natureza_juridica as string | null) ?? null,
    uf: (row.uf as string | null) ?? null,
    area: String(row.area ?? 'outros'),
    dataDisponibilizacao: (row.data_disponibilizacao as string | null) ?? null,
    dtIniRecebProp: (row.dt_ini_receb_prop as string | null) ?? null,
    dtFimRecebProp: (row.dt_fim_receb_prop as string | null) ?? null,
    expiracaoProp: (row.expiracao_prop as string | null) ?? null,
    chamamentoProjeto: (row.chamamento_projeto as string | null) ?? null,
    fonte: String(row.fonte ?? 'transferegov'),
    syncedAt: (row.synced_at as string | null) ?? null,
    relevantePi: relevancia.relevante,
    motivoForaPi: relevancia.motivoFora,
  }
}

/** Mantém só o que faz sentido para o Piauí. */
export function filtrarRelevantesPi(itens: OportunidadeFederal[]): {
  itens: OportunidadeFederal[]
  excluidosForaPi: number
} {
  const relevantes = itens.filter((i) => i.relevantePi !== false)
  return { itens: relevantes, excluidosForaPi: itens.length - relevantes.length }
}
