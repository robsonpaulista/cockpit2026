'use client'

import { ChevronRight, Folder, FolderOpen, Loader2 } from 'lucide-react'
import type { PhotofinderEventFolder } from '@/lib/photofinder/event-folders'
import { UNCLASSIFIED_EVENT_LABEL } from '@/lib/photofinder/event-folders'
import { cn } from '@/lib/utils'

interface PhotofinderEventExplorerProps {
  folders: PhotofinderEventFolder[]
  foldersLoading: boolean
  foldersFiltered?: boolean
  currentFolderId: string | null
  currentFolderName: string | null
  currentFolderCount?: number | null
  onOpenFolder: (folder: PhotofinderEventFolder) => void
  onNavigateRoot: () => void
  children?: React.ReactNode
}

function FolderIcon({ unclassified }: { unclassified: boolean }) {
  return (
    <div
      className={cn(
        'flex h-14 w-14 items-center justify-center rounded-lg shadow-sm',
        unclassified ? 'bg-bg-muted text-text-muted' : 'bg-[#C8900A]/15 text-[#C8900A]',
      )}
    >
      <Folder className="h-8 w-8" fill="currentColor" fillOpacity={0.25} />
    </div>
  )
}

export function PhotofinderEventExplorer({
  folders,
  foldersLoading,
  foldersFiltered = false,
  currentFolderId,
  currentFolderName,
  currentFolderCount,
  onOpenFolder,
  onNavigateRoot,
  children,
}: PhotofinderEventExplorerProps) {
  const insideFolder = currentFolderId !== null

  return (
    <div className="space-y-3">
      <nav
        className="flex flex-wrap items-center gap-1 rounded-lg border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-3 py-2 text-sm"
        aria-label="Navegação por pastas"
      >
        <button
          type="button"
          onClick={onNavigateRoot}
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors',
            insideFolder
              ? 'text-[#C8900A] hover:bg-[#C8900A]/10'
              : 'font-medium text-text-primary',
          )}
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          Fotos do Drive
        </button>
        {insideFolder && currentFolderName ? (
          <>
            <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
            <span className="truncate font-medium text-text-primary">
              {currentFolderName}
              {currentFolderCount != null ? (
                <span className="font-normal text-text-muted">
                  {' '}
                  ({currentFolderCount} {currentFolderCount === 1 ? 'foto' : 'fotos'})
                </span>
              ) : null}
            </span>
          </>
        ) : null}
      </nav>

      {!insideFolder ? (
        foldersLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[#C8900A]" />
          </div>
        ) : folders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[rgb(var(--color-border-secondary))] px-6 py-16 text-center">
            <Folder className="mx-auto mb-3 h-10 w-10 text-text-muted" />
            <p className="font-medium text-text-primary">
              {foldersFiltered ? 'Nenhuma pasta com fotos neste filtro' : 'Nenhuma foto importada'}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              {foldersFiltered
                ? 'Tente outro nome de pessoa, cidade ou arquivo, ou limpe os filtros.'
                : 'Sincronize uma pasta do Drive para ver as fotos organizadas por evento.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface p-4">
            <p className="mb-3 text-xs text-text-muted">
              {folders.length} {folders.length === 1 ? 'pasta' : 'pastas'}
              {foldersFiltered ? ' com correspondências' : ''} · clique para abrir
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {folders.map((folder) => {
                const unclassified = folder.name === UNCLASSIFIED_EVENT_LABEL
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => onOpenFolder(folder)}
                    className="group flex flex-col items-center gap-2 rounded-lg border border-transparent px-3 py-4 text-center transition-colors hover:border-[#C8900A]/30 hover:bg-[#C8900A]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8900A]"
                    title={`Abrir ${folder.name}`}
                  >
                    <FolderIcon unclassified={unclassified} />
                    <div className="min-w-0 w-full">
                      <p className="truncate text-xs font-medium text-text-primary">{folder.name}</p>
                      <p className="text-[11px] text-text-muted">
                        {folder.count} {folder.count === 1 ? 'foto' : 'fotos'}
                        {foldersFiltered ? ' no filtro' : ''}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      ) : (
        children
      )}
    </div>
  )
}
