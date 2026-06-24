import { cn } from '@/lib/utils'

const chromeBorderClass = 'border-[rgb(var(--color-border-secondary)/0.5)]'

/** Altura mínima da faixa de abas / busca — manter igual na sidebar e no conteúdo. */
export const DASHBOARD_SUBNAV_STRIP_MIN_H_CLASS = 'min-h-[2.6875rem]'

/** Altura fixa da zona de título (logo na sidebar ↔ título+descrição na página). */
export const DASHBOARD_PAGE_HEADER_H_CLASS = 'h-[6rem]'

/** Zona compacta quando o topbar já exibe o título da página. */
export const DASHBOARD_PAGE_HEADER_COMPACT_H_CLASS = 'h-[2.75rem]'

/** Topbar visível com sidebar recolhida — alinha com `DashboardHeader`. */
export const DASHBOARD_TOPBAR_H_CLASS = 'h-16'

/** Sidebar recolhida: faixa do logo alinhada ao topbar da página. */
export const dashboardSidebarCollapsedTopbarZoneClass = cn(
  'flex shrink-0 items-center justify-center border-b bg-bg-surface',
  chromeBorderClass,
  DASHBOARD_TOPBAR_H_CLASS,
  'px-1'
)

/** Sidebar recolhida: faixa vazia alinhada ao título fixo da página (`DashboardPageHeader`). */
export const dashboardSidebarCollapsedPageHeaderSpacerClass = cn(
  'flex shrink-0 items-center justify-center border-b bg-bg-surface',
  chromeBorderClass,
  DASHBOARD_PAGE_HEADER_H_CLASS,
  'px-1'
)

/** Sidebar recolhida: faixa vazia quando o título está no topbar (faixa meta compacta). */
export const dashboardSidebarCollapsedPageHeaderCompactSpacerClass = cn(
  'flex shrink-0 items-center justify-center border-b bg-bg-surface',
  chromeBorderClass,
  DASHBOARD_PAGE_HEADER_COMPACT_H_CLASS,
  'px-1'
)

/** Sidebar recolhida: faixa vazia alinhada à barra de abas / busca. */
export const dashboardSidebarCollapsedSubnavSpacerClass = cn(
  'shrink-0 border-b bg-bg-app',
  chromeBorderClass,
  DASHBOARD_SUBNAV_STRIP_MIN_H_CLASS
)

/** Zona do título da página (sidebar: logo; conteúdo: título + descrição). */
export const dashboardPageHeaderZoneClass = cn(
  'shrink-0 flex flex-col justify-center overflow-hidden border-b bg-bg-surface',
  chromeBorderClass,
  'px-4 py-4 md:px-6',
  DASHBOARD_PAGE_HEADER_H_CLASS
)

/** Faixa meta (período, frescor) quando o título está no topbar. */
export const dashboardPageMetaStripClass = cn(
  'shrink-0 flex items-center overflow-hidden border-b bg-bg-surface',
  chromeBorderClass,
  'px-4 md:px-6',
  DASHBOARD_PAGE_HEADER_COMPACT_H_CLASS
)

export const dashboardPageHeaderZoneSidebarClass = cn(
  'shrink-0 flex flex-col justify-center overflow-hidden border-b bg-bg-surface',
  chromeBorderClass,
  'px-3 py-4',
  DASHBOARD_PAGE_HEADER_H_CLASS
)

/** Faixa cinza contínua: busca (sidebar) ↔ abas (página). */
export const dashboardSubnavStripClass = cn(
  'shrink-0 border-b bg-bg-app',
  chromeBorderClass
)

export const dashboardSubnavStripPageInnerClass = cn(
  'flex flex-wrap items-end justify-between gap-3',
  DASHBOARD_SUBNAV_STRIP_MIN_H_CLASS,
  'px-4 md:px-6'
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
