'use client'

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

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()

  return (
    <CockpitStatusProvider>
      <div className="flex h-screen overflow-hidden bg-bg-app">
        <NavigationLoadingBar />
        <Sidebar />
        <div
          className={cn(
            'flex flex-1 flex-col overflow-hidden bg-bg-app transition-all duration-300 ease-out',
            collapsed ? 'lg:ml-20' : 'lg:ml-64',
          )}
        >
          <DashboardHeader />
          <main className="flex-1 overflow-y-auto bg-bg-app">
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

