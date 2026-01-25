'use client'

import { Task } from '@/types'
import { Clock, User, MapPin } from 'lucide-react'
// Formatação de data simples
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR')
}

interface TaskCardProps {
  task: Task
  onClick: () => void
  onMove: (newStatus: Task['status']) => void
}

const priorityColors = {
  baixa: 'bg-gray-100 text-gray-700',
  media: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
}

const priorityLabels = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
}

export function TaskCard({ task, onClick, onMove }: TaskCardProps) {
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'concluido'

  return (
    <div
      className="bg-surface border border-card rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      {/* Título e prioridade */}
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-primary flex-1 line-clamp-2">
          {task.title}
        </h4>
        <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${priorityColors[task.priority]}`}>
          {priorityLabels[task.priority]}
        </span>
      </div>

      {/* Descrição */}
      {task.description && (
        <p className="text-xs text-secondary mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Informações */}
      <div className="space-y-1 mt-3">
        {/* Território */}
        {task.territory && (
          <div className="flex items-center gap-1 text-xs text-secondary">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{task.territory.name}</span>
          </div>
        )}

        {/* Líder atribuído */}
        {task.assigned_leader && (
          <div className="flex items-center gap-1 text-xs text-secondary">
            <User className="w-3 h-3" />
            <span className="truncate">{task.assigned_leader.name}</span>
          </div>
        )}

        {/* Data de vencimento */}
        {task.due_date && (
          <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-secondary'}`}>
            <Clock className="w-3 h-3" />
            <span>
              {formatDate(task.due_date)}
              {isOverdue && ' (Atrasada)'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

