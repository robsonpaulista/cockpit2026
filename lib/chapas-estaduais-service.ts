'use client'

import { createClient } from '@/lib/supabase/client'

let _supabaseClient: ReturnType<typeof createClient> | null = null
function getSupabaseClient() {
  if (!_supabaseClient) {
    _supabaseClient = createClient()
  }
  return _supabaseClient
}

const CENARIO_PREFIX = 'estadual_'
const BASE_CENARIO_ID = `${CENARIO_PREFIX}base`
const USER_ID_CACHE_KEY = 'chapas_estaduais_uid'

let _cachedUserId: string | null = null
let _cachedSharedOwnerUserId: string | null = null

function normalizeCenarioId(cenarioId: string): string {
  if (cenarioId === 'base') return BASE_CENARIO_ID
  return cenarioId.startsWith(CENARIO_PREFIX) ? cenarioId : `${CENARIO_PREFIX}${cenarioId}`
}

function assertEstadualScenarioId(cenarioId: string) {
  if (cenarioId === 'base') return
  if (!cenarioId.startsWith(CENARIO_PREFIX) && cenarioId !== BASE_CENARIO_ID) {
    throw new Error('Cenário federal não pode ser carregado no módulo estadual.')
  }
}

function getUserId(): string {
  if (_cachedUserId) return _cachedUserId

  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(USER_ID_CACHE_KEY)
    if (stored) {
      _cachedUserId = stored
      return stored
    }
  }

  throw new Error('Usuário não identificado. Recarregue a página.')
}

// Resolve o "owner" compartilhado da base estadual de chapas.
async function getSharedOwnerUserId(): Promise<string> {
  if (_cachedSharedOwnerUserId) return _cachedSharedOwnerUserId

  const currentUserId = getUserId()
  const supabase = getSupabaseClient()

  const { data: ativo } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .like('id', `${CENARIO_PREFIX}%`)
    .eq('ativo', true)
    .order('atualizado_em', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (ativo?.user_id) {
    _cachedSharedOwnerUserId = ativo.user_id
    return ativo.user_id
  }

  const { data: base } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .eq('id', BASE_CENARIO_ID)
    .limit(1)
    .maybeSingle()

  if (base?.user_id) {
    _cachedSharedOwnerUserId = base.user_id
    return base.user_id
  }

  const { data: first } = await supabase
    .from('chapas_cenarios')
    .select('user_id')
    .like('id', `${CENARIO_PREFIX}%`)
    .order('criado_em', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (first?.user_id) {
    _cachedSharedOwnerUserId = first.user_id
    return first.user_id
  }

  _cachedSharedOwnerUserId = currentUserId
  return currentUserId
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} excedeu ${ms / 1000}s`)), ms)
    ),
  ])
}

export function preWarmUserIdCache(userId: string) {
  if (!userId) return
  _cachedUserId = userId
  _cachedSharedOwnerUserId = null
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(USER_ID_CACHE_KEY, userId)
    } catch {
      // ignore
    }
  }
}

export interface Cenario {
  id: string
  nome: string
  descricao?: string
  tipo: 'base' | 'simulacao'
  criadoEm: string
  atualizadoEm: string
  ativo: boolean
  quocienteEleitoral: number
  votosIgreja?: number
}

export interface CenarioCompleto extends Cenario {
  partidos: PartidoCenario[]
}

export interface PartidoCenario {
  nome: string
  cor: string
  corTexto: string
  candidatos: CandidatoCenario[]
  votosLegenda?: number
}

export interface CandidatoCenario {
  nome: string
  votos: number
  genero?: string
}

export const dadosIniciais: Array<{ partido: string; nome: string; votos: number }> = [
  { partido: 'PT', nome: 'FLAVIO JUNIOR', votos: 60000 },
  { partido: 'PT', nome: 'DR THALES', votos: 55000 },
  { partido: 'PT', nome: 'FIRMINO PAULO', votos: 55000 },
  { partido: 'PT', nome: 'DR VINICIUS', votos: 45000 },
  { partido: 'PT', nome: 'DR GIL CARLOS', votos: 40000 },
  { partido: 'PT', nome: 'FABIO XAVIER', votos: 40000 },
  { partido: 'PT', nome: 'LIMA', votos: 40000 },
  { partido: 'PT', nome: 'NERINHO', votos: 40000 },
  { partido: 'PT', nome: 'RUBENS VIEIRA', votos: 40000 },
  { partido: 'PT', nome: 'FABIO NOVO', votos: 35000 },
  { partido: 'PT', nome: 'HELIO ISAIAS', votos: 35000 },
  { partido: 'PT', nome: 'BRENO MACEDO PV', votos: 30000 },
  { partido: 'PT', nome: 'EVALDO', votos: 30000 },
  { partido: 'PT', nome: 'HELIO RODRIGUES', votos: 25000 },
  { partido: 'PT', nome: 'MAURO EDUARDO', votos: 25000 },
  { partido: 'PT', nome: 'ZIZA PV', votos: 25000 },
  { partido: 'PT', nome: 'MARCOS KALUME', votos: 20000 },
  { partido: 'PT', nome: 'WARTON LACERDA', votos: 15000 },
  { partido: 'PT', nome: 'HOMEM 19', votos: 5000 },
  { partido: 'PT', nome: 'HOMEM 20', votos: 5000 },
  { partido: 'PT', nome: 'HOMEM 21', votos: 5000 },
  { partido: 'PT', nome: 'JANAINA', votos: 50000 },
  { partido: 'PT', nome: 'ELIZANGELA', votos: 20000 },
  { partido: 'PT', nome: 'EUZUILA', votos: 20000 },
  { partido: 'PT', nome: 'TERESA BRITO', votos: 18000 },
  { partido: 'PT', nome: 'MULHER 5', votos: 5000 },
  { partido: 'PT', nome: 'MULHER 6', votos: 3000 },
  { partido: 'PT', nome: 'MULHER 10', votos: 1000 },
  { partido: 'PT', nome: 'MULHER 7', votos: 1000 },
  { partido: 'PT', nome: 'MULHER 8', votos: 1000 },
  { partido: 'PT', nome: 'MULHER 9', votos: 1000 },

  { partido: 'MDB', nome: 'SEVERO', votos: 85000 },
  { partido: 'MDB', nome: 'JULINHO', votos: 55000 },
  { partido: 'MDB', nome: 'JOAO MADSON', votos: 50000 },
  { partido: 'MDB', nome: 'TONINHO CARIDADE', votos: 45000 },
  { partido: 'MDB', nome: 'HENRIQUE PIRES', votos: 40000 },
  { partido: 'MDB', nome: 'THEMISTOCLES', votos: 40000 },
  { partido: 'MDB', nome: 'CORONEL CARLOS AUG', votos: 38000 },
  { partido: 'MDB', nome: 'DR HELIO', votos: 38000 },
  { partido: 'MDB', nome: 'WILSON CAPOTE', votos: 36000 },
  { partido: 'MDB', nome: 'MARDEN', votos: 35000 },
  { partido: 'MDB', nome: 'TIAGO VASCONCELOS', votos: 30000 },
  { partido: 'MDB', nome: 'GD', votos: 25000 },
  { partido: 'MDB', nome: 'AVELAR', votos: 20000 },
  { partido: 'MDB', nome: 'HOMEM 15', votos: 5000 },
  { partido: 'MDB', nome: 'HOMEM 16', votos: 3000 },
  { partido: 'MDB', nome: 'HOMEM 17', votos: 2000 },
  { partido: 'MDB', nome: 'HOMEM 18', votos: 2000 },
  { partido: 'MDB', nome: 'HOMEM 19', votos: 1000 },
  { partido: 'MDB', nome: 'HOMEM 20', votos: 1000 },
  { partido: 'MDB', nome: 'HOMEM 21', votos: 1000 },
  { partido: 'MDB', nome: 'DOGIM FELIX', votos: 1 },
  { partido: 'MDB', nome: 'ANYARA', votos: 55000 },
  { partido: 'MDB', nome: 'ANA PAULA', votos: 40000 },
  { partido: 'MDB', nome: 'SIMONE', votos: 35000 },
  { partido: 'MDB', nome: 'GRACINHA MAO SANTA', votos: 30000 },
  { partido: 'MDB', nome: 'MULHER 10', votos: 1000 },
  { partido: 'MDB', nome: 'MULHER 5', votos: 1000 },
  { partido: 'MDB', nome: 'MULHER 6', votos: 1000 },
  { partido: 'MDB', nome: 'MULHER 7', votos: 1000 },
  { partido: 'MDB', nome: 'MULHER 8', votos: 1000 },
  { partido: 'MDB', nome: 'MULHER 9', votos: 1000 },

  { partido: 'PP', nome: 'GUSTAVO NEIVA', votos: 40000 },
  { partido: 'PP', nome: 'JUNIOR PERCY', votos: 30000 },
  { partido: 'PP', nome: 'PETRUS', votos: 30000 },
  { partido: 'PP', nome: 'ZE FERNANDO', votos: 25000 },
  { partido: 'PP', nome: 'ERIVELTO', votos: 20000 },
  { partido: 'PP', nome: 'SILAS FREIRE', votos: 15000 },
  { partido: 'PP', nome: 'PEDRO ALCANTARA', votos: 10000 },
  { partido: 'PP', nome: 'HOMEM 10', votos: 5000 },
  { partido: 'PP', nome: 'HOMEM 9', votos: 5000 },
  { partido: 'PP', nome: 'ROBERTINHO LEAO', votos: 5000 },
  { partido: 'PP', nome: 'HOMEM 11', votos: 3000 },
  { partido: 'PP', nome: 'HOMEM 12', votos: 3000 },
  { partido: 'PP', nome: 'HOMEM 13', votos: 3000 },
  { partido: 'PP', nome: 'HOMEM 14', votos: 2000 },
  { partido: 'PP', nome: 'HOMEM 15', votos: 1000 },
  { partido: 'PP', nome: 'HOMEM 16', votos: 1000 },
  { partido: 'PP', nome: 'HOMEM 17', votos: 1000 },
  { partido: 'PP', nome: 'HOMEM 18', votos: 1000 },
  { partido: 'PP', nome: 'HOMEM 19', votos: 1000 },
  { partido: 'PP', nome: 'HOMEM 20', votos: 1000 },
  { partido: 'PP', nome: 'HOMEM 21', votos: 1000 },
  { partido: 'PP', nome: 'MULHER 1', votos: 1000 },
  { partido: 'PP', nome: 'MULHER 10', votos: 1000 },
  { partido: 'PP', nome: 'MULHER 2', votos: 1000 },
  { partido: 'PP', nome: 'MULHER 3', votos: 1000 },
  { partido: 'PP', nome: 'MULHER 4', votos: 1000 },
  { partido: 'PP', nome: 'MULHER 5', votos: 1000 },
  { partido: 'PP', nome: 'MULHER 6', votos: 1000 },
  { partido: 'PP', nome: 'MULHER 7', votos: 1000 },
  { partido: 'PP', nome: 'MULHER 8', votos: 1000 },
  { partido: 'PP', nome: 'MULHER 9', votos: 1000 },

  { partido: 'REPUBLICANOS', nome: 'DRAGA ALANA', votos: 35000 },
  { partido: 'REPUBLICANOS', nome: 'DANIEL DA MARINHA', votos: 30000 },
  { partido: 'REPUBLICANOS', nome: 'DOGIM FELIX', votos: 30000 },
  { partido: 'REPUBLICANOS', nome: 'GESSIVALDO', votos: 30000 },
  { partido: 'REPUBLICANOS', nome: 'GENIVAL SALES', votos: 15000 },
  { partido: 'REPUBLICANOS', nome: 'JOAO LUIS MONSENHO', votos: 15000 },
  { partido: 'REPUBLICANOS', nome: 'HILDEN MUNCAO', votos: 5000 },
  { partido: 'REPUBLICANOS', nome: 'IDONEIL MESQUITA', votos: 5000 },
  { partido: 'REPUBLICANOS', nome: 'JOHN WALACY', votos: 5000 },
  { partido: 'REPUBLICANOS', nome: 'PAES LANDIM', votos: 4000 },
  { partido: 'REPUBLICANOS', nome: 'ELIZEU AGUIAR', votos: 3000 },
  { partido: 'REPUBLICANOS', nome: 'LAR DO NANDO', votos: 3000 },
  { partido: 'REPUBLICANOS', nome: 'PASTOR DAIRANA', votos: 3000 },
  { partido: 'REPUBLICANOS', nome: 'WELLINGTON RAULINC', votos: 3000 },
  { partido: 'REPUBLICANOS', nome: 'AMADEU CAMPOS', votos: 2000 },
  { partido: 'REPUBLICANOS', nome: 'DIONISIO', votos: 2000 },
  { partido: 'REPUBLICANOS', nome: 'DOUTOR LAZARO', votos: 2000 },
  { partido: 'REPUBLICANOS', nome: 'PROF WERTON COSTA', votos: 2000 },
  { partido: 'REPUBLICANOS', nome: 'HOMEM 19', votos: 500 },
  { partido: 'REPUBLICANOS', nome: 'HOMEM 20', votos: 500 },
  { partido: 'REPUBLICANOS', nome: 'HOMEM 21', votos: 500 },
  { partido: 'REPUBLICANOS', nome: 'RAIMUNDINHA DA PESC', votos: 5000 },
  { partido: 'REPUBLICANOS', nome: 'ALINE TEIXEIRA', votos: 2000 },
  { partido: 'REPUBLICANOS', nome: 'ANA MELKA', votos: 2000 },
  { partido: 'REPUBLICANOS', nome: 'KARLA BEGER', votos: 2000 },
  { partido: 'REPUBLICANOS', nome: 'PASTORA DIANA', votos: 2000 },
  { partido: 'REPUBLICANOS', nome: 'MULHER 5', votos: 500 },
  { partido: 'REPUBLICANOS', nome: 'MULHER 6', votos: 500 },
  { partido: 'REPUBLICANOS', nome: 'MULHER 7', votos: 500 },
  { partido: 'REPUBLICANOS', nome: 'MULHER 8', votos: 500 },
  { partido: 'REPUBLICANOS', nome: 'MULHER 9', votos: 500 },
]

export async function criarCenarioBase(partidos: PartidoCenario[], quociente: number): Promise<string> {
  const userId = await getSharedOwnerUserId()
  const supabase = getSupabaseClient()

  const { error: cenarioError } = await supabase
    .from('chapas_cenarios')
    .upsert(
      {
        id: BASE_CENARIO_ID,
        user_id: userId,
        nome: 'Cenário Base',
        descricao: 'Estado original das chapas estaduais',
        tipo: 'base',
        criado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
        ativo: true,
        quociente_eleitoral: quociente,
      },
      { onConflict: 'user_id,id' }
    )

  if (cenarioError) throw cenarioError

  const { error: deleteError } = await supabase
    .from('chapas_partidos')
    .delete()
    .eq('user_id', userId)
    .eq('cenario_id', BASE_CENARIO_ID)
  if (deleteError) throw deleteError

  const rows = partidos.flatMap((partido) =>
    partido.candidatos.map((candidato) => ({
      user_id: userId,
      cenario_id: BASE_CENARIO_ID,
      partido_nome: partido.nome,
      cor: partido.cor,
      cor_texto: partido.corTexto,
      votos_legenda: partido.votosLegenda || 0,
      candidato_nome: candidato.nome,
      candidato_votos: candidato.votos,
      candidato_genero: candidato.genero || null,
    }))
  )

  if (rows.length > 0) {
    const { error } = await supabase.from('chapas_partidos').insert(rows)
    if (error) throw error
  }

  return BASE_CENARIO_ID
}

export async function listarCenarios(): Promise<Cenario[]> {
  const userId = await getSharedOwnerUserId()
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('chapas_cenarios')
    .select('id, nome, descricao, tipo, criado_em, atualizado_em, ativo, quociente_eleitoral, votos_igreja')
    .eq('user_id', userId)
    .like('id', `${CENARIO_PREFIX}%`)
    .order('criado_em', { ascending: false })

  if (error) throw error

  return (data || [])
    .map((item) => ({
      id: item.id,
      nome: item.nome,
      descricao: item.descricao,
      tipo: item.tipo,
      criadoEm: item.criado_em,
      atualizadoEm: item.atualizado_em,
      ativo: item.ativo,
      quocienteEleitoral: item.quociente_eleitoral,
      votosIgreja: item.votos_igreja,
    }))
    .sort((a, b) => {
      if (a.id === BASE_CENARIO_ID) return -1
      if (b.id === BASE_CENARIO_ID) return 1
      return 0
    })
}

export async function carregarCenario(cenarioId: string): Promise<CenarioCompleto | null> {
  assertEstadualScenarioId(cenarioId)
  const id = normalizeCenarioId(cenarioId)
  const userId = await getSharedOwnerUserId()
  const supabase = getSupabaseClient()

  const [cenarioResult, partidosResult] = await withTimeout(
    Promise.all([
      supabase
        .from('chapas_cenarios')
        .select('id, nome, descricao, tipo, criado_em, atualizado_em, ativo, quociente_eleitoral, votos_igreja')
        .eq('user_id', userId)
        .eq('id', id)
        .single(),
      supabase
        .from('chapas_partidos')
        .select('partido_nome, cor, cor_texto, votos_legenda, candidato_nome, candidato_votos, candidato_genero')
        .eq('user_id', userId)
        .eq('cenario_id', id)
        .order('partido_nome', { ascending: true })
        .order('candidato_votos', { ascending: false }),
    ]),
    10000,
    `carregar cenário ${id}`
  )

  const { data: cenarioData, error: cenarioError } = cenarioResult
  const { data: partidosData, error: partidosError } = partidosResult

  if (cenarioError) {
    if ((cenarioError as { code?: string }).code === 'PGRST116') return null
    throw cenarioError
  }
  if (!cenarioData) return null
  if (partidosError) throw partidosError

  const partidosMap: Record<string, PartidoCenario> = {}
  partidosData?.forEach((item) => {
    if (!partidosMap[item.partido_nome]) {
      partidosMap[item.partido_nome] = {
        nome: item.partido_nome,
        cor: item.cor,
        corTexto: item.cor_texto,
        candidatos: [],
        votosLegenda: item.votos_legenda || 0,
      }
    }
    partidosMap[item.partido_nome].candidatos.push({
      nome: item.candidato_nome,
      votos: item.candidato_votos,
      genero: item.candidato_genero || undefined,
    })
  })

  return {
    id: cenarioData.id,
    nome: cenarioData.nome,
    descricao: cenarioData.descricao,
    tipo: cenarioData.tipo,
    criadoEm: cenarioData.criado_em,
    atualizadoEm: cenarioData.atualizado_em,
    ativo: cenarioData.ativo,
    quocienteEleitoral: cenarioData.quociente_eleitoral,
    votosIgreja: cenarioData.votos_igreja,
    partidos: Object.values(partidosMap),
  }
}

export async function criarNovoCenario(nome: string, descricao: string, cenarioOrigemId: string): Promise<string> {
  assertEstadualScenarioId(cenarioOrigemId)
  const userId = await getSharedOwnerUserId()
  const supabase = getSupabaseClient()
  const origem = await carregarCenario(cenarioOrigemId)
  if (!origem) throw new Error('Cenário origem não encontrado')

  const novoId = `${CENARIO_PREFIX}cenario_${Date.now()}`

  const { error: cenarioError } = await supabase.from('chapas_cenarios').insert({
    id: novoId,
    user_id: userId,
    nome,
    descricao,
    tipo: 'simulacao',
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
    ativo: true,
    quociente_eleitoral: origem.quocienteEleitoral,
  })
  if (cenarioError) throw cenarioError

  const rows = origem.partidos.flatMap((partido) =>
    partido.candidatos.map((candidato) => ({
      user_id: userId,
      cenario_id: novoId,
      partido_nome: partido.nome,
      cor: partido.cor,
      cor_texto: partido.corTexto,
      votos_legenda: partido.votosLegenda || 0,
      candidato_nome: candidato.nome,
      candidato_votos: candidato.votos,
      candidato_genero: candidato.genero || null,
    }))
  )

  if (rows.length > 0) {
    const { error } = await supabase.from('chapas_partidos').insert(rows)
    if (error) throw error
  }

  return novoId
}

export async function atualizarCenario(cenarioId: string, partidos: PartidoCenario[], quociente: number): Promise<void> {
  assertEstadualScenarioId(cenarioId)
  const id = normalizeCenarioId(cenarioId)
  const userId = await getSharedOwnerUserId()
  const supabase = getSupabaseClient()

  const { error: updateError } = await supabase
    .from('chapas_cenarios')
    .update({
      atualizado_em: new Date().toISOString(),
      quociente_eleitoral: quociente,
    })
    .eq('user_id', userId)
    .eq('id', id)
  if (updateError) throw updateError

  const { error: deleteError } = await supabase
    .from('chapas_partidos')
    .delete()
    .eq('user_id', userId)
    .eq('cenario_id', id)
  if (deleteError) throw deleteError

  const rows = partidos.flatMap((partido) =>
    partido.candidatos.map((candidato) => ({
      user_id: userId,
      cenario_id: id,
      partido_nome: partido.nome,
      cor: partido.cor,
      cor_texto: partido.corTexto,
      votos_legenda: partido.votosLegenda || 0,
      candidato_nome: candidato.nome,
      candidato_votos: candidato.votos,
      candidato_genero: candidato.genero || null,
    }))
  )

  if (rows.length > 0) {
    const { error } = await supabase.from('chapas_partidos').insert(rows)
    if (error) throw error
  }
}

export async function excluirCenario(cenarioId: string): Promise<void> {
  assertEstadualScenarioId(cenarioId)
  const id = normalizeCenarioId(cenarioId)
  if (id === BASE_CENARIO_ID) throw new Error('Não é possível excluir o cenário base')

  const userId = await getSharedOwnerUserId()
  const supabase = getSupabaseClient()

  const { error: deletePartidosError } = await supabase
    .from('chapas_partidos')
    .delete()
    .eq('user_id', userId)
    .eq('cenario_id', id)
  if (deletePartidosError) throw deletePartidosError

  const { error: deleteCenarioError } = await supabase
    .from('chapas_cenarios')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
  if (deleteCenarioError) throw deleteCenarioError
}

export async function ativarCenario(cenarioId: string, ativo: boolean): Promise<void> {
  assertEstadualScenarioId(cenarioId)
  const id = normalizeCenarioId(cenarioId)
  const userId = await getSharedOwnerUserId()
  const supabase = getSupabaseClient()
  const agora = new Date().toISOString()

  if (ativo) {
    const [desativarResult, ativarResult] = await Promise.all([
      supabase
        .from('chapas_cenarios')
        .update({ ativo: false, atualizado_em: agora })
        .eq('user_id', userId)
        .like('id', `${CENARIO_PREFIX}%`)
        .eq('ativo', true)
        .neq('id', id),
      supabase
        .from('chapas_cenarios')
        .update({ ativo: true, atualizado_em: agora })
        .eq('user_id', userId)
        .eq('id', id),
    ])
    if (desativarResult.error) throw desativarResult.error
    if (ativarResult.error) throw ativarResult.error
    return
  }

  const { error } = await supabase
    .from('chapas_cenarios')
    .update({ ativo: false, atualizado_em: agora })
    .eq('user_id', userId)
    .eq('id', id)
  if (error) throw error
}

export async function listarCenariosComAtivo(): Promise<{ cenarios: Cenario[]; cenarioAtivo: CenarioCompleto | null }> {
  const userId = await getSharedOwnerUserId()
  const supabase = getSupabaseClient()

  const [cenariosResult, partidosResult] = await withTimeout(
    Promise.all([
      supabase
        .from('chapas_cenarios')
        .select('id, nome, descricao, tipo, criado_em, atualizado_em, ativo, quociente_eleitoral, votos_igreja')
        .eq('user_id', userId)
        .like('id', `${CENARIO_PREFIX}%`)
        .order('criado_em', { ascending: false }),
      supabase
        .from('chapas_partidos')
        .select('cenario_id, partido_nome, cor, cor_texto, votos_legenda, candidato_nome, candidato_votos, candidato_genero')
        .eq('user_id', userId)
        .like('cenario_id', `${CENARIO_PREFIX}%`)
        .order('partido_nome', { ascending: true })
        .order('candidato_votos', { ascending: false }),
    ]),
    12000,
    'listar cenários estaduais'
  )

  if (cenariosResult.error) throw cenariosResult.error
  if (partidosResult.error) throw partidosResult.error

  const cenarios = (cenariosResult.data || [])
    .map((item) => ({
      id: item.id,
      nome: item.nome,
      descricao: item.descricao,
      tipo: item.tipo,
      criadoEm: item.criado_em,
      atualizadoEm: item.atualizado_em,
      ativo: item.ativo,
      quocienteEleitoral: item.quociente_eleitoral,
      votosIgreja: item.votos_igreja,
    }))
    .sort((a, b) => {
      if (a.id === BASE_CENARIO_ID) return -1
      if (b.id === BASE_CENARIO_ID) return 1
      return 0
    })

  if (cenarios.length === 0) return { cenarios, cenarioAtivo: null }

  const ativo = cenarios.find((c) => c.ativo) || cenarios.find((c) => c.id === BASE_CENARIO_ID) || cenarios[0]
  const partidosAtivo = (partidosResult.data || []).filter((item) => item.cenario_id === ativo.id)
  const partidosMap: Record<string, PartidoCenario> = {}

  partidosAtivo.forEach((item) => {
    if (!partidosMap[item.partido_nome]) {
      partidosMap[item.partido_nome] = {
        nome: item.partido_nome,
        cor: item.cor,
        corTexto: item.cor_texto,
        candidatos: [],
        votosLegenda: item.votos_legenda || 0,
      }
    }
    partidosMap[item.partido_nome].candidatos.push({
      nome: item.candidato_nome,
      votos: item.candidato_votos,
      genero: item.candidato_genero || undefined,
    })
  })

  return {
    cenarios,
    cenarioAtivo: {
      ...ativo,
      partidos: Object.values(partidosMap),
    },
  }
}

export async function obterCenarioAtivo(): Promise<CenarioCompleto | null> {
  const userId = await getSharedOwnerUserId()
  const supabase = getSupabaseClient()

  const { data: ativoData } = await supabase
    .from('chapas_cenarios')
    .select('id')
    .eq('user_id', userId)
    .like('id', `${CENARIO_PREFIX}%`)
    .eq('ativo', true)
    .limit(1)

  if (!ativoData || ativoData.length === 0) {
    return carregarCenario(BASE_CENARIO_ID)
  }

  return carregarCenario(ativoData[0].id)
}
