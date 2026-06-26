/** Filtro PostgREST: event_type IS NULL ou string vazia. */
export const UNCLASSIFIED_EVENT_OR_FILTER = 'event_type.is.null,event_type.eq.""'

export function isUnclassifiedEventType(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === ''
}

export function applyUnclassifiedEventFilter<Q extends { or: (filter: string) => Q }>(
  query: Q,
): Q {
  return query.or(UNCLASSIFIED_EVENT_OR_FILTER)
}
