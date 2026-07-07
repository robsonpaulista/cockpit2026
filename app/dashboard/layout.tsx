'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardHeader } from '@/components/dashboard-header'
import { DashboardScrollRegion } from '@/components/dashboard/dashboard-scroll-region'
import { DashboardPermissionGuard } from '@/components/dashboard-permission-guard'
import { NavigationLoadingBar } from '@/components/navigation-loading-bar'
import { PageTransition } from '@/components/page-transition'
import { SidebarProvider, useSidebar } from '@/contexts/sidebar-context'
import { NavigationLoadingProvider } from '@/contexts/navigation-loading-context'
import { ThemeProvider } from '@/contexts/theme-context'
import { CockpitStatusProvider } from '@/contexts/cockpit-status-context'
import { IdleSplashOverlay } from '@/components/idle-splash'
import { IdleSplashProvider } from '@/contexts/idle-splash-context'
import { SplashScreenRestHost } from '@/components/splash-screen/splash-screen-rest-host'
import { cn } from '@/lib/utils'
import {
  SIDEBAR_MAIN_OFFSET_COLLAPSED_CLASS,
  SIDEBAR_MAIN_OFFSET_EXPANDED_CLASS,
} from '@/lib/sidebar-layout'
import { DashboardPesquisadorRedirect } from '@/components/dashboard-pesquisador-redirect'
import './territorio/mapa-tds/mapa-dom-fut-theme.css' // tema base neutra + laranja estratégico v3

import { pathnameUsesMapaFuturisticShell } from '@/lib/dashboard-mapa-futuristic-chrome'
import { DashboardPageChromeProvider } from '@/contexts/dashboard-page-chrome-context'
import { DashboardHomeChromeProvider } from '@/contexts/dashboard-home-chrome-context'
import { JarvisHostPropsProvider } from '@/contexts/jarvis-host-props-context'
import { JarvisVisibilityProvider } from '@/contexts/jarvis-visibility-context'
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
  const columnBgClass = isHomeAccentChrome ? 'bg-transparent' : 'bg-bg-surface'
  const mainOffsetClass = collapsed
    ? SIDEBAR_MAIN_OFFSET_COLLAPSED_CLASS
    : SIDEBAR_MAIN_OFFSET_EXPANDED_CLASS

  return (
    <CockpitStatusProvider>
      <DashboardHomeChromeProvider value={isHomeAccentChrome}>
        <DashboardPageChromeProvider>
        <div
          className={cn(
            'relative flex h-screen overflow-hidden bg-bg-surface',
            !isHomeAccentChrome && isMapaTdsShell && columnBgClass,
          )}
        >
          <div className={cn('relative z-[1] flex h-full min-h-0 w-full flex-1')}>
            <NavigationLoadingBar />
            <Sidebar />
            <IdleSplashOverlay />
            <SplashScreenRestHost />
            <div
              className={cn(
                'relative flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-out',
                isHomeAccentChrome ? DASHBOARD_HOME_SHELL_CLASS : columnBgClass,
                mainOffsetClass,
              )}
              style={isHomeAccentChrome ? dashboardHomeShellStyle : undefined}
            >
              <DashboardHeader />
              <main
                className={cn(
                  'relative flex min-h-0 flex-1 overflow-hidden flex-col',
                  columnBgClass
                )}
              >
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <DashboardScrollRegion>
                    <DashboardPermissionGuard>
                      <PageTransition>{children}</PageTransition>
                    </DashboardPermissionGuard>
                  </DashboardScrollRegion>
                </div>
                <JarvisGlobalHost />
              </main>
            </div>
          </div>
        </div>
        </DashboardPageChromeProvider>
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
      <ProtectedRoute>
        <IdleSplashProvider>
        <DashboardPesquisadorRedirect />
        <ThemeProvider>
          <NavigationLoadingProvider>
            <SidebarProvider>
              <JarvisVisibilityProvider>
                <JarvisHostPropsProvider>
                  <DashboardContent>{children}</DashboardContent>
                </JarvisHostPropsProvider>
              </JarvisVisibilityProvider>
            </SidebarProvider>
          </NavigationLoadingProvider>
        </ThemeProvider>
        </IdleSplashProvider>
      </ProtectedRoute>
    </>
  )
}

