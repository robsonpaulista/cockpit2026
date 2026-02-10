'use client'

import { Sidebar } from '@/components/sidebar'
import { ProtectedRoute } from '@/components/protected-route'
import { DashboardHeader } from '@/components/dashboard-header'
import { DashboardPermissionGuard } from '@/components/dashboard-permission-guard'
import { NavigationLoadingBar } from '@/components/navigation-loading-bar'
import { SidebarProvider, useSidebar } from '@/contexts/sidebar-context'
import { NavigationLoadingProvider } from '@/contexts/navigation-loading-context'
import { ThemeProvider } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()

  return (
    <div className="flex h-screen overflow-hidden">
      <NavigationLoadingBar />
      <Sidebar />
      <div className={cn(
        'flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-out',
        collapsed ? 'lg:ml-20' : 'lg:ml-64'
      )}>
        <DashboardHeader />
        <main className="flex-1 overflow-y-auto">
          <DashboardPermissionGuard>{children}</DashboardPermissionGuard>
        </main>
      </div>
    </div>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <ThemeProvider>
        <NavigationLoadingProvider>
          <SidebarProvider>
            <DashboardContent>{children}</DashboardContent>
          </SidebarProvider>
        </NavigationLoadingProvider>
      </ThemeProvider>
    </ProtectedRoute>
  )
}

