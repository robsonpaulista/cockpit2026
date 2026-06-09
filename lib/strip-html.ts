/**
 * Remove tags HTML de strings vindas de RSS (título, fonte, descrição).
 * Nunca usar innerHTML / dangerouslySetInnerHTML com conteúdo de feed.
 */
export function stripHtml(str: string | null | undefined): string {
  if (!str) return ''

  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    return new DOMParser().parseFromString(str, 'text/html').body.textContent?.trim() ?? ''
  }

  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .trim()
}
