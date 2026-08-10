'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { EmendasPanel } from '@/components/emendas/emendas-panel'

/** Copiloto · Emendas — mesma tela institucional, chrome War Room. */
export function WarRoomCopilotoEmendasView() {
  return (
    <div className="wr-copiloto-emendas wr-copiloto-reveal">
      <header
        className="wr-copiloto-emendas__toolbar wr-copiloto-reveal__card"
        style={{ ['--wr-reveal-i' as string]: 0 }}
      >
        <div className="wr-copiloto-emendas__toolbar-meta">
          <h2 className="wr-copiloto-emendas__title">Emendas</h2>
          <p className="wr-copiloto-emendas__hint">Cadastro e acompanhamento institucional</p>
        </div>
        <div className="wr-copiloto-emendas__toolbar-actions">
          <Link href="/dashboard/emendas" className="wr-copiloto-redes__ghost-btn">
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            Abrir Emendas
          </Link>
        </div>
      </header>

      <div className="wr-copiloto-emendas__body wr-copiloto-reveal__board">
        <EmendasPanel variant="copiloto" />
      </div>
    </div>
  )
}
