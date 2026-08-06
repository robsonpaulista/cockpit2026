import { cn } from '@/lib/utils'

const chromeBorderClass = 'border-[rgb(var(--color-border-secondary)/0.5)]'

/** Altura mínima da faixa de abas / busca — manter igual na sidebar e no conteúdo. */
export const DASHBOARD_SUBNAV_STRIP_MIN_H_CLASS = 'min-h-[2.6875rem]'

/** Altura fixa da zona de título (logo na sidebar ↔ título+descrição na página). */
export const DASHBOARD_PAGE_HEADER_H_CLASS = 'h-[7rem]'
export const DASHBOARD_PAGE_HEADER_BAND_CLASS = 'h-[7rem] min-h-[7rem] max-h-[7rem]'

/** Base compartilhada — mesma altura rígida na sidebar e no conteúdo (evita esticar por min-height:auto do flex). */
const dashboardHeaderBandBaseClass = cn(
  'box-border shrink-0 min-h-0 overflow-hidden border-b bg-bg-surface',
  chromeBorderClass,
  DASHBOARD_PAGE_HEADER_BAND_CLASS,
  'flex items-center',
)

/** Zona compacta quando o topbar já exibe o título da página. */
export const DASHBOARD_PAGE_HEADER_COMPACT_H_CLASS = 'h-[2.75rem]'

/** Topbar Visível War Room / Dashboard — altura única (`h-16`). */
export const DASHBOARD_TOPBAR_H_CLASS = 'h-16 min-h-16 max-h-16 box-border'

/** Sidebar recolhida: faixa do logo alinhada ao topbar da página. */
export const dashboardSidebarCollapsedTopbarZoneClass = cn(
  'flex shrink-0 items-center justify-center border-b bg-transparent',
  chromeBorderClass,
  DASHBOARD_TOPBAR_H_CLASS,
  'px-1'
)

/**
 * Zona da marca na sidebar expandida: transparente para herdar
 * `rgb(var(--bg-sidebar))` do shell — evita faixa com cor diferente de `--bg-surface`.
 */
export const dashboardPageHeaderZoneSidebarClass = cn(
  'box-border relative flex shrink-0 min-h-0 items-center overflow-hidden border-b bg-transparent',
  chromeBorderClass,
  DASHBOARD_PAGE_HEADER_BAND_CLASS,
  'px-3',
)

/**
 * War Room com sidebar expandida: uma linha (marca + seta),
 * mesma altura da top bar (`h-16`). Herda a cor do shell.
 */
export const dashboardSidebarWarRoomExpandedHeaderClass = cn(
  'relative box-border flex shrink-0 min-h-0 items-center overflow-hidden border-b bg-transparent',
  chromeBorderClass,
  DASHBOARD_TOPBAR_H_CLASS,
  'px-3',
)

/** Sidebar recolhida: faixa vazia alinhada ao título fixo da página (`DashboardPageHeader`). */
export const dashboardSidebarCollapsedPageHeaderSpacerClass = cn(
  'box-border flex shrink-0 min-h-0 items-center justify-center overflow-hidden border-b bg-bg-surface',
  chromeBorderClass,
  DASHBOARD_PAGE_HEADER_BAND_CLASS,
  'px-1'
)

/** Sidebar recolhida: faixa vazia quando o título está no topbar (faixa meta compacta). */
export const dashboardSidebarCollapsedPageHeaderCompactSpacerClass = cn(
  'flex shrink-0 items-center justify-center border-b bg-bg-surface',
  chromeBorderClass,
  DASHBOARD_PAGE_HEADER_COMPACT_H_CLASS,
  'px-1'
)

/** Sidebar recolhida: faixa abaixo do logo — espelha meta ou título da página. */
export function dashboardSidebarCollapsedPageHeaderSpacerClassFor(topbarVisible: boolean): string {
  return topbarVisible
    ? dashboardSidebarCollapsedPageHeaderCompactSpacerClass
    : dashboardSidebarCollapsedPageHeaderSpacerClass
}

/** Sidebar recolhida: faixa vazia alinhada à barra de abas / busca. */
export const dashboardSidebarCollapsedSubnavSpacerClass = cn(
  'box-border shrink-0 border-b bg-bg-app',
  chromeBorderClass,
  DASHBOARD_SUBNAV_STRIP_MIN_H_CLASS,
  'h-[2.6875rem] max-h-[2.6875rem]',
)

/** Zona do título da página (sidebar: logo; conteúdo: título + descrição). */
export const dashboardPageHeaderZoneClass = cn(
  dashboardHeaderBandBaseClass,
  'px-4 md:px-6',
)

/** Faixa meta (período, frescor) quando o título está no topbar. */
export const dashboardPageMetaStripClass = cn(
  'shrink-0 flex items-center overflow-hidden border-b bg-bg-surface',
  chromeBorderClass,
  'px-4 md:px-6',
  DASHBOARD_PAGE_HEADER_COMPACT_H_CLASS
)

/** Faixa cinza contínua: busca (sidebar) ↔ abas (página). */
export const dashboardSubnavStripClass = cn(
  'shrink-0 border-b bg-bg-app',
  chromeBorderClass
)

export const dashboardSubnavStripPageInnerClass = cn(
  'box-border flex flex-col items-stretch justify-between gap-2 py-2',
  'min-h-[2.6875rem]',
  'px-4 md:px-6',
  'lg:h-[2.6875rem] lg:max-h-[2.6875rem] lg:flex-row lg:flex-wrap lg:items-end lg:gap-3 lg:py-0'
)

export const dashboardSubnavStripSidebarClass = cn(
  'shrink-0 border-b bg-bg-app',
  chromeBorderClass
)

export const dashboardSubnavStripSidebarInnerClass = cn(
  'flex items-end',
  DASHBOARD_SUBNAV_STRIP_MIN_H_CLASS,
  'px-3 pb-3'
)
