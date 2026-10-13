import type { CandidatoFotoDivulgacand, CargoFotoCandidato } from '@/lib/candidatos-foto-divulgacand'
import type { ModalidadeLimite } from '@/lib/emenda-modalidade'
import type { PropostaFns } from '@/lib/fns-tetos-saldo'
import type { LimitesMunicipioResponse, SuasFaixaPorte } from '@/lib/limites-tetos-types'
import type { MunicipioPopulacao } from '@/lib/populacao-ibge-local'
import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'

export type EmendaSuas = {
  id: string
  municipio: string
  tipo_proposta: string
  tipo_recurso: string
  valor_proposta: number
  valor_pagar: number
  created_at?: string
  updated_at?: string
}

export type EmendaSuasForm = Omit<EmendaSuas, 'id'> & { id?: string }

async function lerJson(res: Response): Promise<Record<string, unknown>> {
  const json: unknown = await res.json().catch(() => null)
  return json && typeof json === 'object' ? (json as Record<string, unknown>) : {}
}

function erroDe(json: Record<string, unknown>, padrao: string): Error {
  return new Error(typeof json.error === 'string' ? json.error : padrao)
}

const lista = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

async function putJson(url: string, body: unknown, erroPadrao: string): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw erroDe(await lerJson(res), erroPadrao)
}

/* Municípios, exercício e população */

/** Municípios com tetos cadastrados; cai para a lista de limites se o FNS não responder. */
export async function fetchMunicipiosFicha(): Promise<string[]> {
  try {
    const json = await lerJson(await fetch('/api/consultar-tetos?only_municipios=true'))
    const municipios = lista<string>(json.municipios)
    if (municipios.length > 0) return municipios
  } catch {
    /* segue para o fallback */
  }
  try {
    return lista<string>((await lerJson(await fetch('/api/limites-tetos'))).municipios)
  } catch {
    return []
  }
}

export async function fetchExercicioAtivo(): Promise<number | null> {
  const json = await lerJson(await fetch('/api/limites-tetos?config=true'))
  return typeof json.exercicio_ativo === 'number' ? json.exercicio_ativo : null
}

export async function fetchPopulacaoIbge(): Promise<MunicipioPopulacao[]> {
  const res = await fetch('/populacaoibge.json')
  const json: unknown = await res.json()
  return lista<MunicipioPopulacao>(json)
}

/* Limites MAC/PAP e faixas SUAS */

export async function fetchLimitesMunicipio(
  municipio: string,
  exercicio?: number,
): Promise<LimitesMunicipioResponse> {
  const params = new URLSearchParams({ municipio })
  if (exercicio) params.set('exercicio', String(exercicio))
  const res = await fetch(`/api/limites-tetos?${params}`)
  const json = await lerJson(res)
  if (!res.ok) throw erroDe(json, 'Erro ao carregar limites')
  return json as unknown as LimitesMunicipioResponse
}

export async function fetchFaixasSuas(exercicio: number): Promise<SuasFaixaPorte[] | null> {
  const json = await lerJson(await fetch(`/api/limites-tetos?faixas_suas=true&exercicio=${exercicio}`))
  return Array.isArray(json.faixas) ? (json.faixas as SuasFaixaPorte[]) : null
}

export function salvarExercicioAtivo(exercicio: number): Promise<void> {
  return putJson('/api/limites-tetos', { tipo: 'exercicio_ativo', exercicio }, 'Erro ao salvar exercício')
}

export function salvarLimite(dados: {
  tipo: 'pap' | 'mac'
  modalidade: ModalidadeLimite
  exercicio: number
  municipio: string
  valor: number
}): Promise<void> {
  return putJson(
    '/api/limites-tetos',
    dados,
    `Erro ao salvar ${dados.tipo.toUpperCase()} ${dados.modalidade}`,
  )
}

export function salvarFaixasSuas(exercicio: number, faixas: SuasFaixaPorte[]): Promise<void> {
  return putJson('/api/limites-tetos', { tipo: 'suas_faixas', exercicio, faixas }, 'Erro ao salvar faixas SUAS')
}

export async function importarLimitesJson(exercicio: number): Promise<void> {
  const res = await fetch(`/api/limites-tetos?importar=true&exercicio=${encodeURIComponent(String(exercicio))}`)
  if (!res.ok) throw erroDe(await lerJson(res), 'Erro na importação')
}

/* Propostas FNS e lançamentos SUAS */

export async function fetchPropostasFns(municipio: string, ano: number): Promise<PropostaFns[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30_000)
  try {
    const res = await fetch(
      `/api/consultar-tetos?municipio=${encodeURIComponent(municipio)}&ano=${ano}`,
      { signal: controller.signal },
    )
    const json = await lerJson(res)
    if (!res.ok) {
      if (res.status === 504) throw new Error('A consulta demorou demais. Tente novamente em instantes.')
      throw erroDe(json, `Erro ${res.status}`)
    }
    return lista<PropostaFns>(json.propostas)
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('Consulta cancelada por tempo limite.')
    throw e
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function fetchEmendasSuas(municipio: string): Promise<EmendaSuas[]> {
  const res = await fetch(`/api/emendas-suas?municipio=${encodeURIComponent(municipio)}`)
  if (!res.ok) return []
  return lista<EmendaSuas>((await lerJson(res)).emendas)
}

export async function salvarEmendaSuas(form: EmendaSuasForm): Promise<void> {
  const res = await fetch('/api/emendas-suas', {
    method: form.id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(form),
  })
  if (!res.ok) throw erroDe(await lerJson(res), 'Erro ao salvar')
}

export async function excluirEmendaSuas(id: string): Promise<void> {
  const res = await fetch(`/api/emendas-suas?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw erroDe(await lerJson(res), 'Erro ao excluir')
}

/* Resultados eleitorais e fotos DivulgaCand */

export async function fetchResultadosEleicaoCidade(
  cidade: string,
): Promise<{ cidade: string; resultados: ResultadoEleicao[] }> {
  const res = await fetch(`/api/resumo-eleicoes?cidade=${encodeURIComponent(cidade)}`)
  const json = await lerJson(res)
  if (!res.ok) throw erroDe(json, 'Erro ao buscar resultados eleitorais')
  return {
    cidade: typeof json.cidade === 'string' ? json.cidade : cidade,
    resultados: lista<ResultadoEleicao>(json.resultados),
  }
}

export async function fetchFotosCandidatos(
  municipio: string,
  cargo?: CargoFotoCandidato,
): Promise<CandidatoFotoDivulgacand[]> {
  const params = new URLSearchParams({ municipio, ano: '2024' })
  if (cargo) params.set('cargo', cargo)
  try {
    const res = await fetch(`/api/candidatos-foto-divulgacand?${params}`)
    if (!res.ok) return []
    return lista<CandidatoFotoDivulgacand>((await lerJson(res)).fotos)
  } catch {
    return []
  }
}

export function salvarFotoCandidato(dados: {
  municipio: string
  cargo: CargoFotoCandidato
  numero_urna: string
  nome_urna: string
  url_imagem: string
  url_divulgacand: string | null
}): Promise<void> {
  return putJson('/api/candidatos-foto-divulgacand', { ...dados, ano_eleicao: 2024 }, 'Erro ao salvar')
}

export async function excluirFotoCandidato(id: string): Promise<void> {
  const res = await fetch(`/api/candidatos-foto-divulgacand?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok) throw erroDe(await lerJson(res), 'Erro ao remover')
}
