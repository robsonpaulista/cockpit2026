'use client'

import { UserMenu } from './user-menu'

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-border">
      <div className="h-16 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-primary">Cockpit 2026</h1>
        </div>
        <div className="flex items-center gap-4">
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

