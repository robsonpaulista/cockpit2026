'use client'

import { RefreshCw } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import {
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { typographyContentRootClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'
import { useSetDashboardTopbarExtras } from '@/contexts/dashboard-topbar-extras-context'
import { WarRoomCidadeProvider } from '@/components/war-room/war-room-cidade-context'
import {
  WarRoomRefreshProvider,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { WarRoomViewModeProvider } from '@/components/war-room/war-room-view-mode-context'
import { WarRoomCopilotoView } from '@/components/war-room/war-room-copiloto-view'

import '@/app/dashboard/shared/ipt-page-palette.css'
import '@/app/dashboard/war-room/war-room-fonts.css'
import '@/app/dashboard/war-room/war-room-clean.css'
import '@/app/dashboard/shared/cobertura-cx-chrome.css'

export function WarRoomPanel() {
  return (
    <WarRoomCidadeProvider>
      <WarRoomRefreshProvider>
        <WarRoomViewModeProvider>
          <WarRoomPanelInner />
        </WarRoomViewModeProvider>
      </WarRoomRefreshProvider>
    </WarRoomCidadeProvider>
  )
}

function WarRoomPanelInner() {
  const { refreshAll, refreshing } = useWarRoomRefresh()

  useEffect(() => {
    document.body.setAttribute('data-war-room-clean', '')
    document.body.setAttribute('data-wr-copiloto', '')
    return () => {
      document.body.removeAttribute('data-wr-copiloto')
    }
  }, [])

  const topbarExtras = useMemo(
    () => ({
      actions: (
        <button
          type="button"
          onClick={() => void refreshAll({ silent: false })}
          disabled={refreshing}
          className="wr-topbar-clean__refresh inline-flex items-center gap-1.5 rounded-[10px] border border-[#2b2d31] bg-white px-3 py-1.5 text-[13px] font-medium text-[#2b2d31] transition-colors hover:border-[#f2d06b] hover:bg-[#f2d06b] disabled:opacity-50"
        >
          <RefreshCw
            className={cn('wr-icon', refreshing && 'animate-spin')}
            strokeWidth={1.5}
          />
          Atualizar
        </button>
      ),
    }),
    [refreshAll, refreshing],
  )

  useSetDashboardTopbarExtras(topbarExtras)

  return (
    <DashboardPageShell>
      <DashboardPageChrome>{null}</DashboardPageChrome>

      <DashboardPageContent className={cn(typographyContentRootClass, 'pt-2 md:pt-3')}>
        <div className="wr-page-canvas wr-page-canvas--copiloto">
          <WarRoomCopilotoView />
        </div>
      </DashboardPageContent>
    </DashboardPageShell>
  )
}
