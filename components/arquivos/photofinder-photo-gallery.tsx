'use client'

import { Loader2 } from 'lucide-react'
import type { PhotofinderPhoto } from '@/lib/photofinder/types'
import { PhotofinderPhotoCard } from '@/components/arquivos/photofinder-photo-card'

interface PhotoGalleryProps {
  photos: PhotofinderPhoto[]
  loading?: boolean
  photosCountHint?: number
  selectionMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
}

export function PhotofinderPhotoGallery({
  photos,
  loading,
  photosCountHint,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}: PhotoGalleryProps) {
  if (loading && photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-text-muted">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-[#C8900A]" />
        <p className="text-sm">Carregando fotos…</p>
      </div>
    )
  }

  if (!photos.length) {
    return (
      <div className="rounded-xl border border-dashed border-[rgb(var(--color-border-secondary))] px-6 py-16 text-center">
        <p className="text-base font-medium text-text-primary">Nenhuma foto encontrada</p>
        <p className="mt-1 text-sm text-text-muted">
          {photosCountHint != null && photosCountHint > 0
            ? 'Há fotos vinculadas à sua conta no banco, mas os filtros atuais não retornaram resultados. Limpe os filtros ou sincronize uma pasta novamente.'
            : 'Conecte o Google Drive e sincronize uma pasta para importar suas fotos.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {photos.map((photo) => (
        <div key={`${photo.id}-${photo.person_tag ?? ''}-${photo.updated_at ?? ''}`} className="group">
          <PhotofinderPhotoCard
            photo={photo}
            selectionMode={selectionMode}
            selected={selectedIds?.has(photo.id) ?? false}
            onToggleSelect={onToggleSelect}
          />
        </div>
      ))}
    </div>
  )
}
