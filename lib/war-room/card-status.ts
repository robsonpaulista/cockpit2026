/** Estados operacionais dos cards da War Room. */
export type WarRoomCardStatus =
  | 'ok'
  | 'atencao'
  | 'critico'
  | 'sem_dados'
  | 'atualizando'

export const WAR_ROOM_CARD_STATUS_LABEL: Record<WarRoomCardStatus, string> = {
  ok: 'OK',
  atencao: 'ATENÇÃO',
  critico: 'CRÍTICO',
  sem_dados: 'SEM DADOS',
  atualizando: 'ATUALIZANDO',
}

export function resolveCrmCardStatus(pendentes: number): WarRoomCardStatus {
  if (pendentes >= 300) return 'critico'
  if (pendentes >= 100) return 'atencao'
  return 'ok'
}

export function resolveMobilizacaoCardStatus(
  confirmados: number,
  meta: number,
): WarRoomCardStatus {
  if (meta <= 0) return 'sem_dados'
  const pct = confirmados / meta
  if (pct < 0.6) return 'critico'
  if (pct < 0.85) return 'atencao'
  return 'ok'
}

export function resolveAgendaCardStatus(count: number, loading: boolean): WarRoomCardStatus {
  if (loading) return 'atualizando'
  if (count === 0) return 'sem_dados'
  return 'ok'
}

export function resolveRedesCardStatus(
  configured: boolean,
  loading: boolean,
  postsCount: number,
): WarRoomCardStatus {
  if (loading) return 'atualizando'
  if (!configured) return 'sem_dados'
  if (postsCount === 0) return 'atencao'
  return 'ok'
}

export function resolveGenericLoadingStatus(
  loading: boolean,
  empty: boolean,
): WarRoomCardStatus {
  if (loading) return 'atualizando'
  if (empty) return 'sem_dados'
  return 'ok'
}
