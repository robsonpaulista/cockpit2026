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
import {
  SIDEBAR_MAIN_OFFSET_COLLAPSED_CLASS,
  SIDEBAR_MAIN_OFFSET_EXPANDED_CLASS,
} from '@/lib/sidebar-layout'
import { DashboardPesquisadorRedirect } from '@/components/dashboard-pesquisador-redirect'
import './territorio/mapa-tds/mapa-dom-fut-theme.css' // tema base neutra + laranja estratégico v3

import { pathnameUsesMapaFuturisticShell } from '@/lib/dashboard-mapa-futuristic-chrome'
import { DashboardHomeChromeProvider } from '@/contexts/dashboard-home-chrome-context'
import { JarvisHostPropsProvider } from '@/contexts/jarvis-host-props-context'
import { JarvisGlobalHost } from '@/components/jarvis/jarvis-global-host'
import {
  DASHBOARD_HOME_SHELL_CLASS,
  dashboardHomeShellStyle,
  isDashboardHomePath,
} from '@/lib/dashboard-home-chrome'
import '@/components/jarvis/jarvis-neural.css'

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
            'relative flex h-screen overflow-hidden',
            isHomeAccentChrome ? DASHBOARD_HOME_SHELL_CLASS : isMapaTdsShell ? columnBgClass : 'bg-bg-surface',
          )}
          style={isHomeAccentChrome ? dashboardHomeShellStyle : undefined}
        >
          {isHomeAccentChrome ? (
            <div
              className="jarvis-perspective-grid pointer-events-none absolute inset-0 z-0 opacity-[0.22]"
              aria-hidden
            />
          ) : null}
          <div className={cn('relative z-[1] flex h-full min-h-0 w-full flex-1')}>
            <NavigationLoadingBar />
            <Sidebar />
            <div
              className={cn(
                'flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-out',
                columnBgClass,
                collapsed ? SIDEBAR_MAIN_OFFSET_COLLAPSED_CLASS : SIDEBAR_MAIN_OFFSET_EXPANDED_CLASS,
              )}
            >
              <DashboardHeader />
              <main
                className={cn(
                  'relative flex min-h-0 flex-1',
                  isHomeAccentChrome
                    ? 'flex-col overflow-hidden xl:flex-row'
                    : 'flex-col overflow-y-auto',
                  columnBgClass
                )}
              >
                <div
                  className={cn(
                    isHomeAccentChrome && 'flex min-h-0 min-w-0 flex-1 flex-col'
                  )}
                >
                  <DashboardPermissionGuard>
                    <PageTransition>{children}</PageTransition>
                  </DashboardPermissionGuard>
                </div>
                <JarvisGlobalHost />
              </main>
            </div>
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
              <JarvisHostPropsProvider>
                <DashboardContent>{children}</DashboardContent>
              </JarvisHostPropsProvider>
            </SidebarProvider>
          </NavigationLoadingProvider>
        </ThemeProvider>
      </ProtectedRoute>
    </>
  )
}

