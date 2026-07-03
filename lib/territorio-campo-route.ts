export const TERRITORIO_CAMPO_TAB_PANORAMA = 'panorama' as const
export const TERRITORIO_CAMPO_TAB_BASE = 'base' as const
export const TERRITORIO_CAMPO_TAB_MAPA_OBRAS = 'mapa-obras' as const
export const TERRITORIO_CAMPO_TAB_VISITAS = 'visitas' as const

export type TerritorioCampoTab =
  | typeof TERRITORIO_CAMPO_TAB_PANORAMA
  | typeof TERRITORIO_CAMPO_TAB_BASE
  | typeof TERRITORIO_CAMPO_TAB_MAPA_OBRAS
  | typeof TERRITORIO_CAMPO_TAB_VISITAS

export const TERRITORIO_CAMPO_HREF = '/dashboard/territorio'

/** Título do hub no header / topbar. */
export const TERRITORIO_CAMPO_PAGE_TITLE = 'Base Eleitoral'

export function territorioCampoPageTitle(tab: string | null): string {
  if (tab === TERRITORIO_CAMPO_TAB_VISITAS) return `${TERRITORIO_CAMPO_PAGE_TITLE} · Visitas`
  if (tab === TERRITORIO_CAMPO_TAB_MAPA_OBRAS) return `${TERRITORIO_CAMPO_PAGE_TITLE} · Mapa de Obras`
  return TERRITORIO_CAMPO_PAGE_TITLE
}

export function parseTerritorioCampoTab(value: string | null | undefined): TerritorioCampoTab {
  if (value === TERRITORIO_CAMPO_TAB_BASE) return TERRITORIO_CAMPO_TAB_BASE
  if (value === TERRITORIO_CAMPO_TAB_MAPA_OBRAS) return TERRITORIO_CAMPO_TAB_MAPA_OBRAS
  if (value === TERRITORIO_CAMPO_TAB_VISITAS) return TERRITORIO_CAMPO_TAB_VISITAS
  return TERRITORIO_CAMPO_TAB_PANORAMA
}

export function territorioCampoHref(
  tab: TerritorioCampoTab = TERRITORIO_CAMPO_TAB_PANORAMA
): string {
  if (tab === TERRITORIO_CAMPO_TAB_PANORAMA) {
    return TERRITORIO_CAMPO_HREF
  }
  return `${TERRITORIO_CAMPO_HREF}?tab=${tab}`
}
