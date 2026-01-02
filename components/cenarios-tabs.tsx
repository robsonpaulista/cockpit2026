'use client'

import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Copy, 
  Trash2, 
  Check, 
  X, 
  Save,
  Info,
  RefreshCw,
  RotateCcw,
  Printer
} from 'lucide-react'
import { 
  Cenario, 
  CenarioCompleto, 
  PartidoCenario,
  listarCenarios, 
  carregarCenario, 
  criarNovoCenario, 
  excluirCenario, 
  ativarCenario,
  criarCenarioBase
} from '@/lib/chapasService'

interface CenariosTabsProps {
  partidosAtuais: PartidoCenario[]
  quocienteAtual: number
  onCenarioChange: (cenario: CenarioCompleto) => void
  onCenarioBaseCreated: () => void
  onCenarioDeleted?: () => void
  onCenarioClick?: (cenarioId: string) => void
  onSalvarMudancas?: (cenarioId: string) => void
  onLimparCenario?: (cenarioId: string) => void
  onImprimirPDF?: (cenarioId: string) => void
  salvandoMudancas?: boolean
}

export default function CenariosTabs({ 
  partidosAtuais, 
  quocienteAtual, 
  onCenarioChange,
  onCenarioBaseCreated,
  onCenarioDeleted,
  onCenarioClick,
  onSalvarMudancas,
  onLimparCenario,
  onImprimirPDF,
  salvandoMudancas = false
}: CenariosTabsProps) {
  const [cenarios, setCenarios] = useState<Cenario[]>([])
  const [cenarioAtivo, setCenarioAtivo] = useState<Cenario | null>(null)
  const [loading, setLoading] = useState(false)
  const [dialogAberto, setDialogAberto] = useState(false)
  
  const [novoCenario, setNovoCenario] = useState({ nome: '', descricao: '', cenarioOrigem: '' })
  
  const [activeTab, setActiveTab] = useState<string>('')

  // Carregar cenários
  const carregarCenarios = async () => {
    setLoading(true)
    try {
      const cenariosList = await listarCenarios()
      
      // Garantir que apenas um cenário esteja ativo
      const cenariosAtivos = cenariosList.filter(c => c.ativo)
      if (cenariosAtivos.length > 1) {
        // Manter apenas o primeiro como ativo e desativar os outros
        for (let i = 1; i < cenariosAtivos.length; i++) {
          await ativarCenario(cenariosAtivos[i].id, false)
        }
        // Recarregar após correção
        const cenariosCorrigidos = await listarCenarios()
        setCenarios(cenariosCorrigidos)
        const ativo = cenariosCorrigidos.find(c => c.ativo)
        setCenarioAtivo(ativo || null)
        setActiveTab(ativo?.id || '')
      } else {
        setCenarios(cenariosList)
        const ativo = cenariosList.find(c => c.ativo)
        setCenarioAtivo(ativo || null)
        setActiveTab(ativo?.id || '')
      }
    } catch (error) {
      // Erro silencioso
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      carregarCenarios()
    }, 100)
    
    return () => clearTimeout(timeoutId)
  }, [])

  // Criar novo cenário
  const handleCriarCenario = async () => {
    if (!novoCenario.nome.trim()) {
      alert('Por favor, digite um nome para o cenário')
      return
    }

    setLoading(true)
    try {
      const cenarioOrigemId = novoCenario.cenarioOrigem || (cenarioAtivo?.id || 'base')
      const novoCenarioId = await criarNovoCenario(
        novoCenario.nome,
        novoCenario.descricao,
        cenarioOrigemId
      )

      // Carregar o novo cenário
      const cenarioCompleto = await carregarCenario(novoCenarioId)
      if (cenarioCompleto) {
        onCenarioChange(cenarioCompleto)
      }

      // Limpar formulário e fechar dialog
      setNovoCenario({ nome: '', descricao: '', cenarioOrigem: '' })
      setDialogAberto(false)
      await carregarCenarios()
    } catch (error) {
      alert('Erro ao criar cenário. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Ativar cenário
  const handleAtivarCenario = async (cenarioId: string) => {
    setLoading(true)
    try {
      // Desativar todos os cenários primeiro
      for (const cenario of cenarios) {
        if (cenario.ativo) {
          await ativarCenario(cenario.id, false)
        }
      }

      // Ativar o cenário selecionado
      await ativarCenario(cenarioId, true)

      // Recarregar cenários para garantir consistência
      await carregarCenarios()

      // Carregar automaticamente o cenário ativado
      const cenarioCompleto = await carregarCenario(cenarioId)
      if (cenarioCompleto) {
        onCenarioChange(cenarioCompleto)
      }
    } catch (error) {
      alert('Erro ao ativar cenário. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Excluir cenário
  const handleExcluirCenario = async (cenarioId: string) => {
    setLoading(true)
    try {
      const cenarioSendoExcluido = cenarios.find(c => c.id === cenarioId)
      const eraCenarioAtivo = cenarioSendoExcluido?.ativo
      
      await excluirCenario(cenarioId)
      await carregarCenarios()
      
      // Se o cenário excluído era o ativo, ativar o cenário base
      if (eraCenarioAtivo) {
        await ativarCenario('base', true)
        
        // Carregar o cenário base como ativo
        const cenarioBase = await carregarCenario('base')
        if (cenarioBase) {
          onCenarioChange(cenarioBase)
        }
        
        await carregarCenarios()
      }
      
      // Notificar a página principal sobre a exclusão
      if (onCenarioDeleted) {
        onCenarioDeleted()
      }
    } catch (error) {
      alert('Erro ao excluir cenário. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Duplicar cenário
  const handleDuplicarCenario = async (cenario: Cenario) => {
    setLoading(true)
    try {
      const novoNome = `${cenario.nome} (Cópia)`
      const novoCenarioId = await criarNovoCenario(
        novoNome,
        cenario.descricao || '',
        cenario.id
      )

      await carregarCenarios()
    } catch (error) {
      alert('Erro ao duplicar cenário. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  // Carregar cenário ao clicar na aba
  const handleTabChange = async (cenarioId: string) => {
    setActiveTab(cenarioId)
    
    // Se o cenário não está ativo, ativá-lo
    const cenario = cenarios.find(c => c.id === cenarioId)
    if (cenario && !cenario.ativo) {
      await handleAtivarCenario(cenarioId)
    } else if (onCenarioClick) {
      onCenarioClick(cenarioId)
    }
  }

  const formatarData = (data: string) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading && cenarios.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-700">Cenários</h3>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-xs text-gray-500">Carregando...</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
          </div>
          
          <div className="space-y-3">
            <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
            <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
            <div className="h-8 bg-gray-100 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  if (cenarios.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Nenhum cenário encontrado
        </h3>
        <p className="text-gray-600 mb-4">
          Crie o primeiro cenário para começar a simular diferentes cenários eleitorais.
        </p>
        <button 
          onClick={() => setDialogAberto(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
        >
          <Plus className="h-4 w-4" />
          Criar Primeiro Cenário
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header compacto */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-700">Cenários</h3>
          {loading && (
            <div className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin text-blue-600" />
              <span className="text-xs text-gray-500">Atualizando...</span>
            </div>
          )}
          {cenarioAtivo && !loading && (
            <span className={`px-2 py-1 rounded text-xs ${
              cenarioAtivo.tipo === 'base' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-800'
            }`}>
              {cenarioAtivo.tipo === 'base' ? 'BASE' : 'SIMULAÇÃO'}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDialogAberto(true)}
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />
            Novo
          </button>
        </div>
      </div>

      {/* Sistema de Abas Compacto */}
      <div className="w-full">
        <div className="flex flex-wrap gap-1 border-b border-gray-200">
          {cenarios.map((cenario) => (
            <button
              key={cenario.id}
              onClick={() => handleTabChange(cenario.id)}
              className={`flex items-center justify-between gap-1 px-2 py-2 text-xs relative group ${
                activeTab === cenario.id || cenario.ativo
                  ? 'border-b-2 border-blue-600 text-blue-600 font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <span className="truncate text-xs">{cenario.nome}</span>
                {loading && (
                  <RefreshCw className="h-3 w-3 animate-spin text-blue-600 flex-shrink-0" />
                )}
                {cenario.tipo === 'base' && !loading && (
                  <span className="px-1 py-0 text-xs bg-blue-600 text-white rounded flex-shrink-0">
                    B
                  </span>
                )}
                {cenario.ativo && !loading && (
                  <span className="px-1 py-0 text-xs bg-gray-200 text-gray-800 rounded flex-shrink-0">
                    A
                  </span>
                )}
              </div>
              
              {/* Botões de ação */}
              <div className={`flex items-center gap-1 transition-opacity ${
                cenario.ativo || activeTab === cenario.id 
                  ? 'opacity-100' 
                  : 'opacity-0 group-hover:opacity-100'
              }`}>
                {!cenario.ativo && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAtivarCenario(cenario.id)
                    }}
                    disabled={loading}
                    className="h-5 w-5 p-0 text-xs hover:bg-blue-100 text-blue-600 rounded flex items-center justify-center"
                    title="Ativar"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                )}
                
                {onSalvarMudancas && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onSalvarMudancas(cenario.id)
                    }}
                    disabled={salvandoMudancas}
                    className="h-5 w-5 p-0 text-xs hover:bg-blue-100 text-blue-600 rounded flex items-center justify-center"
                    title={cenario.tipo === 'base' ? 'Salvar' : 'Salvar Mudanças'}
                  >
                    {salvandoMudancas ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                  </button>
                )}
                
                {cenario.tipo === 'base' && onLimparCenario && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onLimparCenario(cenario.id)
                    }}
                    disabled={loading}
                    className="h-5 w-5 p-0 text-xs hover:bg-blue-100 text-blue-600 rounded flex items-center justify-center"
                    title="Limpar Cenário"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
                
                {onImprimirPDF && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onImprimirPDF(cenario.id)
                    }}
                    disabled={loading}
                    className="h-5 w-5 p-0 text-xs hover:bg-blue-100 text-blue-600 rounded flex items-center justify-center"
                    title="Gerar PDF"
                  >
                    <Printer className="h-3 w-3" />
                  </button>
                )}
                
                {cenario.tipo !== 'base' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDuplicarCenario(cenario)
                      }}
                      disabled={loading}
                      className="h-5 w-5 p-0 text-xs hover:bg-blue-100 text-blue-600 rounded flex items-center justify-center"
                      title="Duplicar"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Tem certeza que deseja excluir o cenário "${cenario.nome}"?`)) {
                          handleExcluirCenario(cenario.id)
                        }
                      }}
                      disabled={loading}
                      className="h-5 w-5 p-0 text-xs hover:bg-red-100 text-red-600 rounded flex items-center justify-center"
                      title="Excluir"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>

        {cenarios.map((cenario) => (
          <div key={cenario.id} className={activeTab === cenario.id ? 'mt-2' : 'hidden'}>
            {cenario.descricao && (
              <div className="text-center text-xs text-gray-500 py-2">
                {cenario.descricao}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal para criar novo cenário */}
      {dialogAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Criar Novo Cenário</h2>
              <button
                onClick={() => {
                  setDialogAberto(false)
                  setNovoCenario({ nome: '', descricao: '', cenarioOrigem: '' })
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Nome do Cenário</label>
                <input
                  type="text"
                  placeholder="Ex: Cenário Otimista"
                  value={novoCenario.nome}
                  onChange={(e) => setNovoCenario(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Descrição (opcional)</label>
                <textarea
                  placeholder="Descreva o cenário..."
                  value={novoCenario.descricao}
                  onChange={(e) => setNovoCenario(prev => ({ ...prev, descricao: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Baseado em</label>
                <select
                  value={novoCenario.cenarioOrigem}
                  onChange={(e) => setNovoCenario(prev => ({ ...prev, cenarioOrigem: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione um cenário base</option>
                  {cenarios.map((cenario) => (
                    <option key={cenario.id} value={cenario.id}>
                      {cenario.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setDialogAberto(false)
                    setNovoCenario({ nome: '', descricao: '', cenarioOrigem: '' })
                  }}
                  disabled={loading}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCriarCenario}
                  disabled={loading || !novoCenario.nome.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar Cenário'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}









