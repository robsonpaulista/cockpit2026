'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/header'
import { Plus, Users, Edit2, Trash2, ChevronDown, ChevronRight, ListTodo, PlayCircle, CheckCircle2, AlertCircle } from 'lucide-react'
import { Territory, TerritoryLeader, Task } from '@/types'
import { KanbanColumn } from '@/components/kanban-column'
import { LeaderModal } from '@/components/leader-modal'
import { TaskModal } from '@/components/task-modal'

const statusColumns = [
  { id: 'backlog', title: 'Backlog', color: '#94A3B8' },
  { id: 'em-andamento', title: 'Em Andamento', color: '#3B82F6' },
  { id: 'em-revisao', title: 'Em Revisão', color: '#F59E0B' },
  { id: 'concluido', title: 'Concluído', color: '#10B981' },
] as const

export default function OperacaoPage() {
  const [territories, setTerritories] = useState<Territory[]>([])
  const [leaders, setLeaders] = useState<TerritoryLeader[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showLeaderModal, setShowLeaderModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingLeader, setEditingLeader] = useState<TerritoryLeader | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [expandedTerritories, setExpandedTerritories] = useState<Set<string>>(new Set())
  const [selectedTerritoryForLeader, setSelectedTerritoryForLeader] = useState<string>('')
  const [selectedTerritoryForTask, setSelectedTerritoryForTask] = useState<string>('')

  useEffect(() => {
    fetchData()
  }, [])

  // Expandir todos os territórios quando forem carregados pela primeira vez
  useEffect(() => {
    if (territories.length > 0 && expandedTerritories.size === 0) {
      setExpandedTerritories(new Set(territories.map(t => t.id)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [territories])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [territoriesRes, leadersRes, tasksRes] = await Promise.all([
        fetch('/api/operacao/territories'),
        fetch('/api/operacao/leaders'),
        fetch('/api/operacao/tasks'),
      ])

      if (territoriesRes.ok) {
        const territoriesData = await territoriesRes.json()
        setTerritories(territoriesData)
      }

      if (leadersRes.ok) {
        const leadersData = await leadersRes.json()
        setLeaders(leadersData)
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setTasks(tasksData)
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveLeader = async (leaderData: Omit<TerritoryLeader, 'id' | 'created_at' | 'updated_at' | 'territory'>) => {
    if (editingLeader) {
      const response = await fetch(`/api/operacao/leaders/${editingLeader.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaderData),
      })
      if (!response.ok) throw new Error('Erro ao atualizar líder')
    } else {
      const response = await fetch('/api/operacao/leaders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaderData),
      })
      if (!response.ok) throw new Error('Erro ao criar líder')
    }
    await fetchData()
  }

  const handleDeleteLeader = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este líder?')) return

    const response = await fetch(`/api/operacao/leaders/${id}`, {
      method: 'DELETE',
    })
    if (response.ok) {
      await fetchData()
    } else {
      alert('Erro ao excluir líder')
    }
  }

  const handleSaveTask = async (taskData: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'territory' | 'leader' | 'assigned_leader'>) => {
    if (editingTask) {
      const response = await fetch(`/api/operacao/tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })
      if (!response.ok) throw new Error('Erro ao atualizar tarefa')
    } else {
      const response = await fetch('/api/operacao/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })
      if (!response.ok) throw new Error('Erro ao criar tarefa')
    }
    await fetchData()
  }

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return

    const response = await fetch(`/api/operacao/tasks/${id}`, {
      method: 'DELETE',
    })
    if (response.ok) {
      await fetchData()
    } else {
      alert('Erro ao excluir tarefa')
    }
  }

  const handleTaskMove = async (taskId: string, newStatus: Task['status']) => {
    const response = await fetch(`/api/operacao/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (response.ok) {
      await fetchData()
    }
  }

  // Calcular KPIs globais
  const backlogCount = tasks.filter(t => t.status === 'backlog').length
  const inProgressCount = tasks.filter(t => t.status === 'em-andamento').length
  const completedCount = tasks.filter(t => t.status === 'concluido').length
  const overdueCount = tasks.filter(t => 
    t.due_date && new Date(t.due_date) < new Date() && t.status !== 'concluido'
  ).length

  const toggleTerritoryExpansion = (territoryId: string) => {
    setExpandedTerritories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(territoryId)) {
        newSet.delete(territoryId)
      } else {
        newSet.add(territoryId)
      }
      return newSet
    })
  }

  const expandAllTerritories = () => {
    setExpandedTerritories(new Set(territories.map(t => t.id)))
  }

  const collapseAllTerritories = () => {
    setExpandedTerritories(new Set())
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title="Operação & Equipe" subtitle="Garanta ritmo e escala" />

      <div className="px-4 py-6 lg:px-6">
        {/* Controles Globais */}
        <div className="bg-surface rounded-2xl border border-border p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={expandAllTerritories}
              className="px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text-strong rounded-lg hover:bg-background transition-colors"
            >
              Expandir Todos
            </button>
            <button
              onClick={collapseAllTerritories}
              className="px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text-strong rounded-lg hover:bg-background transition-colors"
            >
              Recolher Todos
            </button>
          </div>
        </div>

        {/* Fluxo de Status - Protocolo */}
        <div className="mb-6">
          <div className="bg-surface rounded-2xl border border-border p-6">
            <div className="relative py-8">
              <div className="flex items-start justify-between relative">
                {/* Linha conectora horizontal - atrás dos círculos */}
                <div className="hidden sm:block absolute top-6 left-0 right-0 h-0.5 bg-border z-0" style={{ marginLeft: '1.5rem', marginRight: '1.5rem' }} />
                
                {/* Backlog */}
                <div className="flex flex-col items-center flex-1 relative z-20">
                  <div className="relative mb-3 z-20">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative z-20 ${
                      backlogCount > 0 
                        ? 'bg-primary border-2 border-primary' 
                        : 'bg-surface border-2 border-border'
                    }`}>
                      <ListTodo className={`w-6 h-6 ${
                        backlogCount > 0 ? 'text-white' : 'text-text-muted'
                      }`} />
                    </div>
                    {backlogCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-surface">
                        <span className="text-xs font-bold text-white">{backlogCount}</span>
                      </div>
                    )}
                  </div>
                  <p className={`text-xs font-medium text-center ${
                    backlogCount > 0 ? 'text-text-strong font-semibold' : 'text-text-muted'
                  }`}>
                    Backlog
                  </p>
                  <p className={`text-xs mt-1 ${
                    backlogCount > 0 ? 'text-text-strong font-semibold' : 'text-text-muted'
                  }`}>
                    {backlogCount}
                  </p>
                </div>

                {/* Linha conectora entre Backlog e Em Andamento */}
                <div className="hidden sm:block flex-1 h-0.5 relative z-0" style={{ top: '1.5rem' }}>
                  <div className={`w-full h-full ${
                    inProgressCount > 0 || completedCount > 0 
                      ? 'bg-primary' 
                      : 'bg-border'
                  }`} />
                </div>

                {/* Em Andamento */}
                <div className="flex flex-col items-center flex-1 relative z-20">
                  <div className="relative mb-3 z-20">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative z-20 ${
                      inProgressCount > 0 
                        ? 'bg-primary border-2 border-primary' 
                        : 'bg-surface border-2 border-border'
                    }`}>
                      <PlayCircle className={`w-6 h-6 ${
                        inProgressCount > 0 ? 'text-white' : 'text-text-muted'
                      }`} />
                    </div>
                    {inProgressCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-surface">
                        <span className="text-xs font-bold text-white">{inProgressCount}</span>
                      </div>
                    )}
                  </div>
                  <p className={`text-xs font-medium text-center ${
                    inProgressCount > 0 ? 'text-text-strong font-semibold' : 'text-text-muted'
                  }`}>
                    Em Andamento
                  </p>
                  <p className={`text-xs mt-1 ${
                    inProgressCount > 0 ? 'text-text-strong font-semibold' : 'text-text-muted'
                  }`}>
                    {inProgressCount}
                  </p>
                </div>

                {/* Linha conectora entre Em Andamento e Concluídas */}
                <div className="hidden sm:block flex-1 h-0.5 relative z-0" style={{ top: '1.5rem' }}>
                  <div className={`w-full h-full ${
                    completedCount > 0 
                      ? 'bg-status-success' 
                      : 'bg-border'
                  }`} />
                </div>

                {/* Concluídas */}
                <div className="flex flex-col items-center flex-1 relative z-20">
                  <div className="relative mb-3 z-20">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative z-20 ${
                      completedCount > 0 
                        ? 'bg-status-success border-2 border-status-success' 
                        : 'bg-surface border-2 border-border'
                    }`}>
                      <CheckCircle2 className={`w-6 h-6 ${
                        completedCount > 0 ? 'text-white' : 'text-text-muted'
                      }`} />
                    </div>
                    {completedCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-status-success rounded-full flex items-center justify-center border-2 border-surface">
                        <span className="text-xs font-bold text-white">{completedCount}</span>
                      </div>
                    )}
                  </div>
                  <p className={`text-xs font-medium text-center ${
                    completedCount > 0 ? 'text-text-strong font-semibold' : 'text-text-muted'
                  }`}>
                    Concluídas
                  </p>
                  <p className={`text-xs mt-1 ${
                    completedCount > 0 ? 'text-text-strong font-semibold' : 'text-text-muted'
                  }`}>
                    {completedCount}
                  </p>
                </div>

                {/* Linha conectora entre Concluídas e Atrasadas */}
                <div className="hidden sm:block flex-1 h-0.5 relative z-0" style={{ top: '1.5rem' }}>
                  <div className={`w-full h-full ${
                    overdueCount > 0 
                      ? 'bg-status-error' 
                      : 'bg-border'
                  }`} />
                </div>

                {/* Atrasadas */}
                <div className="flex flex-col items-center flex-1 relative z-20">
                  <div className="relative mb-3 z-20">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all relative z-20 ${
                      overdueCount > 0 
                        ? 'bg-status-error border-2 border-status-error' 
                        : 'bg-surface border-2 border-border'
                    }`}>
                      <AlertCircle className={`w-6 h-6 ${
                        overdueCount > 0 ? 'text-white' : 'text-text-muted'
                      }`} />
                    </div>
                    {overdueCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-status-error rounded-full flex items-center justify-center border-2 border-surface">
                        <span className="text-xs font-bold text-white">{overdueCount}</span>
                      </div>
                    )}
                  </div>
                  <p className={`text-xs font-medium text-center ${
                    overdueCount > 0 ? 'text-text-strong font-semibold' : 'text-text-muted'
                  }`}>
                    Atrasadas
                  </p>
                  <p className={`text-xs mt-1 ${
                    overdueCount > 0 ? 'text-text-strong font-semibold' : 'text-text-muted'
                  }`}>
                    {overdueCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Territórios */}
        {loading ? (
          <div className="bg-surface rounded-2xl border border-border p-12 text-center">
            <p className="text-text-muted">Carregando...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {territories.map((territory) => {
              const territoryLeaders = leaders.filter(l => l.territory_id === territory.id)
              const territoryTasks = tasks.filter(t => t.territory_id === territory.id)
              const isExpanded = expandedTerritories.has(territory.id)

              return (
                <div key={territory.id} className="bg-surface rounded-2xl border border-border">
                  {/* Header expansível */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-background/50 transition-colors flex items-center justify-between"
                    onClick={() => toggleTerritoryExpansion(territory.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-text-muted" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-text-muted" />
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-text-strong">{territory.name}</h3>
                        <p className="text-xs text-text-muted">
                          {territoryLeaders.length} {territoryLeaders.length === 1 ? 'líder' : 'líderes'} • {territoryTasks.length} {territoryTasks.length === 1 ? 'tarefa' : 'tarefas'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedTerritoryForLeader(territory.id)
                        setEditingLeader(null)
                        setShowLeaderModal(true)
                      }}
                      className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      Novo Líder
                    </button>
                  </div>

                  {/* Conteúdo expansível */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-6 border-t border-border">
                      {/* Informações do Território */}
                      <div className="pt-4">
                        {territory.description && (
                          <p className="text-sm text-text-muted mb-3">{territory.description}</p>
                        )}
                        {territory.vocations && territory.vocations.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {territory.vocations.map((vocation, idx) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-1 bg-primary-soft text-primary rounded-full"
                              >
                                {vocation}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Lista de Líderes */}
                      {territoryLeaders.length > 0 ? (
                        <div>
                          <h4 className="text-sm font-semibold text-text-strong mb-3">Líderes</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {territoryLeaders.map((leader) => (
                              <div
                                key={leader.id}
                                className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-text-strong">{leader.name}</h4>
                                    {leader.role && (
                                      <p className="text-sm text-text-muted">{leader.role}</p>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setEditingLeader(leader)
                                        setShowLeaderModal(true)
                                      }}
                                      className="p-1 rounded hover:bg-background transition-colors"
                                      title="Editar"
                                    >
                                      <Edit2 className="w-4 h-4 text-text-muted" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDeleteLeader(leader.id)
                                      }}
                                      className="p-1 rounded hover:bg-background transition-colors"
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-4 h-4 text-status-error" />
                                    </button>
                                  </div>
                                </div>
                                {leader.phone && (
                                  <p className="text-xs text-text-muted">📞 {leader.phone}</p>
                                )}
                                {leader.email && (
                                  <p className="text-xs text-text-muted">✉️ {leader.email}</p>
                                )}
                                <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${
                                  leader.status === 'ativo' 
                                    ? 'bg-green-100 text-green-700' 
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {leader.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-text-muted text-sm">
                          Nenhum líder cadastrado neste território
                        </div>
                      )}

                      {/* Kanban */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-semibold text-text-strong">Tarefas</h4>
                          <button
                            onClick={() => {
                              setSelectedTerritoryForTask(territory.id)
                              setEditingTask(null)
                              setShowTaskModal(true)
                            }}
                            className="px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Nova Tarefa
                          </button>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '400px' }}>
                          {statusColumns.map((column) => {
                            const columnTasks = territoryTasks.filter(t => t.status === column.id)
                            return (
                              <KanbanColumn
                                key={column.id}
                                title={column.title}
                                status={column.id}
                                tasks={columnTasks}
                                onTaskClick={(task) => {
                                  setEditingTask(task)
                                  setShowTaskModal(true)
                                }}
                                onTaskMove={handleTaskMove}
                                color={column.color}
                              />
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modais */}
      {showLeaderModal && (
        <LeaderModal
          leader={editingLeader}
          territories={territories}
          initialTerritoryId={selectedTerritoryForLeader}
          onClose={() => {
            setShowLeaderModal(false)
            setEditingLeader(null)
            setSelectedTerritoryForLeader('')
          }}
          onSave={handleSaveLeader}
        />
      )}

      {showTaskModal && (
        <TaskModal
          task={editingTask}
          territories={territories}
          leaders={leaders}
          initialTerritoryId={selectedTerritoryForTask}
          onClose={() => {
            setShowTaskModal(false)
            setEditingTask(null)
            setSelectedTerritoryForTask('')
          }}
          onSave={handleSaveTask}
        />
      )}
    </div>
  )
}
