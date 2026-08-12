'use client'

import { MapaObrasPanel } from '@/components/territorio-campo/mapa-obras-panel'

/** Copiloto · Obras — mapa/lista (fonte Sheets Demandas). */
export function WarRoomCopilotoObrasView() {
  return (
    <div className="wr-copiloto-obras wr-copiloto-reveal">
      <header
        className="wr-copiloto-obras__toolbar wr-copiloto-reveal__card"
        style={{ ['--wr-reveal-i' as string]: 0 }}
      >
        <div className="wr-copiloto-obras__toolbar-meta">
          <h2 className="wr-copiloto-obras__title">Obras</h2>
          <p className="wr-copiloto-obras__hint">Mapa · Lista e status</p>
        </div>
      </header>

      <div className="wr-copiloto-obras__body wr-copiloto-reveal__board">
        <MapaObrasPanel embedded />
      </div>
    </div>
  )
}
