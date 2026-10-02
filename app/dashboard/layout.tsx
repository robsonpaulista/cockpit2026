'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardHeader } from '@/components/dashboard-header'
import { DashboardScrollRegion } from '@/components/dashboard/dashboard-scroll-region'
import { DashboardPermissionGuard } from '@/components/dashboard-permission-guard'
import { NavigationLoadingBar } from '@/components/navigation-loading-bar'
import { PageTransition } from '@/components/page-transition'
import { PermissionsProvider } from '@/contexts/permissions-context'
import { SidebarProvider, useSidebar } from '@/contexts/sidebar-context'
import { NavigationLoadingProvider } from '@/contexts/navigation-loading-context'
import { ThemeProvider } from '@/contexts/theme-context'
import { CockpitStatusProvider } from '@/contexts/cockpit-status-context'
import { IdleSplashProvider } from '@/contexts/idle-splash-context'
import { SplashScreenRestHost } from '@/components/splash-screen/splash-screen-rest-host'
import { cn } from '@/lib/utils'
import {
  SIDEBAR_MAIN_OFFSET_COLLAPSED_CLASS,
  SIDEBAR_MAIN_OFFSET_EXPANDED_CLASS,
} from '@/lib/sidebar-layout'
import { DashboardPesquisadorRedirect } from '@/components/dashboard-pesquisador-redirect'
import { useSessionPresence } from '@/hooks/use-session-presence'
import './shared/mapa-dom-fut-theme.css' // tema base neutra + laranja estratégico v3

import { DashboardPageChromeProvider } from '@/contexts/dashboard-page-chrome-context'
import { DashboardTopbarExtrasProvider } from '@/contexts/dashboard-topbar-extras-context'
import { DashboardHomeChromeProvider } from '@/contexts/dashboard-home-chrome-context'
import { JarvisHostPropsProvider } from '@/contexts/jarvis-host-props-context'
import { JarvisVisibilityProvider } from '@/contexts/jarvis-visibility-context'
import { JarvisGlobalHost } from '@/components/jarvis/jarvis-global-host'
import {
  isDashboardHomePath,
  isIceGlassSidebarPath,
} from '@/lib/dashboard-home-chrome'
import '@/components/jarvis/jarvis-neural.css'
import '@/components/dashboard/home-glass.css'
import '@/app/sidebar-obsidian-glass.css'
import { DashboardCleanThemeBootstrap } from '@/components/dashboard/dashboard-clean-theme'

function DashboardContent({ children }: { children: React.ReactNode }) {
  useSessionPresence()
  const { collapsed, setCollapsed } = useSidebar()
  const pathname = usePathname() ?? ''
  const isHomeScene = isDashboardHomePath(pathname)
  /** Glass sidebar só fora da home hub (home não tem sidebar). */
  const isIceSidebar = isIceGlassSidebarPath(pathname) && !isHomeScene
  const columnBgClass = isHomeScene ? 'bg-black' : 'bg-bg-surface'
  const mainOffsetClass = collapsed
    ? SIDEBAR_MAIN_OFFSET_COLLAPSED_CLASS
    : SIDEBAR_MAIN_OFFSET_EXPANDED_CLASS

  useEffect(() => {
    if (isIceSidebar) {
      document.body.setAttribute('data-home-glass', '')
    } else {
      document.body.removeAttribute('data-home-glass')
    }
    if (isHomeScene) {
      document.body.setAttribute('data-home-scene', '')
    } else {
      document.body.removeAttribute('data-home-scene')
    }
    return () => {
      document.body.removeAttribute('data-home-glass')
      document.body.removeAttribute('data-home-scene')
    }
  }, [isIceSidebar, isHomeScene])

  /* War Room / home: sidebar expandida para mostrar logo + slogan (igual dashboard). */
  useEffect(() => {
    if (isIceSidebar) setCollapsed(false)
  }, [isIceSidebar, setCollapsed])

  return (
    <CockpitStatusProvider>
      <DashboardCleanThemeBootstrap />
      <DashboardHomeChromeProvider value={isIceSidebar}>
        <DashboardPageChromeProvider>
        <DashboardTopbarExtrasProvider>
        <div
          className={cn(
            'relative flex h-screen overflow-hidden',
            isHomeScene ? 'bg-black' : 'bg-bg-surface',
          )}
        >
          <div className={cn('relative z-[1] flex h-full min-h-0 w-full flex-1')}>
            <NavigationLoadingBar />
            {!isHomeScene ? <Sidebar /> : null}
            <SplashScreenRestHost />
            <div
              className={cn(
                'relative flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-out',
                isHomeScene ? 'bg-black' : columnBgClass,
                !isHomeScene && mainOffsetClass,
              )}
              data-home-glass-shell={isHomeScene ? '' : undefined}
              style={isHomeScene ? undefined : undefined}
            >
              {!isHomeScene ? <DashboardHeader /> : null}
              <main
                className={cn(
                  'relative flex min-h-0 flex-1 overflow-hidden flex-col',
                  isHomeScene ? 'bg-black' : columnBgClass,
                )}
              >
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <DashboardScrollRegion>
                    <DashboardPermissionGuard>
                      <PageTransition>{children}</PageTransition>
                    </DashboardPermissionGuard>
                  </DashboardScrollRegion>
                </div>
                {!isHomeScene ? <JarvisGlobalHost /> : null}
              </main>
            </div>
          </div>
        </div>
        </DashboardTopbarExtrasProvider>
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
              <PermissionsProvider>
                <JarvisVisibilityProvider>
                  <JarvisHostPropsProvider>
                    <DashboardContent>{children}</DashboardContent>
                  </JarvisHostPropsProvider>
                </JarvisVisibilityProvider>
              </PermissionsProvider>
            </SidebarProvider>
          </NavigationLoadingProvider>
        </ThemeProvider>
        </IdleSplashProvider>
      </ProtectedRoute>
    </>
  )
}

