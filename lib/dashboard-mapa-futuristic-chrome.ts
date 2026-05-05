import { cn } from '@/lib/utils'

export const MAPA_TDS_ROUTE_PREFIX = '/dashboard/territorio/mapa-tds'
export const MOBILIZACAO_MAPA_DIGITAL_IG_ROUTE = '/dashboard/mobilizacao/mapa-digital-ig'

export function pathnameUsesMapaFuturisticShell(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return (
    pathname.startsWith(MAPA_TDS_ROUTE_PREFIX) || pathname.startsWith(MOBILIZACAO_MAPA_DIGITAL_IG_ROUTE)
  )
}

export type MapaFuturisticChrome = {
  visualTheme: 'light' | 'dark'
  mapaShellBgClass: string
  isRepublicanosLight: boolean
  mapaShellBrancoForcado: boolean
  headerDividerClass: string
  tabRailClass: string
  igToolsRailClass: string
  isChromeIgAligned: boolean
}

/** Bordas e fundos alinhados ao painel “futurista” (mapa TDs e Mapa Digital IG em Mobilização). */
export function getMapaFuturisticChrome(args: {
  pathname: string | null
  theme: string
  appearance: 'light' | 'dark'
  temaQuery: string | null
}): MapaFuturisticChrome {
  const { pathname, theme, appearance, temaQuery } = args
  const onShell = pathnameUsesMapaFuturisticShell(pathname)
  const isRepublicanosLight =
    onShell && ((theme === 'republicanos' && appearance === 'light') || temaQuery === 'republicanos-claro')
  const visualTheme: 'light' | 'dark' =
    appearance === 'light' || temaQuery === 'republicanos-claro' ? 'light' : 'dark'
  const mapaShellBrancoForcado = appearance === 'dark' && temaQuery === 'republicanos-claro'
  const isCockpit = false
  const mapaShellBgClass =
    mapaShellBrancoForcado || isRepublicanosLight
      ? 'bg-white'
      : isCockpit && appearance === 'dark'
        ? 'bg-[rgba(17,26,40,0.88)]'
        : 'bg-bg-surface'

  const isChromeIgAligned =
    isCockpit && appearance === 'dark' && !mapaShellBrancoForcado && !isRepublicanosLight

  const headerDividerClass = isChromeIgAligned ? 'border-white/[0.09]' : 'border-border-card/80'

  const tabRailClass = cn(
    'flex min-w-0 shrink-0 flex-wrap gap-1 rounded-xl border p-1',
    isChromeIgAligned
      ? 'border-white/[0.09] bg-[rgba(255,255,255,0.04)]'
      : mapaShellBrancoForcado || isRepublicanosLight
        ? 'border-border-card/70 bg-white/75 shadow-none'
        : 'border-border-card bg-bg-surface shadow-sm'
  )

  const igToolsRailClass = cn(
    'flex w-full min-w-0 flex-col items-stretch gap-2 rounded-xl border p-1.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end',
    isChromeIgAligned
      ? 'border-white/[0.09] bg-[rgba(255,255,255,0.04)]'
      : mapaShellBrancoForcado || isRepublicanosLight
        ? 'border-border-card/70 bg-white/75'
        : 'border-border-card bg-bg-surface/90'
  )

  return {
    visualTheme,
    mapaShellBgClass,
    isRepublicanosLight,
    mapaShellBrancoForcado,
    headerDividerClass,
    tabRailClass,
    igToolsRailClass,
    isChromeIgAligned,
  }
}
