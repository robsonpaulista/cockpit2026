/** Comentários podem existir em mais de um `user_id` se pessoas diferentes sincronizaram a mesma página — contamos uma vez. */
export function dedupeRowsByInstagramCommentId<T extends { instagram_comment_id: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const r of rows) {
    const id = r.instagram_comment_id
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(r)
  }
  return out
}
