'use client'

import { createClient } from '@/lib/supabase/client'

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

// Função auxiliar para obter userId
async function getUserId(): Promise<string> {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      throw new Error(`Erro de autenticação: ${error.message}`)
    }
    
    if (!user) {
      throw new Error('Usuário não autenticado. Faça login para continuar.')
    }
    
    return user.id
  } catch (error: any) {
    if (error?.message) {
      throw error
    }
    throw new Error('Erro ao obter usuário autenticado')
  }
}

// Função para salvar quociente eleitoral
export async function salvarQuocienteEleitoral(quociente: number): Promise<void> {
  const userId = await getUserId()
  const supabase = createClient()
  
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
  const userId = await getUserId()
  const supabase = createClient()
  
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
  const userId = await getUserId()
  const supabase = createClient()
  
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
  const userId = await getUserId()
  const supabase = createClient()
  
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
    const userId = await getUserId()
    const supabase = createClient()
    
    // Carregar dados do cenário
    const { data: cenarioData, error: cenarioError } = await supabase
      .from('chapas_cenarios')
      .select('id, nome, descricao, tipo, criado_em, atualizado_em, ativo, quociente_eleitoral, votos_igreja')
      .eq('user_id', userId)
      .eq('id', cenarioId)
      .single()

    // Se o erro é "not found" (PGRST116), retornar null (cenário não existe)
    if (cenarioError) {
      if (cenarioError.code === 'PGRST116') {
        return null
      }
      // Se for outro erro, verificar se é problema de tabela não existente
      if (cenarioError.message?.includes('relation') || cenarioError.message?.includes('does not exist')) {
        throw new Error('Tabelas do banco de dados não foram criadas. Execute o script SQL: database/create-chapas-tables.sql')
      }
      throw cenarioError
    }

    if (!cenarioData) return null

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

    // Carregar partidos do cenário
    const { data: partidosData, error: partidosError } = await supabase
      .from('chapas_partidos')
      .select('partido_nome, cor, cor_texto, votos_legenda, candidato_nome, candidato_votos, candidato_genero')
      .eq('user_id', userId)
      .eq('cenario_id', cenarioId)
      .order('partido_nome', { ascending: true })
      .order('candidato_votos', { ascending: false })

    if (partidosError) {
      // Se for erro de tabela não existente
      if (partidosError.message?.includes('relation') || partidosError.message?.includes('does not exist')) {
        throw new Error('Tabelas do banco de dados não foram criadas. Execute o script SQL: database/create-chapas-tables.sql')
      }
      throw partidosError
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

    return {
      ...cenario,
      partidos
    }
  } catch (error: any) {
    // Se for erro de autenticação
    if (error?.message?.includes('não autenticado') || error?.message?.includes('not authenticated')) {
      throw new Error('Usuário não autenticado. Faça login para continuar.')
    }
    // Se for erro de tabela não existente
    if (error?.message?.includes('relation') || error?.message?.includes('does not exist')) {
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
  const userId = await getUserId()
  const supabase = createClient()
  
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

// Função para atualizar um cenário
export async function atualizarCenario(
  cenarioId: string,
  partidos: PartidoCenario[],
  quociente: number
): Promise<void> {
  const userId = await getUserId()
  const supabase = createClient()
  
  // Atualizar dados do cenário e ativar automaticamente
  const { error: cenarioError } = await supabase
    .from('chapas_cenarios')
    .update({
      atualizado_em: new Date().toISOString(),
      quociente_eleitoral: quociente,
      ativo: true
    })
    .eq('user_id', userId)
    .eq('id', cenarioId)

  if (cenarioError) throw cenarioError

  // Desativar outros cenários
  const { error: desativarError } = await supabase
    .from('chapas_cenarios')
    .update({ ativo: false, atualizado_em: new Date().toISOString() })
    .eq('user_id', userId)
    .neq('id', cenarioId)
    .eq('ativo', true)

  if (desativarError) throw desativarError

  // Limpar partidos existentes
  const { error: deleteError } = await supabase
    .from('chapas_partidos')
    .delete()
    .eq('user_id', userId)
    .eq('cenario_id', cenarioId)

  if (deleteError) throw deleteError

  // Adicionar novos partidos
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

  if (partidosData.length > 0) {
    const { error: insertError } = await supabase
      .from('chapas_partidos')
      .insert(partidosData)

    if (insertError) throw insertError
  }
}

// Função para excluir um cenário
export async function excluirCenario(cenarioId: string): Promise<void> {
  const userId = await getUserId()
  const supabase = createClient()
  
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

// Função para ativar/desativar um cenário
export async function ativarCenario(cenarioId: string, ativo: boolean): Promise<void> {
  const userId = await getUserId()
  const supabase = createClient()
  
  if (ativo) {
    // Se está ativando, primeiro desativar todos os outros cenários
    const { error: desativarError } = await supabase
      .from('chapas_cenarios')
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('ativo', true)

    if (desativarError) throw desativarError
  }

  // Ativar/desativar o cenário específico
  const { error } = await supabase
    .from('chapas_cenarios')
    .update({
      ativo,
      atualizado_em: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('id', cenarioId)

  if (error) throw error
}

// Função para obter o cenário ativo
export async function obterCenarioAtivo(): Promise<CenarioCompleto | null> {
  const userId = await getUserId()
  const supabase = createClient()
  
  // Buscar cenário ativo
  const { data: ativoData, error: ativoError } = await supabase
    .from('chapas_cenarios')
    .select('id, nome, descricao, tipo, criado_em, atualizado_em, ativo, quociente_eleitoral, votos_igreja')
    .eq('user_id', userId)
    .eq('ativo', true)
    .limit(1)
    .single()

  // Se não há cenário ativo, retornar o base
  if (ativoError || !ativoData) {
    return await carregarCenario('base')
  }

  // Se há múltiplos cenários ativos, corrigir (manter apenas o primeiro)
  if (ativoData) {
    const { data: todosAtivos } = await supabase
      .from('chapas_cenarios')
      .select('id')
      .eq('user_id', userId)
      .eq('ativo', true)

    if (todosAtivos && todosAtivos.length > 1) {
      // Desativar todos exceto o primeiro
      const idsParaDesativar = todosAtivos.slice(1).map(c => c.id)
      await supabase
        .from('chapas_cenarios')
        .update({ ativo: false, atualizado_em: new Date().toISOString() })
        .eq('user_id', userId)
        .in('id', idsParaDesativar)
    }

    return await carregarCenario(ativoData.id)
  }

  return null
}

