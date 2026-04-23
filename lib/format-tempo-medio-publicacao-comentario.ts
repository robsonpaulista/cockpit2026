/** Exibe tempo médio entre publicação da mídia e o comentário (`commented_at` − `media_posted_at`). */
export function formatTempoMedioPublicacaoComentario(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return '—'
  const sec = Math.round(ms / 1000)
  if (sec < 90) return `${sec} s`
  const minTotal = Math.floor(sec / 60)
  if (minTotal < 120) return `${minTotal} min`
  const h = Math.floor(minTotal / 60)
  const m = minTotal % 60
  if (h < 72) {
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }
  const d = Math.floor(h / 24)
  const hr = h % 24
  return hr > 0 ? `${d}d ${hr}h` : `${d}d`
}
