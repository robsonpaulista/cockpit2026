import { pathnameUsesMapaFuturisticShell } from '@/lib/dashboard-mapa-futuristic-chrome'

/** Mapa TDs / Mapa Digital IG (Mobilização) em modo claro: aparência global clara OU `tema=republicanos-claro`. */
export function isMapaTdsShellRepublicanosLight(
  pathname: string | null | undefined,
  temaQuery: string | null | undefined,
  appearance: 'light' | 'dark'
): boolean {
  if (!pathnameUsesMapaFuturisticShell(pathname)) return false
  if (temaQuery === 'republicanos-claro') return true
  return appearance === 'light'
}
