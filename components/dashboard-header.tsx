'use client'

import { UserMenu } from './user-menu'

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 bg-bg-surface border-b border-border-card">
      <div className="h-16 flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold text-accent-gold">Observatório Agro Piauí</h1>
            <p className="text-xs text-text-secondary">Desenvolvido por 86Dynamics</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <UserMenu />
        </div>
      </div>
    </header>
  )
}




