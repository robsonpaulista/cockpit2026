/** Intervalo da atualização silenciosa de confirmados (chegadas) na agenda da War Room. */
export const WAR_ROOM_ARRIVALS_SILENT_REFRESH_MS = 5 * 60_000

export function proximaAtualizacaoConfirmadosAgenda(
  baseMs: number = Date.now(),
): number {
  return baseMs + WAR_ROOM_ARRIVALS_SILENT_REFRESH_MS
}

export function formatCountdownConfirmadosAgenda(msRestantes: number): string {
  const totalSec = Math.max(0, Math.ceil(msRestantes / 1000))
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
