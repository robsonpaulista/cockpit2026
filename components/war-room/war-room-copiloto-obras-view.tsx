'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { MapaObrasPanel } from '@/components/territorio-campo/mapa-obras-panel'

/** Copiloto · Obras — mesmo mapa/lista da Base Eleitoral, chrome War Room. */
export function WarRoomCopilotoObrasView() {
  return (
    <div className="wr-copiloto-obras wr-copiloto-reveal">
      <header
        className="wr-copiloto-obras__toolbar wr-copiloto-reveal__card"
        style={{ ['--wr-reveal-i' as string]: 0 }}
      >
        <div className="wr-copiloto-obras__toolbar-meta">
          <h2 className="wr-copiloto-obras__title">Obras</h2>
          <p className="wr-copiloto-obras__hint">Mapa · Lista e status · Base Eleitoral</p>
        </div>
        <div className="wr-copiloto-obras__toolbar-actions">
          <Link href="/dashboard/territorio?tab=mapa-obras" className="wr-copiloto-redes__ghost-btn">
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            Abrir na Base Eleitoral
          </Link>
        </div>
      </header>

      <div className="wr-copiloto-obras__body wr-copiloto-reveal__board">
        <MapaObrasPanel embedded />
      </div>
    </div>
  )
}
