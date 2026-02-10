'use client'

import { createClient } from '@/lib/supabase/client'

// Singleton Supabase client (evita criar novo client em cada chamada)
let _supabaseClient: ReturnType<typeof createClient> | null = null
function getSupabaseClient() {
  if (!_supabaseClient) {
    _supabaseClient = createClient()
  }
  return _supabaseClient
}

// Retry com backoff exponencial (inspirado no projeto referência Firebase)
const MAX_RETRIES = 3
const RETRY_DELAY = 500 // ms

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  label: string = 'operação'
): Promise<T> {
  let lastError: Error = new Error('Falha desconhecida')
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation()
    } catch (error: unknown) {
      lastError = error as Error
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, attempt - 1)
        console.warn(`[chapasService] ${label} - tentativa ${attempt} falhou, retry em ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}

// Pré-aquecer cache do userId (chamado pela página antes de qualquer operação)
export function preWarmUserIdCache(userId: string) {
  if (!userId) return
  _cachedUserId = userId
  // Persistir em localStorage (sobrevive a HMR do Next.js dev)
  if (typeof window !== 'undefined') {
    try { localStorage.setItem('chapas_uid', userId) } catch { /* ignore */ }
  }
}

// Tipos para o sistema de cenários
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

// Dados iniciais conforme o estado atual do app
export const dadosIniciais: Array<{partido: string; nome: string; votos: number}> = [
  { partido: 'PT', nome: 'ZÉ', votos: 120000 },
  { partido: 'PT', nome: 'F COSTA', votos: 120000 },
  { partido: 'PT', nome: 'F NOGUEIRA', votos: 100000 },
  { partido: 'PT', nome: 'FLORENTINO', votos: 80000 },
  { partido: 'PT', nome: 'WILSON', votos: 80000 },
  { partido: 'PT', nome: 'MERLONG', votos: 80000 },
  { partido: 'PT', nome: 'FRANZE', votos: 60000 },
  { partido: 'PT', nome: 'MARINA SANTOS', votos: 10000 },
  { partido: 'PT', nome: 'RAISSA PROTETORA', votos: 10000 },
  { partido: 'PT', nome: 'MULHER', votos: 6000 },
  { partido: 'PT', nome: 'MULHER', votos: 4000 },
  { partido: 'PT', nome: 'LEGENDA', votos: 10000 },

  { partido: 'PSD/MDB', nome: 'GEORGIANO', votos: 200000 },
  { partido: 'PSD/MDB', nome: 'CASTRO', votos: 180000 },
  { partido: 'PSD/MDB', nome: 'MARCOS AURELIO', votos: 80000 },
  { partido: 'PSD/MDB', nome: 'FABIO ABREU', votos: 35000 },
  { partido: 'PSD/MDB', nome: 'NOME5', votos: 10000 },
  { partido: 'PSD/MDB', nome: 'NOME6', votos: 10000 },
  { partido: 'PSD/MDB', nome: 'NOME7', votos: 5000 },
  { partido: 'PSD/MDB', nome: 'MULHER 1', votos: 5000 },
  { partido: 'PSD/MDB', nome: 'MULHER 2', votos: 5000 },
  { partido: 'PSD/MDB', nome: 'MULHER 3', votos: 3000 },
  { partido: 'PSD/MDB', nome: 'MULHER 4', votos: 2000 },

  { partido: 'PP', nome: 'ATILA', votos: 105000 },
  { partido: 'PP', nome: 'JULIO ARCOVERDE', votos: 105000 },
  { partido: 'PP', nome: 'ISMAEL', votos: 20000 },
  { partido: 'PP', nome: 'PETRUS', votos: 20000 },
  { partido: 'PP', nome: 'NOME6', votos: 10000 },
  { partido: 'PP', nome: 'NOME7', votos: 5000 },
  { partido: 'PP', nome: 'NOME8', votos: 5000 },
  { partido: 'PP', nome: 'SAMANTA CAVALCA', votos: 10000 },
  { partido: 'PP', nome: 'MULHER 2', votos: 5000 },
  { partido: 'PP', nome: 'MULHER 3', votos: 3000 },
  { partido: 'PP', nome: 'MULHER 4', votos: 2000 },

  { partido: 'REPUBLICANOS', nome: 'JADYEL', votos: 120000 },
  { partido: 'REPUBLICANOS', nome: 'ANA FIDELIS', votos: 40000 },
  { partido: 'REPUBLICANOS', nome: 'MAGNO', votos: 25000 },
  { partido: 'REPUBLICANOS', nome: 'CHARLES', votos: 40000 },
  { partido: 'REPUBLICANOS', nome: 'ZE LUIS ASSEMBLEIA DE DEUS', votos: 25000 },
  { partido: 'REPUBLICANOS', nome: 'GAIOSO', votos: 10000 },
  { partido: 'REPUBLICANOS', nome: 'GABRIELA', votos: 10000 },
  { partido: 'REPUBLICANOS', nome: 'PARNAIBA', votos: 10000 },
  { partido: 'REPUBLICANOS', nome: 'AGRO/SUL', votos: 10000 },
  { partido: 'REPUBLICANOS', nome: 'DIANA IGREJA OU K B', votos: 5000 },
  { partido: 'REPUBLICANOS', nome: 'CAUSA ANIMAL', votos: 10000 },
]

// Cache do userId (ZERO chamadas de rede - definido pelo componente + persistido em localStorage)
let _cachedUserId: string | null = null

// Timeout genérico para qualquer promise (evita hang infinito)
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} excedeu ${ms / 1000}s`)), ms)
    )
  ])
}

// Função para obter userId (síncrono, sem rede, com fallback em localStorage)
function getUserId(): string {
  // 1. Cache em memória (instantâneo)
  if (_cachedUserId) {
    return _cachedUserId
  }
  
  // 2. Fallback: localStorage (sobrevive a HMR do Next.js dev)
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('chapas_uid')
    if (stored) {
      _cachedUserId = stored
      return stored
    }
  }
  
  throw new Error('Usuário não identificado. Recarregue a página.')
}

// Função para salvar quociente eleitoral
export async function salvarQuocienteEleitoral(quociente: number): Promise<void> {
  const userId = getUserId()
  const supabase = getSupabaseClient()
  
  const { error } = await supabase
    .from('chapas_configuracoes')
    .upsert({
      user_id: userId,
      chave: 'quociente_eleitoral',
      valor: { valor: quociente },
      atualizado_em: new Date().toISOString()
    }, {
      onConflict: 'user_id,chave'
    })

  if (error) throw error
}

// Função para carregar quociente eleitoral
export async function carregarQuocienteEleitoral(): Promise<number> {
  const userId = getUserId()
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('chapas_configuracoes')
    .select('valor')
    .eq('user_id', userId)
    .eq('chave', 'quociente_eleitoral')
    .single()

  if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
  
  return data?.valor?.valor || 190000
}

// Função para criar o cenário base
export async function criarCenarioBase(partidos: PartidoCenario[], quociente: number): Promise<string> {
  const userId = getUserId()
  const supabase = getSupabaseClient()
  
  // Salvar o cenário (usando snake_case para o banco)
  const { error: cenarioError } = await supabase
    .from('chapas_cenarios')
    .upsert({
      id: 'base',
      user_id: userId,
      nome: 'Cenário Base',
      descricao: 'Estado original das chapas eleitorais',
      tipo: 'base',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      ativo: true,
      quociente_eleitoral: quociente
    }, {
      onConflict: 'user_id,id'
    })

  if (cenarioError) throw cenarioError

  // Limpar partidos existentes do cenário base
  const { error: deleteError } = await supabase
    .from('chapas_partidos')
    .delete()
    .eq('user_id', userId)
    .eq('cenario_id', 'base')

  if (deleteError) throw deleteError

  // Salvar os partidos
  const partidosData = partidos.flatMap(partido =>
    partido.candidatos.map(candidato => ({
      user_id: userId,
      cenario_id: 'base',
      partido_nome: partido.nome,
      cor: partido.cor,
      cor_texto: partido.corTexto,
      votos_legenda: partido.votosLegenda || 0,
      candidato_nome: candidato.nome,
      candidato_votos: candidato.votos,
      candidato_genero: candidato.genero || null
    }))
  )

  if (partidosData.length > 0) {
    const { error: partidosError } = await supabase
      .from('chapas_partidos')
      .insert(partidosData)

    if (partidosError) throw partidosError
  }

  return 'base'
}

// Função para listar todos os cenários
export async function listarCenarios(): Promise<Cenario[]> {
  const userId = getUserId()
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('chapas_cenarios')
    .select('id, nome, descricao, tipo, criado_em, atualizado_em, ativo, quociente_eleitoral, votos_igreja')
    .eq('user_id', userId)
    .order('criado_em', { ascending: false })

  if (error) throw error

  const cenarios = (data || []).map(item => ({
    id: item.id,
    nome: item.nome,
    descricao: item.descricao,
    tipo: item.tipo,
    criadoEm: item.criado_em,
    atualizadoEm: item.atualizado_em,
    ativo: item.ativo,
    quocienteEleitoral: item.quociente_eleitoral,
    votosIgreja: item.votos_igreja
  } as Cenario))

  // Garantir que o cenário base sempre apareça primeiro
  return cenarios.sort((a, b) => {
    if (a.id === 'base') return -1
    if (b.id === 'base') return 1
    return 0
  })
}

// Função para carregar um cenário completo
export async function carregarCenario(cenarioId: string): Promise<CenarioCompleto | null> {
  try {
    console.time(`[chapasService] carregarCenario(${cenarioId})`)
    const userId = getUserId()
    const supabase = getSupabaseClient()
    
    // Carregar cenário E partidos em PARALELO (com timeout de 10s)
    const [cenarioResult, partidosResult] = await withTimeout(
      Promise.all([
        supabase
          .from('chapas_cenarios')
          .select('id, nome, descricao, tipo, criado_em, atualizado_em, ativo, quociente_eleitoral, votos_igreja')
          .eq('user_id', userId)
          .eq('id', cenarioId)
          .single(),
        supabase
          .from('chapas_partidos')
          .select('partido_nome, cor, cor_texto, votos_legenda, candidato_nome, candidato_votos, candidato_genero')
          .eq('user_id', userId)
          .eq('cenario_id', cenarioId)
          .order('partido_nome', { ascending: true })
          .order('candidato_votos', { ascending: false })
      ]),
      10000,
      `carregar cenário ${cenarioId}`
    )

    const { data: cenarioData, error: cenarioError } = cenarioResult
    const { data: partidosData, error: partidosError } = partidosResult

    // Se o erro é "not found" (PGRST116), retornar null (cenário não existe)
    if (cenarioError) {
      if (cenarioError.code === 'PGRST116') {
        return null
      }
      if (cenarioError.message?.includes('relation') || cenarioError.message?.includes('does not exist')) {
        throw new Error('Tabelas do banco de dados não foram criadas. Execute o script SQL: database/create-chapas-tables.sql')
      }
      throw cenarioError
    }

    if (!cenarioData) return null

    if (partidosError) {
      if (partidosError.message?.includes('relation') || partidosError.message?.includes('does not exist')) {
        throw new Error('Tabelas do banco de dados não foram criadas. Execute o script SQL: database/create-chapas-tables.sql')
      }
      throw partidosError
    }

    const cenario: Cenario = {
      id: cenarioData.id,
      nome: cenarioData.nome,
      descricao: cenarioData.descricao,
      tipo: cenarioData.tipo,
      criadoEm: cenarioData.criado_em,
      atualizadoEm: cenarioData.atualizado_em,
      ativo: cenarioData.ativo,
      quocienteEleitoral: cenarioData.quociente_eleitoral,
      votosIgreja: cenarioData.votos_igreja
    }

    // Agrupar por partido
    const partidosMap: { [partido: string]: PartidoCenario } = {}
    
    partidosData?.forEach(item => {
      if (!partidosMap[item.partido_nome]) {
        partidosMap[item.partido_nome] = {
          nome: item.partido_nome,
          cor: item.cor,
          corTexto: item.cor_texto,
          candidatos: [],
          votosLegenda: item.votos_legenda || 0
        }
      }
      
      partidosMap[item.partido_nome].candidatos.push({
        nome: item.candidato_nome,
        votos: item.candidato_votos,
        genero: item.candidato_genero || undefined
      })
    })

    const partidos = Object.values(partidosMap)

    console.timeEnd(`[chapasService] carregarCenario(${cenarioId})`)
    return {
      ...cenario,
      partidos
    }
  } catch (error: unknown) {
    console.timeEnd(`[chapasService] carregarCenario(${cenarioId})`)
    const err = error as Error
    if (err?.message?.includes('não autenticado') || err?.message?.includes('not authenticated')) {
      throw new Error('Usuário não autenticado. Faça login para continuar.')
    }
    if (err?.message?.includes('relation') || err?.message?.includes('does not exist')) {
      throw new Error('Tabelas do banco de dados não foram criadas. Execute o script SQL: database/create-chapas-tables.sql')
    }
    throw error
  }
}

// Função para criar um novo cenário baseado em um existente
export async function criarNovoCenario(
  nome: string,
  descricao: string,
  cenarioOrigemId: string
): Promise<string> {
  const userId = getUserId()
  const supabase = getSupabaseClient()
  
  const cenarioOrigem = await carregarCenario(cenarioOrigemId)
  if (!cenarioOrigem) throw new Error('Cenário origem não encontrado')

  // Gerar ID único para o novo cenário
  const novoCenarioId = `cenario_${Date.now()}`

  // Salvar o novo cenário (usando snake_case para o banco)
  const { error: cenarioError } = await supabase
    .from('chapas_cenarios')
    .insert({
      id: novoCenarioId,
      user_id: userId,
      nome,
      descricao,
      tipo: 'simulacao',
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      ativo: true,
      quociente_eleitoral: cenarioOrigem.quocienteEleitoral
    })

  if (cenarioError) throw cenarioError

  // Copiar partidos do cenário origem
  const partidosData = cenarioOrigem.partidos.flatMap(partido =>
    partido.candidatos.map(candidato => ({
      user_id: userId,
      cenario_id: novoCenarioId,
      partido_nome: partido.nome,
      cor: partido.cor,
      cor_texto: partido.corTexto,
      votos_legenda: partido.votosLegenda || 0,
      candidato_nome: candidato.nome,
      candidato_votos: candidato.votos,
      candidato_genero: candidato.genero || null
    }))
  )

  if (partidosData.length > 0) {
    const { error: partidosError } = await supabase
      .from('chapas_partidos')
      .insert(partidosData)

    if (partidosError) throw partidosError
  }

  return novoCenarioId
}

// Função para atualizar um cenário (otimizada - queries paralelas, retry com backoff)
export async function atualizarCenario(
  cenarioId: string,
  partidos: PartidoCenario[],
  quociente: number
): Promise<void> {
  console.time('[chapasService] atualizarCenario total')
  
  const userId = getUserId()
  const supabase = getSupabaseClient()
  const agora = new Date().toISOString()
  
  // Preparar dados dos partidos antecipadamente
  const partidosData = partidos.flatMap(partido =>
    partido.candidatos.map(candidato => ({
      user_id: userId,
      cenario_id: cenarioId,
      partido_nome: partido.nome,
      cor: partido.cor,
      cor_texto: partido.corTexto,
      votos_legenda: partido.votosLegenda || 0,
      candidato_nome: candidato.nome,
      candidato_votos: candidato.votos,
      candidato_genero: candidato.genero || null
    }))
  )

  console.log(`[chapasService] Salvando: ${partidosData.length} registros de partidos`)

  // Step 1: Atualizar cenário + deletar partidos antigos em PARALELO (com timeout + retry)
  await executeWithRetry(async () => {
    const [cenarioResult, deleteResult] = await withTimeout(
      Promise.all([
        supabase
          .from('chapas_cenarios')
          .update({
            atualizado_em: agora,
            quociente_eleitoral: quociente
          })
          .eq('user_id', userId)
          .eq('id', cenarioId),
        supabase
          .from('chapas_partidos')
          .delete()
          .eq('user_id', userId)
          .eq('cenario_id', cenarioId)
      ]),
      10000,
      'update + delete paralelo'
    )

    if (cenarioResult.error) throw cenarioResult.error
    if (deleteResult.error) throw deleteResult.error
  }, 'atualizar cenário + limpar partidos')

  // Step 2: Inserir novos partidos (com timeout + retry)
  if (partidosData.length > 0) {
    await executeWithRetry(async () => {
      const insertResult = await withTimeout(
        Promise.resolve(supabase.from('chapas_partidos').insert(partidosData)),
        10000,
        'insert partidos'
      )

      if (insertResult.error) throw insertResult.error
    }, 'inserir partidos')
  }
  
  console.timeEnd('[chapasService] atualizarCenario total')
}

// Função para excluir um cenário
export async function excluirCenario(cenarioId: string): Promise<void> {
  const userId = getUserId()
  const supabase = getSupabaseClient()
  
  // Não permitir excluir o cenário base
  if (cenarioId === 'base') {
    throw new Error('Não é possível excluir o cenário base')
  }

  // Excluir todos os partidos do cenário (cascade)
  const { error: partidosError } = await supabase
    .from('chapas_partidos')
    .delete()
    .eq('user_id', userId)
    .eq('cenario_id', cenarioId)

  if (partidosError) throw partidosError

  // Excluir o cenário
  const { error: cenarioError } = await supabase
    .from('chapas_cenarios')
    .delete()
    .eq('user_id', userId)
    .eq('id', cenarioId)

  if (cenarioError) throw cenarioError
}

// Função para ativar/desativar um cenário (batch update, sem loops)
export async function ativarCenario(cenarioId: string, ativo: boolean): Promise<void> {
  const userId = getUserId()
  const supabase = getSupabaseClient()
  const agora = new Date().toISOString()
  
  if (ativo) {
    // Desativar todos E ativar o selecionado em paralelo
    const [desativarResult, ativarResult] = await Promise.all([
      supabase
        .from('chapas_cenarios')
        .update({ ativo: false, atualizado_em: agora })
        .eq('user_id', userId)
        .eq('ativo', true)
        .neq('id', cenarioId),
      supabase
        .from('chapas_cenarios')
        .update({ ativo: true, atualizado_em: agora })
        .eq('user_id', userId)
        .eq('id', cenarioId)
    ])

    if (desativarResult.error) throw desativarResult.error
    if (ativarResult.error) throw ativarResult.error
  } else {
    // Apenas desativar o cenário específico
    const { error } = await supabase
      .from('chapas_cenarios')
      .update({ ativo: false, atualizado_em: agora })
      .eq('user_id', userId)
      .eq('id', cenarioId)

    if (error) throw error
  }
}

// Função combinada: lista cenários + carrega o ativo (queries 100% paralelas, sem rede para auth)
export async function listarCenariosComAtivo(): Promise<{ cenarios: Cenario[], cenarioAtivo: CenarioCompleto | null }> {
  console.time('[chapasService] listarCenariosComAtivo total')
  
  const userId = getUserId()
  console.log('[chapasService] userId resolvido, buscando dados...')
  const supabase = getSupabaseClient()
  
  // Buscar cenários E TODOS os partidos do usuário em PARALELO (com timeout de 12s)
  const [cenariosResult, partidosResult] = await withTimeout(
    Promise.all([
      supabase
        .from('chapas_cenarios')
        .select('id, nome, descricao, tipo, criado_em, atualizado_em, ativo, quociente_eleitoral, votos_igreja')
        .eq('user_id', userId)
        .order('criado_em', { ascending: false }),
      supabase
        .from('chapas_partidos')
        .select('cenario_id, partido_nome, cor, cor_texto, votos_legenda, candidato_nome, candidato_votos, candidato_genero')
        .eq('user_id', userId)
        .order('partido_nome', { ascending: true })
        .order('candidato_votos', { ascending: false })
    ]),
    12000,
    'carregar cenários e partidos'
  )

  if (cenariosResult.error) throw cenariosResult.error
  if (partidosResult.error) throw partidosResult.error

  const cenarios = (cenariosResult.data || []).map(item => ({
    id: item.id,
    nome: item.nome,
    descricao: item.descricao,
    tipo: item.tipo,
    criadoEm: item.criado_em,
    atualizadoEm: item.atualizado_em,
    ativo: item.ativo,
    quocienteEleitoral: item.quociente_eleitoral,
    votosIgreja: item.votos_igreja
  } as Cenario)).sort((a, b) => {
    if (a.id === 'base') return -1
    if (b.id === 'base') return 1
    return 0
  })

  // Encontrar o cenário ativo (ou base como fallback)
  const ativo = cenarios.find(c => c.ativo)
  const cenarioIdParaCarregar = ativo?.id || 'base'
  const cenarioBase = cenarios.find(c => c.id === cenarioIdParaCarregar)

  if (!cenarioBase) {
    return { cenarios, cenarioAtivo: null }
  }

  // Filtrar partidos do cenário ativo (já temos todos os dados, só filtrar client-side)
  const partidosDoAtivo = (partidosResult.data || []).filter(
    item => item.cenario_id === cenarioIdParaCarregar
  )

  // Agrupar partidos
  const partidosMap: { [partido: string]: PartidoCenario } = {}
  partidosDoAtivo.forEach(item => {
    if (!partidosMap[item.partido_nome]) {
      partidosMap[item.partido_nome] = {
        nome: item.partido_nome,
        cor: item.cor,
        corTexto: item.cor_texto,
        candidatos: [],
        votosLegenda: item.votos_legenda || 0
      }
    }
    partidosMap[item.partido_nome].candidatos.push({
      nome: item.candidato_nome,
      votos: item.candidato_votos,
      genero: item.candidato_genero || undefined
    })
  })

  const cenarioAtivo: CenarioCompleto = {
    ...cenarioBase,
    partidos: Object.values(partidosMap)
  }

  console.timeEnd('[chapasService] listarCenariosComAtivo total')
  console.log(`[chapasService] Resultado: ${cenarios.length} cenários, ativo: ${cenarioAtivo ? cenarioAtivo.id : 'nenhum'}`)
  
  return { cenarios, cenarioAtivo }
}

// Função para obter o cenário ativo (otimizada - queries paralelas)
export async function obterCenarioAtivo(): Promise<CenarioCompleto | null> {
  const userId = getUserId()
  const supabase = getSupabaseClient()
  
  // Buscar cenário ativo (apenas o ID, limit 1 para performance)
  const { data: ativoData, error: ativoError } = await supabase
    .from('chapas_cenarios')
    .select('id')
    .eq('user_id', userId)
    .eq('ativo', true)
    .limit(1)

  // Se não há cenário ativo, retornar o base
  if (ativoError || !ativoData || ativoData.length === 0) {
    return await carregarCenario('base')
  }

  // Carregar cenário ativo diretamente (já usa queries paralelas internamente)
  return await carregarCenario(ativoData[0].id)
}

