/** Larguras da sidebar — manter alinhado entre `components/sidebar.tsx` e `app/dashboard/layout.tsx`. */

export const SIDEBAR_WIDTH_EXPANDED_CLASS = 'w-56'
export const SIDEBAR_WIDTH_COLLAPSED_CLASS = 'lg:w-14'

export const SIDEBAR_MAIN_OFFSET_EXPANDED_CLASS = 'lg:ml-56'
export const SIDEBAR_MAIN_OFFSET_COLLAPSED_CLASS = 'lg:ml-14'

export function isSidebarIconOnly(collapsed: boolean, mobileOpen: boolean): boolean {
  return collapsed && !mobileOpen
}

export function sidebarShellNavClass(collapsed: boolean, mobileOpen: boolean): string {
  return isSidebarIconOnly(collapsed, mobileOpen) ? 'px-1 py-3' : 'px-2 py-4'
}

export function sidebarShellFooterClass(collapsed: boolean, mobileOpen: boolean): string {
  return isSidebarIconOnly(collapsed, mobileOpen) ? 'px-1 py-2' : 'px-2 py-3'
}

export function sidebarShellHeaderClass(collapsed: boolean, mobileOpen: boolean): string {
  return isSidebarIconOnly(collapsed, mobileOpen)
    ? 'flex h-14 items-center justify-center px-1'
    : 'flex h-14 items-center justify-between px-3'
}

/** Centraliza ícones e remove padding horizontal extra no modo recolhido. */
export function sidebarItemIconOnlyClass(collapsed: boolean, mobileOpen: boolean): string {
  return isSidebarIconOnly(collapsed, mobileOpen) ? 'justify-center gap-0 px-1.5 py-2' : ''
}
