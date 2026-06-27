'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckSquare, Folder, Loader2, ScanFace, Square, X } from 'lucide-react'
import type { PhotofinderEventFolder } from '@/lib/photofinder/event-folders'
import { UNCLASSIFIED_EVENT_LABEL } from '@/lib/photofinder/event-folders'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

export type PhotofinderRecognizeMode = 'identify' | 'reidentify'

interface PhotofinderRecognizeFolderModalProps {
  open: boolean
  mode?: PhotofinderRecognizeMode
  folders: PhotofinderEventFolder[]
  loading?: boolean
  onClose: () => void
  onConfirm: (selectedFolderIds: string[]) => void
}

export function PhotofinderRecognizeFolderModal({
  open,
  mode = 'identify',
  folders,
  loading,
  onClose,
  onConfirm,
}: PhotofinderRecognizeFolderModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const isReidentify = mode === 'reidentify'

  useEffect(() => {
    if (!open) return
    setSelected(new Set(folders.map((f) => f.id)))
  }, [open, folders])

  const allSelected = folders.length > 0 && folders.every((f) => selected.has(f.id))
  const selectedCount = selected.size
  const totalPhotos = useMemo(
    () => folders.filter((f) => selected.has(f.id)).reduce((sum, f) => sum + f.count, 0),
    [folders, selected],
  )

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set())
      return
    }
    setSelected(new Set(folders.map((f) => f.id)))
  }, [allSelected, folders])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[330] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[rgb(var(--color-border-secondary))] bg-bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recognize-folders-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgb(var(--color-border-secondary)/0.85)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8900A]/15">
              <ScanFace className="h-5 w-5 text-[#C8900A]" />
            </div>
            <div>
              <h2 id="recognize-folders-title" className="text-base font-semibold text-text-primary">
                {isReidentify ? 'Reidentificar pessoas' : 'Identificar pessoas'}
              </h2>
              <p className="mt-0.5 text-xs text-text-muted">
                {isReidentify
                  ? 'Reanalisa todas as fotos das pastas selecionadas, inclusive as já etiquetadas (útil após cadastrar novas pessoas ou melhorar detecção multi-rosto).'
                  : 'Escolha pastas de evento ou, dentro de uma pasta, use Selecionar fotos → Identificar selecionadas para processar só algumas imagens.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-bg-muted"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-[rgb(var(--color-border-secondary)/0.5)] px-5 py-2">
          <button
            type="button"
            onClick={toggleAll}
            disabled={folders.length === 0}
            className="flex items-center gap-1.5 text-xs text-[#C8900A] hover:underline disabled:opacity-50"
          >
            {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
          </button>
          <span className="text-xs text-text-muted">
            {selectedCount} {selectedCount === 1 ? 'pasta' : 'pastas'} · ~{totalPhotos} fotos
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#C8900A]" />
            </div>
          ) : folders.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              Nenhuma pasta de evento encontrada. Sincronize fotos primeiro.
            </p>
          ) : (
            <ul className="space-y-1">
              {folders.map((folder) => {
                const checked = selected.has(folder.id)
                const unclassified = folder.name === UNCLASSIFIED_EVENT_LABEL
                return (
                  <li key={folder.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                        checked ? 'bg-[#C8900A]/8' : 'hover:bg-bg-muted',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(folder.id)}
                        className="h-4 w-4 rounded border-[rgb(var(--color-border-secondary))] accent-[#C8900A]"
                      />
                      <Folder
                        className={cn(
                          'h-4 w-4 shrink-0',
                          unclassified ? 'text-text-muted' : 'text-[#C8900A]',
                        )}
                        fill="currentColor"
                        fillOpacity={0.2}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                        {folder.name}
                      </span>
                      <span className="shrink-0 text-xs text-text-muted">
                        {folder.count} {folder.count === 1 ? 'foto' : 'fotos'}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex gap-2 border-t border-[rgb(var(--color-border-secondary)/0.85)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[rgb(var(--color-border-secondary))] px-4 py-2.5 text-sm text-text-muted hover:bg-bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => onConfirm([...selected])}
            className={cn(
              sidebarPrimaryCTAButtonClass,
              'flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-60',
            )}
          >
            <ScanFace className="h-4 w-4" />
            {isReidentify ? 'Reidentificar' : 'Identificar'} ({selectedCount})
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
