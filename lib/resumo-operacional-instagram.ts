export {
  fetchInstagramPostsForThemeStats,
  getInstagramEnvCredentials,
} from '@/lib/instagram-graph-server'

export function resolveInstagramClassMap(
  rows: Array<{ identifier: string; theme: string | null }> | null
): Record<string, { theme: string }> {
  const map: Record<string, { theme: string }> = {}
  for (const row of rows ?? []) {
    const theme = String(row.theme ?? '').trim()
    if (theme) map[row.identifier] = { theme }
  }
  return map
}
