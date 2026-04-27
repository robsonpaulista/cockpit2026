'use client'

import React, { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import {
  COCKPIT_PAGE_ACTIVE_CHILD_PILL,
  sidebarPrimaryCTAButtonClass,
} from '@/lib/sidebar-menu-active-style'
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
} from '@/lib/chapasService'
import * as chapasService from '@/lib/chapasService'

interface CenariosService {
  listarCenarios: () => Promise<Cenario[]>
  carregarCenario: (cenarioId: string) => Promise<CenarioCompleto | null>
  criarNovoCenario: (nome: string, descricao: string, cenarioOrigemId: string) => Promise<string>
  excluirCenario: (cenarioId: string) => Promise<void>
  ativarCenario: (cenarioId: string, ativo: boolean) => Promise<void>
  criarCenarioBase: (partidos: PartidoCenario[], quociente: number) => Promise<string>
}

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
  // Props para receber dados do pai (evita carregamento duplicado)
  cenariosIniciais?: Cenario[]
  cenarioAtivoId?: string
  // Flag: pai está carregando dados - NÃO fazer fetch próprio
  carregandoExterno?: boolean
  service?: CenariosService
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
  salvandoMudancas = false,
  cenariosIniciais,
  cenarioAtivoId,
  carregandoExterno = false,
  service = chapasService
}: CenariosTabsProps) {
  const { theme } = useTheme()
  const isCockpit = theme === 'cockpit'
  const [cenarios, setCenarios] = useState<Cenario[]>(cenariosIniciais || [])
  const [cenarioAtivo, setCenarioAtivo] = useState<Cenario | null>(null)
  const [loading, setLoading] = useState(false)
  const [dialogAberto, setDialogAberto] = useState(false)
  
  const [novoCenario, setNovoCenario] = useState({ nome: '', descricao: '', cenarioOrigem: '' })
  
  const [activeTab, setActiveTab] = useState<string>(cenarioAtivoId || '')
  const [inicializado, setInicializado] = useState(false)
  const cenarioSelecionado = cenarios.find(c => c.id === activeTab) || cenarioAtivo

  // Carregar cenários (apenas lista, sem corrigir ativos em loop)
  const carregarCenarios = async () => {
    setLoading(true)
    try {
      const cenariosList = await service.listarCenarios()
      setCenarios(cenariosList)
      const ativo = cenariosList.find(c => c.ativo)
      setCenarioAtivo(ativo || null)
      if (!activeTab || !cenariosList.find(c => c.id === activeTab)) {
        setActiveTab(ativo?.id || '')
      }
    } catch (error) {
      // Erro silencioso
    } finally {
      setLoading(false)
    }
  }

  // Se recebeu cenários do pai, usar diretamente (sem fetch adicional)
  useEffect(() => {
    if (cenariosIniciais && cenariosIniciais.length > 0 && !inicializado) {
      setCenarios(cenariosIniciais)
      const ativo = cenariosIniciais.find(c => c.ativo)
      setCenarioAtivo(ativo || null)
      setActiveTab(cenarioAtivoId || ativo?.id || '')
      setInicializado(true)
      setLoading(false)
    } else if (!cenariosIniciais && !carregandoExterno && !inicializado) {
      // Fallback: carregar do banco apenas se o pai NÃO está carregando e não forneceu dados
      setInicializado(true)
      carregarCenarios()
    }
  }, [cenariosIniciais, cenarioAtivoId, inicializado, carregandoExterno])

  // Criar novo cenário
  const handleCriarCenario = async () => {
    if (!novoCenario.nome.trim()) {
      alert('Por favor, digite um nome para o cenário')
      return
    }

    setLoading(true)
    try {
      const cenarioOrigemId = novoCenario.cenarioOrigem || (cenarioAtivo?.id || 'base')
      const novoCenarioId = await service.criarNovoCenario(
        novoCenario.nome,
        novoCenario.descricao,
        cenarioOrigemId
      )

      // Carregar o novo cenário
      const cenarioCompleto = await service.carregarCenario(novoCenarioId)
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

  // Ativar cenário (otimizado - batch update, sem loops)
  const handleAtivarCenario = async (cenarioId: string) => {
    setLoading(true)
    try {
      // ativarCenario agora faz batch: desativa todos + ativa o selecionado em paralelo
      await service.ativarCenario(cenarioId, true)

      // Carregar cenário ativado e lista em paralelo
      const [cenarioCompleto, cenariosList] = await Promise.all([
        service.carregarCenario(cenarioId),
        service.listarCenarios()
      ])

      setCenarios(cenariosList)
      const ativo = cenariosList.find(c => c.ativo)
      setCenarioAtivo(ativo || null)

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
      
      await service.excluirCenario(cenarioId)
      await carregarCenarios()
      
      // Se o cenário excluído era o ativo, ativar o cenário base
      if (eraCenarioAtivo) {
        await service.ativarCenario('base', true)
        
        // Carregar o cenário base como ativo
        const cenarioBase = await service.carregarCenario('base')
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
      const novoCenarioId = await service.criarNovoCenario(
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

  if ((loading || carregandoExterno) && cenarios.length === 0) {
    return (
      <div className="space-y-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-text-primary">Cenários</h3>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-accent-gold" />
              <span className="text-xs text-secondary">Carregando...</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-card bg-surface p-4">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-4 w-20 animate-pulse rounded bg-border-card"></div>
            <div className="h-4 w-16 animate-pulse rounded bg-border-card"></div>
            <div className="h-4 w-24 animate-pulse rounded bg-border-card"></div>
          </div>

          <div className="space-y-3">
            <div className="h-8 animate-pulse rounded bg-background"></div>
            <div className="h-8 animate-pulse rounded bg-background"></div>
            <div className="h-8 animate-pulse rounded bg-background"></div>
          </div>
        </div>
      </div>
    )
  }

  if (cenarios.length === 0) {
    return (
      <div className="rounded-lg border border-card bg-surface p-8 text-center">
        <Info className="mx-auto mb-4 h-12 w-12 text-muted" />
        <h3 className="mb-2 text-lg font-medium text-text-primary">Nenhum cenário encontrado</h3>
        <p className="mb-4 text-secondary">
          Crie o primeiro cenário para começar a simular diferentes cenários eleitorais.
        </p>
        <button
          type="button"
          onClick={() => setDialogAberto(true)}
          className={cn(sidebarPrimaryCTAButtonClass(isCockpit), 'mx-auto')}
        >
          <Plus className={cn('h-4 w-4 shrink-0', isCockpit ? 'text-white' : 'text-accent-gold')} aria-hidden />
          Criar Primeiro Cenário
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header compacto */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-text-primary">Cenários</h3>
          {loading && (
            <div className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3 animate-spin text-accent-gold" />
              <span className="text-xs text-secondary">Atualizando...</span>
            </div>
          )}
          {cenarioSelecionado && !loading && (
            <span
              className={cn(
                'rounded px-2 py-1 text-xs',
                cenarioSelecionado.tipo === 'base'
                  ? isCockpit
                    ? COCKPIT_PAGE_ACTIVE_CHILD_PILL
                    : 'bg-accent-gold-soft font-medium text-accent-gold'
                  : 'border border-card bg-background text-text-primary',
              )}
            >
              {cenarioSelecionado.tipo === 'base' ? 'BASE' : 'SIMULAÇÃO'}: {cenarioSelecionado.nome}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDialogAberto(true)}
            className="flex items-center gap-1 rounded border border-card bg-surface px-2 py-1 text-xs text-text-primary hover:bg-background"
          >
            <Plus className="h-3 w-3 shrink-0" aria-hidden />
            Novo
          </button>
        </div>
      </div>

      {/* Sistema de Abas Compacto */}
      <div className="w-full">
        <div className="flex flex-wrap gap-1 border-b border-card">
          {cenarios.map((cenario) => (
            <button
              type="button"
              key={cenario.id}
              onClick={() => handleTabChange(cenario.id)}
              className={cn(
                'group relative flex items-center justify-between gap-1 px-2 py-2 text-xs',
                activeTab === cenario.id
                  ? isCockpit
                    ? cn(COCKPIT_PAGE_ACTIVE_CHILD_PILL, 'rounded-t-md border-b-0 font-semibold')
                    : 'rounded-t-md border border-b-0 border-accent-gold bg-accent-gold-soft font-semibold text-accent-gold shadow-sm'
                  : 'rounded-t-md text-secondary hover:bg-background hover:text-text-primary',
              )}
            >
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <span className="truncate text-xs">{cenario.nome}</span>
                {loading && (
                  <RefreshCw className="h-3 w-3 animate-spin text-accent-gold flex-shrink-0" />
                )}
                {cenario.tipo === 'base' && !loading && (
                  <span
                    className={cn(
                      'flex-shrink-0 rounded px-1 py-0 text-xs font-medium',
                      isCockpit ? COCKPIT_PAGE_ACTIVE_CHILD_PILL : 'bg-accent-gold-soft text-accent-gold',
                    )}
                  >
                    B
                  </span>
                )}
                {activeTab === cenario.id && !loading && (
                  <span className="flex-shrink-0 rounded bg-border-card px-1 py-0 text-xs font-medium text-text-primary">
                    A
                  </span>
                )}
              </div>
              
              {/* Botões de ação */}
              <div className={`flex items-center gap-1 transition-opacity ${
                activeTab === cenario.id 
                  ? 'opacity-100' 
                  : 'opacity-0 group-hover:opacity-100'
              }`}>
                {!cenario.ativo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAtivarCenario(cenario.id)
                    }}
                    disabled={loading}
                    className="h-5 w-5 p-0 text-xs hover:bg-accent-gold-soft text-accent-gold rounded flex items-center justify-center"
                    title="Ativar"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                )}
                
                {onSalvarMudancas && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSalvarMudancas(cenario.id)
                    }}
                    disabled={salvandoMudancas}
                    className="h-5 w-5 p-0 text-xs hover:bg-accent-gold-soft text-accent-gold rounded flex items-center justify-center"
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
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onLimparCenario(cenario.id)
                    }}
                    disabled={loading}
                    className="h-5 w-5 p-0 text-xs hover:bg-accent-gold-soft text-accent-gold rounded flex items-center justify-center"
                    title="Limpar Cenário"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
                
                {onImprimirPDF && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onImprimirPDF(cenario.id)
                    }}
                    disabled={loading}
                    className="h-5 w-5 p-0 text-xs hover:bg-accent-gold-soft text-accent-gold rounded flex items-center justify-center"
                    title="Gerar PDF"
                  >
                    <Printer className="h-3 w-3" />
                  </button>
                )}
                
                {cenario.tipo !== 'base' && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDuplicarCenario(cenario)
                      }}
                      disabled={loading}
                      className="h-5 w-5 p-0 text-xs hover:bg-accent-gold-soft text-accent-gold rounded flex items-center justify-center"
                      title="Duplicar"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Tem certeza que deseja excluir o cenário "${cenario.nome}"?`)) {
                          handleExcluirCenario(cenario.id)
                        }
                      }}
                      disabled={loading}
                      className="flex h-5 w-5 items-center justify-center rounded p-0 text-xs text-status-error hover:bg-status-error/15"
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
              <div className="py-2 text-center text-xs text-secondary">
                {cenario.descricao}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal para criar novo cenário */}
      {dialogAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-card bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">Criar Novo Cenário</h2>
              <button
                type="button"
                onClick={() => {
                  setDialogAberto(false)
                  setNovoCenario({ nome: '', descricao: '', cenarioOrigem: '' })
                }}
                className="text-muted hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">Nome do Cenário</label>
                <input
                  type="text"
                  placeholder="Ex: Cenário Otimista"
                  value={novoCenario.nome}
                  onChange={(e) => setNovoCenario(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full rounded-lg border border-card bg-surface px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">Descrição (opcional)</label>
                <textarea
                  placeholder="Descreva o cenário..."
                  value={novoCenario.descricao}
                  onChange={(e) => setNovoCenario(prev => ({ ...prev, descricao: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-card bg-surface px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-text-primary">Baseado em</label>
                <select
                  value={novoCenario.cenarioOrigem}
                  onChange={(e) => setNovoCenario(prev => ({ ...prev, cenarioOrigem: e.target.value }))}
                  className="w-full rounded-lg border border-card bg-surface px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                >
                  <option value="">Selecione um cenário base</option>
                  {cenarios.map((cenario) => (
                    <option key={cenario.id} value={cenario.id}>
                      {cenario.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDialogAberto(false)
                    setNovoCenario({ nome: '', descricao: '', cenarioOrigem: '' })
                  }}
                  disabled={loading}
                  className="rounded-lg border border-card bg-surface px-4 py-2 text-sm text-text-primary hover:bg-background disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCriarCenario}
                  disabled={loading || !novoCenario.nome.trim()}
                  className={sidebarPrimaryCTAButtonClass(isCockpit)}
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












