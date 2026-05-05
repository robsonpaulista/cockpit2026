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
import { ThemeProvider } from '@/contexts/theme-context'
import { CockpitStatusProvider } from '@/contexts/cockpit-status-context'
import { SplashOverlay } from '@/components/splash-overlay'
import { IdleSplash } from '@/components/idle-splash'
import { cn } from '@/lib/utils'
import { DashboardPesquisadorRedirect } from '@/components/dashboard-pesquisador-redirect'
import './territorio/mapa-tds/mapa-dom-fut-theme.css' // tema base neutra + laranja estratégico v3

import { pathnameUsesMapaFuturisticShell } from '@/lib/dashboard-mapa-futuristic-chrome'
import { DashboardHomeChromeProvider } from '@/contexts/dashboard-home-chrome-context'
import {
  DASHBOARD_HOME_ACCENT_GRADIENT,
  isDashboardHomePath,
} from '@/lib/dashboard-home-chrome'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()
  const pathname = usePathname() ?? ''
  const isMapaTdsShell = pathnameUsesMapaFuturisticShell(pathname)
  const isHomeAccentChrome = isDashboardHomePath(pathname) && !isMapaTdsShell
  /**
   * Conteúdo sempre em superfície branca (`bg-bg-surface`) para manter o miolo limpo,
   * deixando o cinza restrito à sidebar.
   * Na home `/dashboard`, fundo único em gradiente de acento (sidebar + coluna).
   */
  const columnBgClass = isHomeAccentChrome ? 'bg-transparent' : 'bg-bg-surface'

  return (
    <CockpitStatusProvider>
      <DashboardHomeChromeProvider value={isHomeAccentChrome}>
        <div
          className={cn(
            'flex h-screen overflow-hidden',
            isHomeAccentChrome ? 'bg-transparent' : isMapaTdsShell ? columnBgClass : 'bg-bg-surface',
          )}
          style={isHomeAccentChrome ? { background: DASHBOARD_HOME_ACCENT_GRADIENT } : undefined}
        >
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
            <main className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', columnBgClass)}>
              <DashboardPermissionGuard>
                <PageTransition>{children}</PageTransition>
              </DashboardPermissionGuard>
            </main>
          </div>
        </div>
      </DashboardHomeChromeProvider>
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

