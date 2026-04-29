'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardHeader } from '@/components/dashboard-header'
import { DashboardPermissionGuard } from '@/components/dashboard-permission-guard'
import { NavigationLoadingBar } from '@/components/navigation-loading-bar'
import { PageTransition } from '@/components/page-transition'
import { SidebarProvider, useSidebar } from '@/contexts/sidebar-context'
import { NavigationLoadingProvider } from '@/contexts/navigation-loading-context'
import { ThemeProvider, useTheme } from '@/contexts/theme-context'
import { CockpitStatusProvider } from '@/contexts/cockpit-status-context'
import { SplashOverlay } from '@/components/splash-overlay'
import { IdleSplash } from '@/components/idle-splash'
import { cn } from '@/lib/utils'
import { DashboardPesquisadorRedirect } from '@/components/dashboard-pesquisador-redirect'
import './territorio/mapa-tds/mapa-dom-fut-theme.css' // tema base neutra + laranja estratégico v3

const MAPA_TDS_ROUTE_PREFIX = '/dashboard/territorio/mapa-tds'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()
  const pathname = usePathname() ?? ''
  const { theme, appearance } = useTheme()
  const isMapaTdsShell = pathname.startsWith(MAPA_TDS_ROUTE_PREFIX)
  /**
   * Cockpit escuro: a sidebar usa `.sidebar-cockpit-shell` → rgba(17,26,40,0.88) (globals.css).
   * Se a coluna principal usar só `bg-bg-sidebar`, fica uma faixa visível na junção — igualamos ao mesmo tom.
   * Demais temas no Mapa TDs: mesmo token da sidebar / Campo (`bg-bg-sidebar`).
   */
  const columnBgClass = (() => {
    if (!isMapaTdsShell) return 'bg-bg-app'
    if (theme === 'cockpit' && appearance === 'dark') return 'bg-[rgba(17,26,40,0.88)]'
    return 'bg-bg-sidebar'
  })()

  return (
    <CockpitStatusProvider>
      <div className={cn('flex h-screen overflow-hidden', isMapaTdsShell ? columnBgClass : 'bg-bg-app')}>
        <NavigationLoadingBar />
        <Sidebar />
        <div
          className={cn(
            'flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-out',
            columnBgClass,
            collapsed ? 'lg:ml-[5.5rem]' : 'lg:ml-72',
          )}
        >
          <DashboardHeader />
          <main className={cn('flex-1 overflow-y-auto', columnBgClass)}>
            <DashboardPermissionGuard>
              <PageTransition>{children}</PageTransition>
            </DashboardPermissionGuard>
          </main>
        </div>
      </div>
    </CockpitStatusProvider>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SplashOverlay />
      <IdleSplash />
      <ProtectedRoute>
        <DashboardPesquisadorRedirect />
        <ThemeProvider>
          <NavigationLoadingProvider>
            <SidebarProvider>
              <DashboardContent>{children}</DashboardContent>
            </SidebarProvider>
          </NavigationLoadingProvider>
        </ThemeProvider>
      </ProtectedRoute>
    </>
  )
}

