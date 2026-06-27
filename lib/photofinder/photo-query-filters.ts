import type { PhotofinderPhotoFilters } from '@/lib/photofinder/types'

export type PhotofinderBrowseFilters = Pick<
  PhotofinderPhotoFilters,
  'search' | 'person' | 'city' | 'withoutPerson' | 'joy' | 'dateFrom' | 'dateTo' | 'minFaces' | 'maxFaces'
>

export function hasActiveBrowseFilters(filters: PhotofinderBrowseFilters): boolean {
  return Boolean(
    filters.search?.trim() ||
      filters.person?.trim() ||
      filters.city?.trim() ||
      filters.withoutPerson ||
      filters.joy ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.minFaces != null ||
      filters.maxFaces != null,
  )
}

export function applyPhotofinderPhotoListFilters<Q extends {
  ilike: (col: string, pattern: string) => Q
  is: (col: string, val: null) => Q
  eq: (col: string, val: string) => Q
  or: (filter: string) => Q
  gte: (col: string, val: string | number) => Q
  lte: (col: string, val: string | number) => Q
}>(
  query: Q,
  filters: PhotofinderBrowseFilters,
): Q {
  let next = query

  if (filters.search?.trim()) {
    next = next.ilike('name', `%${filters.search.trim()}%`)
  }
  if (filters.withoutPerson) {
    next = next.is('person_tag', null)
  } else if (filters.person?.trim()) {
    next = next.ilike('person_tag', `%${filters.person.trim()}%`)
  }
  if (filters.joy) {
    next = next.eq('joy_likelihood', filters.joy)
  }
  if (filters.city?.trim()) {
    const city = filters.city.trim()
    next = next.or(`event_city.ilike.*${city}*,location_name.ilike.*${city}*`)
  }
  if (filters.dateFrom) {
    next = next.gte('created_at', `${filters.dateFrom}T00:00:00`)
  }
  if (filters.dateTo) {
    next = next.lte('created_at', `${filters.dateTo}T23:59:59`)
  }
  if (filters.minFaces != null) {
    next = next.gte('faces_detected', filters.minFaces)
  }
  if (filters.maxFaces != null) {
    next = next.lte('faces_detected', filters.maxFaces)
  }

  return next
}

export function parseBrowseFiltersFromSearchParams(
  searchParams: URLSearchParams,
): PhotofinderBrowseFilters {
  const minFaces = searchParams.get('minFaces')
  const maxFaces = searchParams.get('maxFaces')

  return {
    search: searchParams.get('search') ?? undefined,
    person: searchParams.get('person') ?? undefined,
    city: searchParams.get('city') ?? undefined,
    withoutPerson: searchParams.get('withoutPerson') === 'true' || undefined,
    joy: (searchParams.get('joy') as PhotofinderBrowseFilters['joy']) ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    minFaces: minFaces ? parseInt(minFaces, 10) : undefined,
    maxFaces: maxFaces ? parseInt(maxFaces, 10) : undefined,
  }
}
