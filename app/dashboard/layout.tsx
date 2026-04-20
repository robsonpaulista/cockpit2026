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

const MAPA_TDS_FUTURISTIC_ROUTE = '/dashboard/territorio/mapa-tds'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()
  const pathname = usePathname()
  const mapaTdsFuturisticShell = pathname?.startsWith(MAPA_TDS_FUTURISTIC_ROUTE) ?? false

  return (
    <CockpitStatusProvider>
      <div
        className={cn(
          'flex h-screen overflow-hidden',
          mapaTdsFuturisticShell && 'bg-[#0B0F14]'
        )}
        data-map-tds-futuristic-shell={mapaTdsFuturisticShell ? 'true' : undefined}
      >
        <NavigationLoadingBar />
        <Sidebar />
        <div
          className={cn(
            'flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-out',
            collapsed ? 'lg:ml-20' : 'lg:ml-64',
            mapaTdsFuturisticShell && 'bg-[#0B0F14]'
          )}
          data-map-tds-futuristic-main={mapaTdsFuturisticShell ? 'true' : undefined}
        >
          <DashboardHeader />
          <main className={cn('flex-1 overflow-y-auto', mapaTdsFuturisticShell && 'bg-[#0B0F14]')}>
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

