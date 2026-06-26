'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Check, Download, Loader2, MapPin, User } from 'lucide-react'
import { PhotofinderPersonTags } from '@/components/arquivos/photofinder-person-tags'
import { PhotofinderPhotoViewModal } from '@/components/arquivos/photofinder-photo-view-modal'
import { hasMultiplePersonTags } from '@/lib/photofinder/person-tags'
import { photofinderApi } from '@/lib/photofinder-api'
import type { PhotofinderPhoto } from '@/lib/photofinder/types'
import { cn } from '@/lib/utils'

interface PhotoCardProps {
  photo: PhotofinderPhoto
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
}

export function PhotofinderPhotoCard({
  photo,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: PhotoCardProps) {
  const imageUrl = photofinderApi.getPhotoImageUrl(photo.id)
  const downloadUrl = photofinderApi.getPhotoDownloadUrl(photo.id)
  const [imgSrc, setImgSrc] = useState(photo.thumbnail_url || imageUrl)
  const [imgError, setImgError] = useState(false)
  const [personName, setPersonName] = useState(photo.person_tag ?? '')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    setPersonName(photo.person_tag ?? '')
  }, [photo.id, photo.person_tag])

  const handleImageError = () => {
    if (photo.thumbnail_url && imgSrc !== photo.thumbnail_url) {
      setImgSrc(photo.thumbnail_url)
      return
    }
    if (imgSrc !== imageUrl) {
      setImgSrc(imageUrl)
      return
    }
    setImgError(true)
  }

  const handleSavePerson = async () => {
    try {
      setSaving(true)
      await photofinderApi.updatePhoto(photo.id, { person_tag: personName || null })
      setIsEditing(false)
    } catch (error) {
      console.error('Erro ao salvar pessoa:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      if (downloading) return
      setDownloading(true)
      try {
        const res = await fetch(downloadUrl, { credentials: 'include' })
        if (!res.ok) throw new Error('Falha ao baixar')
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = objectUrl
        anchor.download = photo.name || 'foto.jpg'
        anchor.click()
        URL.revokeObjectURL(objectUrl)
      } catch (error) {
        console.error('Erro ao baixar foto:', error)
      } finally {
        setDownloading(false)
      }
    },
    [downloadUrl, downloading, photo.name],
  )

  const handleImageClick = () => {
    if (selectionMode) {
      onToggleSelect?.(photo.id)
      return
    }
    setViewOpen(true)
  }

  const location = photo.location_name || photo.event_city

  return (
    <>
      <article
        className={cn(
          'rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface transition-colors hover:border-[rgb(var(--color-border-secondary)/0.9)]',
          'group !overflow-visible p-0',
          selectionMode && selected && 'ring-2 ring-[#C8900A] ring-offset-2',
        )}
      >
        <div className="relative aspect-square overflow-hidden bg-bg-muted">
          {!imgError ? (
            <button
              type="button"
              onClick={handleImageClick}
              className={cn(
                'block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C8900A] focus-visible:ring-offset-2',
                selectionMode ? 'cursor-pointer' : 'cursor-zoom-in',
              )}
              aria-label={
                selectionMode
                  ? selected
                    ? `Desmarcar ${photo.name}`
                    : `Selecionar ${photo.name}`
                  : `Ver ${photo.name} em tamanho maior`
              }
            >
              <img
                src={imgSrc}
                alt={photo.name}
                loading="lazy"
                onError={handleImageError}
                className={cn('h-full w-full object-cover', selectionMode && selected && 'opacity-90')}
              />
            </button>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-text-muted">
              <span className="text-xs uppercase">{photo.mime_type?.split('/')[1]}</span>
            </div>
          )}

          {selectionMode ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onToggleSelect?.(photo.id)
              }}
              className={cn(
                'absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border-2 shadow-sm transition-colors',
                selected
                  ? 'border-[#C8900A] bg-[#C8900A] text-white'
                  : 'border-white/90 bg-black/40 text-white hover:bg-black/60',
              )}
              aria-pressed={selected}
              aria-label={selected ? 'Desmarcar foto' : 'Selecionar foto'}
            >
              {selected ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          ) : null}

          {!imgError && !selectionMode ? (
            <button
              type="button"
              onClick={(e) => void handleDownload(e)}
              disabled={downloading}
              className="absolute right-2 top-2 rounded-lg bg-black/60 p-2 text-white opacity-0 transition-opacity hover:bg-black/80 group-hover:opacity-100 focus:opacity-100 disabled:opacity-70"
              title="Baixar foto"
              aria-label="Baixar foto"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
          ) : null}

          {photo.person_tag ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent px-2 pb-2 pt-6">
              <PhotofinderPersonTags
                value={photo.person_tag}
                layout="stack"
                variant="on-image"
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-2 p-3">
          <p className="truncate text-sm font-medium text-text-primary" title={photo.name}>
            {photo.name}
          </p>

          {photo.created_at ? (
            <p className="text-xs text-text-muted">
              {format(new Date(photo.created_at), 'dd/MM/yyyy', { locale: ptBR })}
            </p>
          ) : null}

          {location ? (
            <p className="flex items-center gap-1 text-xs text-[#C8900A]">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{location}</span>
            </p>
          ) : null}

          {photo.event_type ? (
            <span className="inline-block rounded-md bg-[#C8900A]/10 px-2 py-0.5 text-[11px] font-medium text-[#C8900A]">
              {photo.event_type}
            </span>
          ) : null}

          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex w-full items-start gap-1.5 rounded-lg px-1 py-1 text-left text-xs text-text-muted hover:bg-bg-muted"
            >
              <User className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="w-full min-w-0">
                <PhotofinderPersonTags
                  value={photo.person_tag}
                  layout={hasMultiplePersonTags(photo.person_tag) ? 'stack' : 'inline'}
                  emptyLabel="Adicionar pessoa…"
                />
              </div>
            </button>
          ) : (
            <div className="flex gap-1">
              <input
                type="text"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Nome(s), separados por ·"
                className="min-w-0 flex-1 rounded-lg border border-[rgb(var(--color-border-secondary))] px-2 py-1 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSavePerson()
                  if (e.key === 'Escape') setIsEditing(false)
                }}
              />
              <button
                type="button"
                onClick={() => void handleSavePerson()}
                disabled={saving}
                className="rounded-lg bg-[#C8900A] px-2 py-1 text-xs text-white"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'OK'}
              </button>
            </div>
          )}
        </div>
      </article>

      <PhotofinderPhotoViewModal
        photo={photo}
        open={viewOpen}
        onClose={() => setViewOpen(false)}
      />
    </>
  )
}
