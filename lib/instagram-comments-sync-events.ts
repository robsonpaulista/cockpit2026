/** Disparado após sincronização bem-sucedida para outras telas (ex.: mapa TD) recarregarem agregados. */
export const INSTAGRAM_COMMENTS_SYNCED_EVENT = 'copilot:instagram-comments-synced'

export function dispatchInstagramCommentsSynced(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(INSTAGRAM_COMMENTS_SYNCED_EVENT))
}
