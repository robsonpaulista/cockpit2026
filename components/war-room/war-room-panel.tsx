'use client'

import { RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { TsePage, tseBotaoCinzaClass, tseBotaoIconeClass } from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'
import { useSetDashboardTopbarExtras } from '@/contexts/dashboard-topbar-extras-context'
import { WarRoomCidadeProvider } from '@/components/war-room/war-room-cidade-context'
import {
  WarRoomRefreshProvider,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { WarRoomViewModeProvider } from '@/components/war-room/war-room-view-mode-context'
import { WarRoomCopilotoView } from '@/components/war-room/war-room-copiloto-view'

/** CSS das abas ainda não migradas (Cobertura, Obras, Emendas, Redes, Relatório). */
import '@/app/dashboard/war-room/war-room-fonts.css'
import '@/app/dashboard/war-room/war-room-clean.css'
import '@/app/dashboard/war-room/war-room-cidades-tse.css'
import '@/app/dashboard/war-room/war-room-cobertura-tse.css'
import '@/app/dashboard/war-room/war-room-obras-tse.css'
import '@/app/dashboard/war-room/war-room-emendas-tse.css'
import '@/app/dashboard/war-room/war-room-redes-tse.css'
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

  const topbarExtras = useMemo(
    () => ({
      actions: (
        <button
          type="button"
          onClick={() => void refreshAll({ silent: false })}
          disabled={refreshing}
          className={tseBotaoCinzaClass}
        >
          <RefreshCw className={cn(tseBotaoIconeClass, refreshing && 'animate-spin')} aria-hidden />
          Atualizar
        </button>
      ),
    }),
    [refreshAll, refreshing],
  )

  useSetDashboardTopbarExtras(topbarExtras)

  return (
    <TsePage className="!pb-6 !pt-4">
      <WarRoomCopilotoView />
    </TsePage>
  )
}
