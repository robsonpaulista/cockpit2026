const MAPA_TDS_ROUTE = '/dashboard/territorio/mapa-tds'

/** Mapa TDs em modo claro: aparência global clara OU link com `tema=republicanos-claro`. */
export function isMapaTdsShellRepublicanosLight(
  pathname: string | null | undefined,
  temaQuery: string | null | undefined,
  appearance: 'light' | 'dark'
): boolean {
  if (!pathname?.startsWith(MAPA_TDS_ROUTE)) return false
  if (temaQuery === 'republicanos-claro') return true
  return appearance === 'light'
}
