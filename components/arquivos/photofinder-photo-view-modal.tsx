'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PhotofinderPersonTags } from '@/components/arquivos/photofinder-person-tags'
import { Download, MapPin, User, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { photofinderApi } from '@/lib/photofinder-api'
import type { PhotofinderPhoto } from '@/lib/photofinder/types'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

interface PhotofinderPhotoViewModalProps {
  photo: PhotofinderPhoto | null
  open: boolean
  onClose: () => void
}

export function PhotofinderPhotoViewModal({ photo, open, onClose }: PhotofinderPhotoViewModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open || !photo || typeof document === 'undefined') return null

  const imageUrl = photofinderApi.getPhotoImageUrl(photo.id)
  const downloadUrl = photofinderApi.getPhotoDownloadUrl(photo.id)
  const location = photo.location_name || photo.event_city

  return createPortal(
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[rgb(var(--color-border-secondary)/0.5)] bg-bg-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-view-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[rgb(var(--color-border-secondary)/0.85)] px-4 py-3">
          <div className="min-w-0">
            <h2 id="photo-view-title" className="truncate text-sm font-semibold text-text-primary">
              {photo.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              {photo.created_at ? (
                <span>{format(new Date(photo.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
              ) : null}
              {location ? (
                <span className="inline-flex items-center gap-1 text-[#C8900A]">
                  <MapPin className="h-3.5 w-3.5" />
                  {location}
                </span>
              ) : null}
              {photo.person_tag || photo.faces_detected > 1 ? (
                <span className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1">
                  {photo.person_tag ? (
                    <span className="inline-flex max-w-full items-start gap-1">
                      <User className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <PhotofinderPersonTags value={photo.person_tag} layout="stack" />
                    </span>
                  ) : null}
                  {photo.faces_detected > 1 ? (
                    <span className="text-text-muted">{photo.faces_detected} rostos detectados</span>
                  ) : null}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={downloadUrl}
              download={photo.name || 'foto.jpg'}
              className={cn(
                sidebarPrimaryCTAButtonClass,
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs',
              )}
            >
              <Download className="h-3.5 w-3.5" />
              Baixar
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-muted hover:bg-bg-muted"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-4">
          <img
            src={imageUrl}
            alt={photo.name}
            className="max-h-[calc(92vh-8rem)] max-w-full object-contain"
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
