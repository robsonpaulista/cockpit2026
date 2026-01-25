'use client'

import { Task } from '@/types'
import { TaskCard } from './task-card'

interface KanbanColumnProps {
  title: string
  status: Task['status']
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onTaskMove: (taskId: string, newStatus: Task['status']) => void
  color: string
}

export function KanbanColumn({ title, status, tasks, onTaskClick, onTaskMove, color }: KanbanColumnProps) {
  const filteredTasks = tasks.filter(task => task.status === status)

  return (
    <div className="flex flex-col h-full min-w-[280px]">
      {/* Header da coluna */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold text-primary">{title}</h3>
          <span className="text-xs text-secondary bg-background px-2 py-0.5 rounded-full">
            {filteredTasks.length}
          </span>
        </div>
      </div>

      {/* Lista de tarefas */}
      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8 text-secondary text-sm">
            Nenhuma tarefa
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              onMove={(newStatus) => onTaskMove(task.id, newStatus)}
            />
          ))
        )}
      </div>
    </div>
  )
}


