'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Cloud,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  LogOut,
  RefreshCw,
  ScanFace,
} from 'lucide-react'
import { PhotofinderEventExplorer } from '@/components/arquivos/photofinder-event-explorer'
import { PhotofinderFolderSelector } from '@/components/arquivos/photofinder-folder-selector'
import { PhotofinderPhotoBulkBar } from '@/components/arquivos/photofinder-photo-bulk-bar'
import { PhotofinderPhotoFilters as PhotofinderPhotoFiltersPanel } from '@/components/arquivos/photofinder-photo-filters'
import { PhotofinderPhotoGallery } from '@/components/arquivos/photofinder-photo-gallery'
import { PhotofinderRecognizeFolderModal } from '@/components/arquivos/photofinder-recognize-folder-modal'
import { PhotofinderSyncProgressModal } from '@/components/arquivos/photofinder-sync-progress-modal'
import { usePhotofinderAuth } from '@/hooks/use-photofinder-auth'
import { usePhotofinderPhotos } from '@/hooks/use-photofinder-photos'
import { usePhotofinderSync } from '@/hooks/use-photofinder-sync'
import { photofinderApi } from '@/lib/photofinder-api'
import {
  adjustEventFolderCounts,
  eventFolderToFilters,
  patchEventFolderCount,
  type PhotofinderEventFolder,
} from '@/lib/photofinder/event-folders'
import type { PhotofinderPhotoFilters, PhotofinderSyncTags } from '@/lib/photofinder/types'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

export function FotosDrivePanel() {
  const searchParams = useSearchParams()
  const [folderSelectorOpen, setFolderSelectorOpen] = useState(false)
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null)
  const [lastSyncIsError, setLastSyncIsError] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [eventFolderId, setEventFolderId] = useState<string | null>(null)
  const [eventFolderName, setEventFolderName] = useState<string | null>(null)
  const [eventFolders, setEventFolders] = useState<PhotofinderEventFolder[]>([])
  const [eventFoldersLoading, setEventFoldersLoading] = useState(false)
  const [eventFoldersTotal, setEventFoldersTotal] = useState(0)
  const [eventFoldersFiltered, setEventFoldersFiltered] = useState(false)
  const [browseFilters, setBrowseFilters] = useState<Pick<PhotofinderPhotoFilters, 'search' | 'person' | 'city'>>({})
  const [recognizeModalOpen, setRecognizeModalOpen] = useState(false)
  const [recognizeModalMode, setRecognizeModalMode] = useState<'identify' | 'reidentify'>('identify')

  const { authenticated, loading: authLoading, user, photosCount, login, logout, refresh: refreshAuth } =
    usePhotofinderAuth()

  const insideEventFolder = eventFolderId !== null

  const { photos, filters, loading, error: photosError, pagination, updateFilters, goToPage, refresh } =
    usePhotofinderPhotos({}, authenticated && insideEventFolder)

  const loadEventFolders = useCallback(
    async (options?: {
      silent?: boolean
      filters?: Pick<PhotofinderPhotoFilters, 'search' | 'person' | 'city'>
    }) => {
      if (!authenticated) return
      const activeFilters = options?.filters ?? browseFilters
      try {
        if (!options?.silent) setEventFoldersLoading(true)
        const data = await photofinderApi.getEventFolders(activeFilters)
        setEventFolders(data.folders)
        setEventFoldersTotal(data.totalPhotos)
        setEventFoldersFiltered(Boolean(data.filtered))
      } catch (err) {
        console.error('Erro ao carregar pastas de evento:', err)
      } finally {
        if (!options?.silent) setEventFoldersLoading(false)
      }
    },
    [authenticated, browseFilters],
  )

  useEffect(() => {
    if (authenticated) void loadEventFolders()
  }, [authenticated, loadEventFolders])

  const refreshGallery = useCallback(async () => {
    await refresh()
    await loadEventFolders({ filters: browseFilters })
  }, [refresh, loadEventFolders, browseFilters])

  const handleFilterChange = useCallback(
    (partial: Partial<PhotofinderPhotoFilters>) => {
      const folderFilters = eventFolderId ? eventFolderToFilters(eventFolderId) : {}
      const nextBrowse: Pick<PhotofinderPhotoFilters, 'search' | 'person' | 'city'> =
        Object.keys(partial).length === 0
          ? {}
          : {
              search: partial.search,
              person: partial.person,
              city: partial.city,
            }

      setBrowseFilters(nextBrowse)

      if (Object.keys(partial).length === 0) {
        if (insideEventFolder) {
          updateFilters(folderFilters)
        } else {
          void loadEventFolders({ filters: {} })
        }
        return
      }

      const merged = { ...nextBrowse, ...folderFilters }
      if (insideEventFolder) {
        updateFilters(merged)
      } else {
        void loadEventFolders({ filters: nextBrowse })
      }
    },
    [eventFolderId, insideEventFolder, loadEventFolders, updateFilters],
  )

  const openEventFolder = useCallback(
    (folder: PhotofinderEventFolder) => {
      setEventFolderId(folder.id)
      setEventFolderName(folder.name)
      setSelectionMode(false)
      setSelectedIds(new Set())
      const folderFilters = eventFolderToFilters(folder.id)
      updateFilters({
        ...browseFilters,
        eventType: folderFilters.eventType,
        withoutEvent: folderFilters.withoutEvent,
      })
    },
    [browseFilters, updateFilters],
  )

  const navigateToRoot = useCallback(() => {
    setEventFolderId(null)
    setEventFolderName(null)
    setSelectionMode(false)
    setSelectedIds(new Set())
    updateFilters({ eventType: undefined, withoutEvent: undefined, ...browseFilters })
    void loadEventFolders({ silent: true, filters: browseFilters })
  }, [browseFilters, loadEventFolders, updateFilters])

  const {
    syncStatus,
    progress,
    isInProgress,
    startSync,
    startRecognitionOnly,
    resetProgress,
    refresh: refreshSync,
    formatEta,
  } = usePhotofinderSync(refreshGallery)

  useEffect(() => {
    setSelectedIds(new Set())
  }, [pagination.page])

  const togglePhotoSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) setSelectedIds(new Set())
      return !prev
    })
  }, [])

  const allPageSelected =
    photos.length > 0 && photos.every((p) => selectedIds.has(p.id))

  const toggleSelectAllPage = useCallback(() => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const p of photos) next.delete(p.id)
        return next
      })
      return
    }
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const p of photos) next.add(p.id)
      return next
    })
  }, [allPageSelected, photos])

  const handleBulkApplied = useCallback(
    async (result: { updated: number; eventType: string | null; cleared: boolean }) => {
      setSelectedIds(new Set())

      if (eventFolderId && result.updated > 0) {
        setEventFolders((prev) =>
          adjustEventFolderCounts(prev, {
            fromFolderId: eventFolderId,
            toEventType: result.cleared ? null : result.eventType,
            delta: result.updated,
          }),
        )
      }

      const response = await refresh()
      if (eventFolderId && response?.pagination.total != null) {
        setEventFolders((prev) => patchEventFolderCount(prev, eventFolderId, response.pagination.total))
      }
      void loadEventFolders({ silent: true, filters: browseFilters })
    },
    [eventFolderId, refresh, loadEventFolders, browseFilters],
  )

  const currentFolderCount = insideEventFolder ? pagination.total : null
  const displayedPhotoCount = insideEventFolder
    ? pagination.total
    : eventFoldersFiltered
      ? eventFoldersTotal
      : eventFoldersTotal || photosCount || 0
  const filtersPanelValue: PhotofinderPhotoFilters = insideEventFolder
    ? filters
    : browseFilters

  useEffect(() => {
    if (!eventFolderId || !insideEventFolder) return
    setEventFolders((prev) => patchEventFolderCount(prev, eventFolderId, pagination.total))
  }, [pagination.total, eventFolderId, insideEventFolder])

  const handledAuthCallback = useRef(false)

  useEffect(() => {
    const auth = searchParams.get('auth')
    if (auth !== 'success' && auth !== 'error') return
    if (handledAuthCallback.current) return
    handledAuthCallback.current = true
    void refreshAuth()
    void refresh()
  }, [searchParams, refreshAuth, refresh])

  const handleCloseSyncModal = useCallback(() => {
    if (progress.phase === 'completed') {
      setLastSyncMessage(progress.message)
      setLastSyncIsError(false)
    } else if (progress.phase === 'error') {
      setLastSyncMessage(progress.error ?? progress.message)
      setLastSyncIsError(true)
    }
    setSyncModalOpen(false)
    resetProgress()
    void refreshGallery()
    void refreshSync()
  }, [progress, resetProgress, refreshGallery, refreshSync])

  const handleIdentifyPeople = () => {
    setLastSyncMessage(null)
    setRecognizeModalMode('identify')
    void loadEventFolders({ silent: true })
    setRecognizeModalOpen(true)
  }

  const handleReidentifyPeople = () => {
    setLastSyncMessage(null)
    setRecognizeModalMode('reidentify')
    void loadEventFolders({ silent: true })
    setRecognizeModalOpen(true)
  }

  const handleRecognizeSelected = async (overwrite: boolean) => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setSyncModalOpen(true)
    setLastSyncMessage(null)
    setSelectionMode(false)
    setSelectedIds(new Set())
    try {
      await startRecognitionOnly([], { overwrite, photoIds: ids })
      await refreshGallery()
    } catch {
      // erro já refletido em progress.phase === 'error'
    }
  }

  const handleConfirmRecognize = async (selectedFolderIds: string[]) => {
    const overwrite = recognizeModalMode === 'reidentify'
    setRecognizeModalOpen(false)
    setSyncModalOpen(true)
    setLastSyncMessage(null)
    try {
      await startRecognitionOnly(selectedFolderIds, { overwrite })
      await refreshGallery()
    } catch {
      // erro já refletido em progress.phase === 'error'
    }
  }

  const handleSelectFolder = async (
    folderId: string,
    folderName: string,
    tags?: PhotofinderSyncTags,
  ) => {
    setFolderSelectorOpen(false)
    setSyncModalOpen(true)
    setLastSyncMessage(null)
    try {
      await startSync({ folderId, folderName, tags })
      await refreshGallery()
      await refreshSync()
    } catch {
      // erro já refletido em progress.phase === 'error'
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin text-[#C8900A]" />
        Verificando conexão com o Google Drive…
      </div>
    )
  }

  if (!authenticated) {
    const authError = searchParams.get('auth') === 'error'
    const authReason = searchParams.get('reason')
    const redirectUri = `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/arquivos/photofinder/auth/callback`

    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#C8900A]/15">
          <Cloud className="h-7 w-7 text-[#C8900A]" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary">Conectar Google Drive</h2>
        <p className="mt-2 text-sm text-text-muted">
          O PhotoFinder importa e organiza fotos do seu Drive com busca por pessoa, local e evento.
          É necessário autorizar o acesso ao Google (escopo somente leitura).
        </p>

        {authError ? (
          <div className="mt-4 rounded-lg border border-status-danger/30 bg-status-danger/5 px-3 py-3 text-left text-xs text-text-primary">
            <p className="font-medium text-status-danger">Falha ao conectar com o Google</p>
            <p className="mt-1 text-text-muted">
              {authReason === 'redirect_uri_mismatch' || authReason?.includes('redirect')
                ? 'A URL de retorno do Cockpit não está cadastrada no Google Cloud Console.'
                : `Motivo: ${authReason ?? 'desconhecido'}`}
            </p>
            <p className="mt-2 font-mono text-[11px] break-all text-text-muted">{redirectUri}</p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void login()}
          className={cn(sidebarPrimaryCTAButtonClass, 'mt-6 px-6 py-2.5 text-sm')}
        >
          Conectar conta Google
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PhotofinderFolderSelector
        isOpen={folderSelectorOpen}
        onClose={() => setFolderSelectorOpen(false)}
        onSelectFolder={handleSelectFolder}
      />

      <PhotofinderRecognizeFolderModal
        open={recognizeModalOpen}
        mode={recognizeModalMode}
        folders={eventFolders}
        loading={eventFoldersLoading}
        onClose={() => setRecognizeModalOpen(false)}
        onConfirm={(ids) => void handleConfirmRecognize(ids)}
      />

      <PhotofinderSyncProgressModal
        open={syncModalOpen}
        progress={progress}
        onClose={handleCloseSyncModal}
        formatEta={formatEta}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8900A]/15">
            <ImageIcon className="h-5 w-5 text-[#C8900A]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {displayedPhotoCount}{' '}
              {displayedPhotoCount === 1 ? 'foto' : 'fotos'}
              {!insideEventFolder && eventFoldersFiltered ? (
                <span className="font-normal text-text-muted"> com filtro</span>
              ) : null}
            </p>
            <p className="text-xs text-text-muted">
              {user?.email}
            {isInProgress ? ` · ${progress.message}` : null}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFolderSelectorOpen(true)}
            disabled={isInProgress}
            className={cn(
              sidebarPrimaryCTAButtonClass,
              'flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60',
            )}
          >
            {isInProgress ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
            {isInProgress
              ? progress.phase === 'recognizing'
                ? 'Identificando…'
                : 'Sincronizando…'
              : 'Sincronizar pasta…'}
          </button>
          <button
            type="button"
            onClick={() => void handleIdentifyPeople()}
            disabled={isInProgress}
            title="Identifica pessoas cadastradas nas fotos ainda não analisadas"
            className="flex items-center gap-2 rounded-lg border border-[rgb(var(--color-border-secondary))] px-4 py-2 text-sm text-text-primary hover:bg-bg-muted disabled:opacity-60"
          >
            {isInProgress && progress.phase === 'recognizing' && !progress.recognizeOverwrite ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ScanFace className="h-4 w-4" />
            )}
            Identificar pessoas
          </button>
          <button
            type="button"
            onClick={() => void handleReidentifyPeople()}
            disabled={isInProgress}
            title="Reanalisa todas as fotos das pastas selecionadas, inclusive as já etiquetadas"
            className="flex items-center gap-2 rounded-lg border border-[rgb(var(--color-border-secondary))] px-4 py-2 text-sm text-text-primary hover:bg-bg-muted disabled:opacity-60"
          >
            {isInProgress && progress.phase === 'recognizing' && progress.recognizeOverwrite ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ScanFace className="h-4 w-4" />
            )}
            Reidentificar
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={isInProgress}
            className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-2 text-xs text-text-muted hover:bg-bg-muted disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Desconectar
          </button>
        </div>
      </div>

      {photosError ? (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
          {photosError}
        </div>
      ) : null}

      {lastSyncMessage && !syncModalOpen ? (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-sm',
            lastSyncIsError
              ? 'border-status-danger/30 bg-status-danger/5 text-status-danger'
              : 'border-status-success/30 bg-status-success/5 text-text-primary',
          )}
        >
          {lastSyncMessage}
        </div>
      ) : null}

      <PhotofinderPhotoFiltersPanel filters={filtersPanelValue} onFilterChange={handleFilterChange} />

      <PhotofinderEventExplorer
        folders={eventFolders}
        foldersLoading={eventFoldersLoading}
        foldersFiltered={eventFoldersFiltered}
        currentFolderId={eventFolderId}
        currentFolderName={eventFolderName}
        currentFolderCount={currentFolderCount}
        onOpenFolder={openEventFolder}
        onNavigateRoot={navigateToRoot}
      >
        <div className="space-y-3">
          <PhotofinderPhotoBulkBar
            selectionMode={selectionMode}
            selectedIds={[...selectedIds]}
            pagePhotoCount={photos.length}
            allPageSelected={allPageSelected}
            recognitionDisabled={isInProgress}
            onToggleSelectionMode={toggleSelectionMode}
            onSelectAllPage={toggleSelectAllPage}
            onRecognizeSelected={(overwrite) => void handleRecognizeSelected(overwrite)}
            onApplied={(result) => void handleBulkApplied(result)}
          />

          <PhotofinderPhotoGallery
            photos={photos}
            loading={loading && !isInProgress}
            photosCountHint={photosCount}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={togglePhotoSelection}
          />

          {pagination.totalPages > 1 ? (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => goToPage(pagination.page - 1)}
                className="rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-sm text-text-muted">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => goToPage(pagination.page + 1)}
                className="rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-1.5 text-sm disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          ) : null}
        </div>
      </PhotofinderEventExplorer>
    </div>
  )
}
