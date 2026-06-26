'use client'

import { useEffect, useState } from 'react'
import { CheckSquare, Loader2, Square, Tag, X } from 'lucide-react'
import { photofinderApi } from '@/lib/photofinder-api'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

interface PhotofinderPhotoBulkBarProps {
  selectionMode: boolean
  selectedIds: string[]
  pagePhotoCount: number
  allPageSelected: boolean
  onToggleSelectionMode: () => void
  onSelectAllPage: () => void
  onApplied: (result: { updated: number; eventType: string | null; cleared: boolean }) => void
}

export function PhotofinderPhotoBulkBar({
  selectionMode,
  selectedIds,
  pagePhotoCount,
  allPageSelected,
  onToggleSelectionMode,
  onSelectAllPage,
  onApplied,
}: PhotofinderPhotoBulkBarProps) {
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const [eventType, setEventType] = useState('')
  const [applying, setApplying] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    void photofinderApi
      .getEventTypes()
      .then(setEventTypes)
      .catch(() => undefined)
  }, [])

  const applyEvent = async (clear = false) => {
    if (selectedIds.length === 0) {
      setMessage('Selecione ao menos uma foto.')
      setIsError(true)
      return
    }

    const value = clear ? null : eventType.trim()
    if (!clear && !value) {
      setMessage('Informe o nome do evento.')
      setIsError(true)
      return
    }

    try {
      setApplying(true)
      setMessage(null)
      const result = await photofinderApi.bulkUpdatePhotos({
        ids: selectedIds,
        event_type: value,
      })
      setIsError(false)
      setMessage(
        clear
          ? `${result.updated} foto(s) sem evento.`
          : result.updated < result.requested
            ? `${result.updated} de ${result.requested} foto(s) atualizadas para "${value}".`
            : `Evento "${value}" atribuído a ${result.updated} foto(s).`,
      )
      onApplied({
        updated: result.updated,
        eventType: value,
        cleared: clear,
      })
      void photofinderApi.getEventTypes().then(setEventTypes).catch(() => undefined)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao atribuir evento')
      setIsError(true)
    } finally {
      setApplying(false)
    }
  }

  if (!selectionMode && selectedIds.length === 0) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onToggleSelectionMode}
          disabled={pagePhotoCount === 0}
          className="flex items-center gap-2 rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-2 text-sm text-text-primary hover:bg-bg-muted disabled:opacity-50"
        >
          <CheckSquare className="h-4 w-4" />
          Selecionar fotos
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-3 py-2.5">
        <button
          type="button"
          onClick={onToggleSelectionMode}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--color-border-secondary))] px-2.5 py-1.5 text-xs text-text-muted hover:bg-bg-muted"
          title="Sair da seleção"
        >
          <X className="h-3.5 w-3.5" />
          Cancelar
        </button>

        <button
          type="button"
          onClick={onSelectAllPage}
          disabled={pagePhotoCount === 0}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--color-border-secondary))] px-2.5 py-1.5 text-xs text-text-muted hover:bg-bg-muted disabled:opacity-50"
        >
          {allPageSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          {allPageSelected ? 'Desmarcar página' : 'Selecionar página'}
        </button>

        <span className="text-xs text-text-muted">
          {selectedIds.length} {selectedIds.length === 1 ? 'selecionada' : 'selecionadas'}
        </span>

        <div className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
          <div className="relative min-w-[180px] flex-1 sm:flex-none">
            <Tag className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#C8900A]" />
            <input
              list="photofinder-event-types"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="Nome do evento"
              className="w-full rounded-lg border border-[rgb(var(--color-border-secondary))] py-1.5 pl-8 pr-2 text-sm sm:w-52"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void applyEvent(false)
              }}
            />
            <datalist id="photofinder-event-types">
              {eventTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          <button
            type="button"
            disabled={applying || selectedIds.length === 0}
            onClick={() => void applyEvent(false)}
            className={cn(
              sidebarPrimaryCTAButtonClass,
              'flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-60',
            )}
          >
            {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Atribuir evento
          </button>

          <button
            type="button"
            disabled={applying || selectedIds.length === 0}
            onClick={() => void applyEvent(true)}
            className="rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-1.5 text-xs text-text-muted hover:bg-bg-muted disabled:opacity-50"
          >
            Limpar evento
          </button>
        </div>
      </div>

      {message ? (
        <p
          className={cn(
            'text-xs',
            isError ? 'text-status-danger' : 'text-status-success',
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
