/** Fotos ainda não tentadas no reconhecimento (sem tag e não marcadas como analyzed). */
export const PENDING_RECOGNITION_OR_FILTER = 'analyzed.is.null,analyzed.eq.false'

export function applyPendingRecognitionFilter<Q extends { is: (col: string, val: null) => Q; or: (filter: string) => Q }>(
  query: Q,
): Q {
  return query.is('person_tag', null).or(PENDING_RECOGNITION_OR_FILTER)
}
