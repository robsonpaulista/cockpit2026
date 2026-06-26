'use client'

import { createPortal } from 'react-dom'
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'
import type { PhotofinderSyncProgress } from '@/lib/photofinder/types'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

interface PhotofinderSyncProgressModalProps {
  open: boolean
  progress: PhotofinderSyncProgress
  onClose: () => void
  formatEta: (seconds: number | null) => string | null
}

export function PhotofinderSyncProgressModal({
  open,
  progress,
  onClose,
  formatEta,
}: PhotofinderSyncProgressModalProps) {
  if (!open || typeof document === 'undefined') return null

  const isActive =
    progress.phase === 'scanning' || progress.phase === 'syncing' || progress.phase === 'recognizing'
  const isRecognizing = progress.phase === 'recognizing'
  const isReidentifying = isRecognizing && progress.recognizeOverwrite
  const isDone = progress.phase === 'completed'
  const isError = progress.phase === 'error'
  const canClose = !isActive

  const barPercent =
    progress.percent ??
    (progress.phase === 'scanning'
      ? 12
      : progress.phase === 'syncing'
        ? 35
        : progress.phase === 'recognizing'
          ? 65
          : isDone
            ? 100
            : 0)

  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-[rgb(var(--color-border-secondary))] bg-bg-surface p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-progress-title"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {isError ? (
              <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-status-danger" />
            ) : isDone ? (
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-status-success" />
            ) : (
              <Loader2 className="mt-0.5 h-6 w-6 shrink-0 animate-spin text-[#C8900A]" />
            )}
            <div>
              <h2 id="sync-progress-title" className="text-base font-semibold text-text-primary">
                {isError
                  ? 'Erro na sincronização'
                  : isDone
                    ? progress.recognizeOverwrite || (progress.recognized > 0 && progress.processed === 0)
                      ? progress.recognizeOverwrite
                        ? 'Reidentificação concluída'
                        : 'Identificação concluída'
                      : 'Sincronização concluída'
                    : isReidentifying
                      ? 'Reidentificando pessoas'
                    : isRecognizing
                      ? 'Identificando pessoas'
                      : 'Sincronizando pasta'}
              </h2>
              {progress.folderName ? (
                <p className="mt-0.5 text-sm text-text-muted">{progress.folderName}</p>
              ) : null}
            </div>
          </div>
          {canClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-muted hover:bg-bg-muted"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        <p className="mb-4 text-sm text-text-primary">{progress.message}</p>

        <div className="mb-2 h-2 overflow-hidden rounded-full bg-bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              isError ? 'bg-status-danger' : isDone ? 'bg-status-success' : 'bg-[#C8900A]',
            )}
            style={{ width: `${Math.max(4, barPercent)}%` }}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
          <span>
            {isRecognizing && progress.recognizeRemaining != null
              ? `${progress.recognizeProcessed ?? 0} analisadas · ${progress.recognized} identificadas${
                  (progress.recognizeErrors ?? 0) > 0 ? ` · ${progress.recognizeErrors} erros` : ''
                } · ${progress.recognizeRemaining} restantes`
              : progress.totalPhotos != null && progress.totalPhotos > 0
                ? `${progress.processed} de ${progress.totalPhotos} fotos`
                : progress.processed > 0
                  ? `${progress.processed} fotos processadas`
                  : isActive
                    ? 'Aguarde…'
                    : '—'}
          </span>
          <span>{formatEta(progress.etaSeconds)}</span>
        </div>

        {(progress.added > 0 || progress.updated > 0 || progress.recognized > 0) && (
          <p className="mb-4 text-xs text-text-muted">
            {progress.added > 0 ? `${progress.added} novas` : null}
            {progress.added > 0 && progress.updated > 0 ? ' · ' : null}
            {progress.updated > 0 ? `${progress.updated} atualizadas` : null}
            {(progress.added > 0 || progress.updated > 0) && progress.recognized > 0 ? ' · ' : null}
            {progress.recognized > 0 ? `${progress.recognized} identificadas` : null}
          </p>
        )}

        {isError && progress.error ? (
          <p className="mb-4 rounded-lg border border-status-danger/30 bg-status-danger/5 px-3 py-2 text-xs text-status-danger">
            {progress.error}
          </p>
        ) : null}

        {canClose ? (
          <button
            type="button"
            onClick={onClose}
            className={cn(sidebarPrimaryCTAButtonClass, 'w-full px-4 py-2.5 text-sm')}
          >
            {isError ? 'Fechar' : 'Ver galeria'}
          </button>
        ) : (
          <p className="text-center text-[11px] text-text-muted">
            {isRecognizing
              ? isReidentifying
                ? 'Reidentificando rostos nas fotos importadas…'
                : 'Identificando rostos nas fotos importadas…'
              : 'Não feche esta janela até a sincronização terminar.'}
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
