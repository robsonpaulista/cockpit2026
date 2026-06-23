export const TERRITORIO_CAMPO_TAB_PANORAMA = 'panorama' as const
export const TERRITORIO_CAMPO_TAB_BASE = 'base' as const
export const TERRITORIO_CAMPO_TAB_VISITAS = 'visitas' as const

export type TerritorioCampoTab =
  | typeof TERRITORIO_CAMPO_TAB_PANORAMA
  | typeof TERRITORIO_CAMPO_TAB_BASE
  | typeof TERRITORIO_CAMPO_TAB_VISITAS

export const TERRITORIO_CAMPO_HREF = '/dashboard/territorio'

export function territorioCampoHref(
  tab: TerritorioCampoTab = TERRITORIO_CAMPO_TAB_PANORAMA
): string {
  if (tab === TERRITORIO_CAMPO_TAB_PANORAMA) {
    return TERRITORIO_CAMPO_HREF
  }
  return `${TERRITORIO_CAMPO_HREF}?tab=${tab}`
}
