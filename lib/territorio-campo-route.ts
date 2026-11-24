export const TERRITORIO_CAMPO_TAB_BASE = 'base' as const
export const TERRITORIO_CAMPO_TAB_LIDERANCAS = 'liderancas' as const
export const TERRITORIO_CAMPO_TAB_DEMANDAS = 'demandas' as const
export const TERRITORIO_CAMPO_TAB_VISITAS = 'visitas' as const

/** Legado: Mapa de Obras saiu da Base Eleitoral (fica só no War Room · Copiloto). */
export const TERRITORIO_CAMPO_TAB_MAPA_OBRAS_LEGACY = 'mapa-obras' as const

export type TerritorioCampoTab =
  | typeof TERRITORIO_CAMPO_TAB_BASE
  | typeof TERRITORIO_CAMPO_TAB_LIDERANCAS
  | typeof TERRITORIO_CAMPO_TAB_DEMANDAS
  | typeof TERRITORIO_CAMPO_TAB_VISITAS

export const TERRITORIO_CAMPO_HREF = '/dashboard/territorio'

/** Título do hub no header / topbar. */
export const TERRITORIO_CAMPO_PAGE_TITLE = 'Base Eleitoral'

export function territorioCampoPageTitle(tab: string | null): string {
  if (tab === TERRITORIO_CAMPO_TAB_LIDERANCAS) return `${TERRITORIO_CAMPO_PAGE_TITLE} · Lideranças`
  if (tab === TERRITORIO_CAMPO_TAB_VISITAS) return `${TERRITORIO_CAMPO_PAGE_TITLE} · Visitas`
  if (tab === TERRITORIO_CAMPO_TAB_DEMANDAS) return `${TERRITORIO_CAMPO_PAGE_TITLE} · Demandas`
  return TERRITORIO_CAMPO_PAGE_TITLE
}

/** Valores desconhecidos (inclui o antigo `panorama`) caem na Base. */
export function parseTerritorioCampoTab(value: string | null | undefined): TerritorioCampoTab {
  if (value === TERRITORIO_CAMPO_TAB_LIDERANCAS) return TERRITORIO_CAMPO_TAB_LIDERANCAS
  if (value === TERRITORIO_CAMPO_TAB_DEMANDAS) return TERRITORIO_CAMPO_TAB_DEMANDAS
  if (value === TERRITORIO_CAMPO_TAB_VISITAS) return TERRITORIO_CAMPO_TAB_VISITAS
  return TERRITORIO_CAMPO_TAB_BASE
}

export function territorioCampoHref(tab: TerritorioCampoTab = TERRITORIO_CAMPO_TAB_BASE): string {
  if (tab === TERRITORIO_CAMPO_TAB_BASE) {
    return TERRITORIO_CAMPO_HREF
  }
  return `${TERRITORIO_CAMPO_HREF}?tab=${tab}`
}

/** Sub-abas internas de Visitas (Agenda de campo × Cobertura 2026). */
export const TERRITORIO_VISITAS_SUB_AGENDA = 'agenda' as const
export const TERRITORIO_VISITAS_SUB_COBERTURA_2026 = 'cobertura-2026' as const

export type TerritorioVisitasSubTab =
  | typeof TERRITORIO_VISITAS_SUB_AGENDA
  | typeof TERRITORIO_VISITAS_SUB_COBERTURA_2026

export function parseTerritorioVisitasSubTab(
  value: string | null | undefined,
): TerritorioVisitasSubTab {
  if (value === TERRITORIO_VISITAS_SUB_COBERTURA_2026) return TERRITORIO_VISITAS_SUB_COBERTURA_2026
  return TERRITORIO_VISITAS_SUB_AGENDA
}

/** Mantém `tab=visitas` e grava/limpa `visitas=` (agenda = default, omitido). */
export function territorioVisitasHref(sub: TerritorioVisitasSubTab = TERRITORIO_VISITAS_SUB_AGENDA): string {
  if (sub === TERRITORIO_VISITAS_SUB_AGENDA) {
    return territorioCampoHref(TERRITORIO_CAMPO_TAB_VISITAS)
  }
  return `${TERRITORIO_CAMPO_HREF}?tab=${TERRITORIO_CAMPO_TAB_VISITAS}&visitas=${sub}`
}

/** Sub-abas internas de Lideranças (Cadastro × Dep. estadual 2026). */
export const TERRITORIO_LIDERANCAS_SUB_CADASTRO = 'cadastro' as const
export const TERRITORIO_LIDERANCAS_SUB_DEP_ESTADUAL_2026 = 'dep-estadual-2026' as const

export type TerritorioLiderancasSubTab =
  | typeof TERRITORIO_LIDERANCAS_SUB_CADASTRO
  | typeof TERRITORIO_LIDERANCAS_SUB_DEP_ESTADUAL_2026

export function parseTerritorioLiderancasSubTab(
  value: string | null | undefined,
): TerritorioLiderancasSubTab {
  if (value === TERRITORIO_LIDERANCAS_SUB_DEP_ESTADUAL_2026) {
    return TERRITORIO_LIDERANCAS_SUB_DEP_ESTADUAL_2026
  }
  return TERRITORIO_LIDERANCAS_SUB_CADASTRO
}

/** Mantém `tab=liderancas` e grava/limpa `liderancas=` (cadastro = default, omitido). */
export function territorioLiderancasHref(
  sub: TerritorioLiderancasSubTab = TERRITORIO_LIDERANCAS_SUB_CADASTRO,
): string {
  if (sub === TERRITORIO_LIDERANCAS_SUB_CADASTRO) {
    return territorioCampoHref(TERRITORIO_CAMPO_TAB_LIDERANCAS)
  }
  return `${TERRITORIO_CAMPO_HREF}?tab=${TERRITORIO_CAMPO_TAB_LIDERANCAS}&liderancas=${sub}`
}
