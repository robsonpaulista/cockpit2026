/** Formatação compacta pt-BR para KPIs da War Room. */
export function formatWarRoomNumber(value: number): string {
  const n = Number.isFinite(value) ? value : 0
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    })}M`
  }
  if (Math.abs(n) >= 10_000) {
    return `${(n / 1_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    })}K`
  }
  return n.toLocaleString('pt-BR')
}

export function formatWarRoomPct(value: number): string {
  return `${Math.round(value)}%`
}
