'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, Folder, Loader2, X } from 'lucide-react'
import { photofinderApi } from '@/lib/photofinder-api'
import type { PhotofinderDriveFolder, PhotofinderSyncTags } from '@/lib/photofinder/types'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

interface PhotofinderFolderSelectorProps {
  isOpen: boolean
  onClose: () => void
  onSelectFolder: (
    folderId: string,
    folderName: string,
    tags?: PhotofinderSyncTags,
  ) => void | Promise<void>
}

export function PhotofinderFolderSelector({
  isOpen,
  onClose,
  onSelectFolder,
}: PhotofinderFolderSelectorProps) {
  const [folders, setFolders] = useState<PhotofinderDriveFolder[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<PhotofinderDriveFolder | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [personTag, setPersonTag] = useState('')
  const [locationTag, setLocationTag] = useState('')
  const [eventTag, setEventTag] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadFolders = useCallback(async () => {
    try {
      setLoading(true)
      const response = await photofinderApi.getFolders()
      setFolders(response.tree ?? [])
    } catch (error) {
      console.error('Erro ao carregar pastas:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) void loadFolders()
  }, [isOpen, loadFolders])

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const handleConfirm = async () => {
    if (!selectedFolder) return
    const tags: PhotofinderSyncTags = {}
    if (personTag.trim()) tags.person = personTag.trim()
    if (locationTag.trim()) tags.location = locationTag.trim()
    if (eventTag.trim()) tags.event = eventTag.trim()

    try {
      setSubmitting(true)
      await onSelectFolder(
        selectedFolder.id,
        selectedFolder.name,
        Object.keys(tags).length > 0 ? tags : undefined,
      )
      setSelectedFolder(null)
      setPersonTag('')
      setLocationTag('')
      setEventTag('')
    } catch (error) {
      console.error('Erro ao iniciar sincronização:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const renderFolder = (folder: PhotofinderDriveFolder, level = 0) => {
    const hasChildren = Boolean(folder.children?.length)
    const isExpanded = expandedFolders.has(folder.id)
    const isSelected = selectedFolder?.id === folder.id

    return (
      <div key={folder.id}>
        <button
          type="button"
          onClick={() => setSelectedFolder(folder)}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
            isSelected
              ? 'border border-[#C8900A] bg-[#C8900A]/10 text-text-primary'
              : 'hover:bg-bg-muted text-text-primary',
          )}
          style={{ paddingLeft: `${12 + level * 16}px` }}
        >
          {hasChildren ? (
            <span
              role="presentation"
              onClick={(e) => {
                e.stopPropagation()
                toggleFolder(folder.id)
              }}
              className="rounded p-0.5 hover:bg-bg-surface"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-text-muted" />
              ) : (
                <ChevronRight className="h-4 w-4 text-text-muted" />
              )}
            </span>
          ) : (
            <span className="w-5" />
          )}
          <Folder className="h-4 w-4 shrink-0 text-[#C8900A]" />
          <span className="truncate">{folder.name}</span>
        </button>
        {hasChildren && isExpanded
          ? folder.children!.map((child) => renderFolder(child, level + 1))
          : null}
      </div>
    )
  }

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-[rgb(var(--color-border-secondary))] bg-bg-surface shadow-2xl">
        <div className="flex items-start justify-between border-b border-[rgb(var(--color-border-secondary)/0.85)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Escolher pasta do Drive</h2>
            <p className="mt-1 text-sm text-text-muted">
              Navegue pelas pastas da conta conectada e sincronize só o que selecionar (inclui
              subpastas).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-2 text-text-muted hover:bg-bg-muted disabled:opacity-40"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#C8900A]" />
              Carregando pastas do Google Drive…
            </div>
          ) : folders.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-muted">
              Nenhuma pasta encontrada nesta conta do Drive.
            </p>
          ) : (
            <div className="space-y-0.5">{folders.map((folder) => renderFolder(folder))}</div>
          )}

          {selectedFolder ? (
            <div className="mt-5 space-y-3 border-t border-[rgb(var(--color-border-secondary)/0.85)] pt-4">
              <p className="text-xs font-medium text-text-muted">
                Tags opcionais para todas as fotos de «{selectedFolder.name}»
              </p>
              <input
                type="text"
                value={personTag}
                onChange={(e) => setPersonTag(e.target.value)}
                placeholder="Pessoa"
                className="w-full rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={locationTag}
                onChange={(e) => setLocationTag(e.target.value)}
                placeholder="Local"
                className="w-full rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={eventTag}
                onChange={(e) => setEventTag(e.target.value)}
                placeholder="Evento"
                className="w-full rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-2 text-sm"
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-muted/40 px-5 py-4">
          <p className="text-sm text-text-muted">
            {selectedFolder ? (
              <>
                Selecionada: <span className="font-medium text-text-primary">{selectedFolder.name}</span>
              </>
            ) : (
              'Selecione uma pasta na árvore acima'
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[rgb(var(--color-border-secondary))] px-4 py-2 text-sm text-text-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!selectedFolder || submitting}
              onClick={() => void handleConfirm()}
              className={cn(
                sidebarPrimaryCTAButtonClass,
                'px-4 py-2 text-sm disabled:opacity-50',
              )}
            >
              {submitting ? 'Sincronizando…' : 'Sincronizar pasta'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
