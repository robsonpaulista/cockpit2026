import type { CamadaMapaPlano } from '@/components/pesquisa/mapa-plano-amostragem'
import type { LocalMapaPlano } from '@/lib/eleitorado-locais-pi'
import type { PlanoAmostragemPublico } from '@/lib/plano-amostragem-publico-types'
import type { SetorMapaPlano } from '@/lib/setores-censitarios-pi'

export type TipoPesquisa = 'estimulada' | 'espontanea'
export type CargoPesquisa = 'dep_estadual' | 'dep_federal' | 'governador' | 'senador' | 'presidente'

export type Pesquisa = {
  id: string
  data: string
  instituto: string
  candidato_nome: string
  tipo: TipoPesquisa
  cargo: CargoPesquisa
  cidade_id?: string | null
  intencao: number
  rejeicao: number
  created_at?: string
  cities?: { id: string; name: string }
}

export type PesquisaForm = Omit<Pesquisa, 'id' | 'created_at' | 'cities'>

export type CidadePesquisa = { id: string; name: string }

export const CARGO_PESQUISA_LABEL: Record<CargoPesquisa, string> = {
  dep_estadual: 'Dep. Estadual',
  dep_federal: 'Dep. Federal',
  governador: 'Governador',
  senador: 'Senador',
  presidente: 'Presidente',
}

export const TIPO_PESQUISA_LABEL: Record<TipoPesquisa, string> = {
  estimulada: 'Estimulada',
  espontanea: 'Espontânea',
}

const PESQUISAS_LIMITE = 5000

async function exigirOk(res: Response, erroPadrao: string): Promise<unknown> {
  const texto = await res.text()
  let json: unknown = null
  try {
    json = texto.trim() ? JSON.parse(texto) : null
  } catch {
    if (!res.ok) throw new Error(erroPadrao)
  }
  if (!res.ok) {
    const erro = json && typeof json === 'object' ? (json as { error?: unknown }).error : null
    throw new Error(typeof erro === 'string' ? erro : erroPadrao)
  }
  return json
}

function enviarJson(url: string, method: 'POST' | 'PUT', body: unknown): Promise<Response> {
  return fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

function ordenarCidades(lista: unknown): CidadePesquisa[] {
  if (!Array.isArray(lista)) return []
  return (lista as CidadePesquisa[]).slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

/* Pesquisas cadastradas */

export async function fetchPesquisas(): Promise<Pesquisa[]> {
  const json = await exigirOk(
    await fetch(`/api/pesquisa?limit=${PESQUISAS_LIMITE}`, { cache: 'no-store' }),
    'Erro ao carregar pesquisas.',
  )
  return Array.isArray(json) ? (json as Pesquisa[]) : []
}

export async function salvarPesquisa(form: PesquisaForm, id?: string): Promise<void> {
  const corpo: PesquisaForm = { ...form, cidade_id: form.cidade_id?.trim() ? form.cidade_id : null }
  const res = id ? await enviarJson(`/api/pesquisa/${id}`, 'PUT', corpo) : await enviarJson('/api/pesquisa', 'POST', corpo)
  await exigirOk(res, 'Erro ao salvar pesquisa.')
}

export async function excluirPesquisa(id: string): Promise<void> {
  await exigirOk(await fetch(`/api/pesquisa/${id}`, { method: 'DELETE' }), 'Erro ao excluir pesquisa.')
}

/** Municípios do Piauí cadastrados; com `sincronizarSeVazio`, importa do IBGE quando a tabela estiver vazia. */
export async function fetchCidadesPesquisa(opcoes: { sincronizarSeVazio?: boolean } = {}): Promise<CidadePesquisa[]> {
  const res = await fetch('/api/campo/cities')
  const lista = res.ok ? ordenarCidades(await res.json()) : []
  if (lista.length > 0 || !opcoes.sincronizarSeVazio) return lista
  const sync = (await exigirOk(
    await fetch('/api/campo/cities/sync', { method: 'POST' }),
    'Erro ao sincronizar municípios.',
  )) as { data?: unknown } | null
  return ordenarCidades(sync?.data)
}

/* Plano de amostragem (Gerar público) */

export type MunicipioPlano = {
  municipio: string
  codigoIbge: string
  populacao: number
}

export type TipoPlanoPesquisa = 'opiniao' | 'eleitoral'

export type PlanoAmostragemMeta = {
  bairrosEncontrados: number
  fonteBairros: string | null
  locaisComGeo: number
  setoresIbge: number
  fonteSetores: string | null
  pesoTerritorial: 'populacao_ibge' | 'eleitorado_tse'
  camadaMapa: CamadaMapaPlano
  modoSetoresPlano: boolean
  mapaReferenciaIbge: boolean
  pesoPorEleitores: boolean
  eleitoradoUrbanoTse: number
  eleitoradoRuralTse: number
  populacaoUrbanaSetor: number
  populacaoRuralSetor: number
}

export type PlanoAmostragemResposta = {
  plano: PlanoAmostragemPublico
  locais: LocalMapaPlano[]
  setores: SetorMapaPlano[]
  meta: PlanoAmostragemMeta
}

export async function fetchMunicipiosPlano(): Promise<MunicipioPlano[]> {
  const json = (await exigirOk(
    await fetch('/api/pesquisa/plano-amostragem?list=municipios'),
    'Falha ao carregar municípios.',
  )) as { municipios?: MunicipioPlano[] } | null
  return json?.municipios ?? []
}

export async function gerarPlanoAmostragem(params: {
  municipio: string
  amostra: number
  tipo: TipoPlanoPesquisa
  entrevistadores: number
  instituto?: string
}): Promise<PlanoAmostragemResposta> {
  const qs = new URLSearchParams({
    municipio: params.municipio,
    n: String(params.amostra),
    tipo: params.tipo,
    entrevistadores: String(params.entrevistadores),
  })
  if (params.instituto?.trim()) qs.set('instituto', params.instituto.trim())
  const json = (await exigirOk(
    await fetch(`/api/pesquisa/plano-amostragem?${qs.toString()}`),
    'Erro ao gerar plano.',
  )) as PlanoAmostragemResposta
  return { ...json, locais: json.locais ?? [], setores: json.setores ?? [] }
}
