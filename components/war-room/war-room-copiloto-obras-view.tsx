'use client'

import { MapaObrasPanel } from '@/components/territorio-campo/mapa-obras-panel'

/** Copiloto · Obras — mapa/lista (fonte Sheets Demandas), pele TSE. */
export function WarRoomCopilotoObrasView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-tse-obras="">
      <header>
        <h2 className="text-[18px] font-bold text-[var(--tse-text)]">Obras</h2>
        <p className="mt-0.5 text-[13px] text-[var(--tse-muted)]">Mapa · Lista e status</p>
      </header>

      <div className="min-h-0 flex-1">
        <MapaObrasPanel embedded />
      </div>
    </div>
  )
}
