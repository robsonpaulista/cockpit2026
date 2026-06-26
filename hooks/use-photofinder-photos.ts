'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { photofinderApi } from '@/lib/photofinder-api'
import type { PhotofinderPhoto, PhotofinderPhotoFilters } from '@/lib/photofinder/types'

export function usePhotofinderPhotos(initialFilters: PhotofinderPhotoFilters = {}, enabled = true) {
  const [photos, setPhotos] = useState<PhotofinderPhoto[]>([])
  const [filters, setFilters] = useState<PhotofinderPhotoFilters>(initialFilters)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState<number>(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const pageRef = useRef(1)

  const fetchPhotos = useCallback(
    async (targetPage?: number) => {
      if (!enabled) {
        setLoading(false)
        return
      }

      const pageToFetch = targetPage ?? pageRef.current

      try {
        setLoading(true)
        setError(null)
        const response = await photofinderApi.getPhotos({ ...filters, page: pageToFetch })
        setPhotos(response.photos)
        setPagination(response.pagination)
        setPage(response.pagination.page)
        pageRef.current = response.pagination.page
        return response
      } catch (err) {
        console.error('Erro ao carregar fotos:', err)
        setError(err instanceof Error ? err.message : 'Falha ao carregar fotos')
        setPhotos([])
        return null
      } finally {
        setLoading(false)
      }
    },
    [filters, enabled],
  )

  useEffect(() => {
    if (enabled) void fetchPhotos()
  }, [fetchPhotos, enabled])

  const refresh = useCallback(async () => {
    pageRef.current = 1
    setPage(1)
    return fetchPhotos(1)
  }, [fetchPhotos])

  const updateFilters = useCallback((newFilters: Partial<PhotofinderPhotoFilters>) => {
    setFilters((prev) => {
      const next: PhotofinderPhotoFilters = { ...prev, ...newFilters }
      if ('eventType' in newFilters && newFilters.eventType === undefined) {
        delete next.eventType
      }
      if ('withoutEvent' in newFilters && newFilters.withoutEvent === undefined) {
        delete next.withoutEvent
      }
      return next
    })
    pageRef.current = 1
    setPage(1)
  }, [])

  const goToPage = useCallback(
    (nextPage: number) => {
      if (nextPage < 1 || nextPage > pagination.totalPages) return
      pageRef.current = nextPage
      setPage(nextPage)
      void fetchPhotos(nextPage)
    },
    [fetchPhotos, pagination.totalPages],
  )

  return {
    photos,
    filters,
    loading,
    error,
    pagination: { ...pagination, page },
    updateFilters,
    goToPage,
    refresh,
  }
}
