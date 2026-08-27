'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { EmendasPanel } from '@/components/emendas/emendas-panel'
import { WarRoomCopilotoEmendasComparativoView } from '@/components/war-room/war-room-copiloto-emendas-comparativo-view'
import { cn } from '@/lib/utils'

type EmendasSubTab = 'comparativo' | 'cadastro'

/** Copiloto · Emendas — Comparativo PI + cadastro institucional. */
export function WarRoomCopilotoEmendasView() {
  const [subTab, setSubTab] = useState<EmendasSubTab>('comparativo')

  return (
    <div className="wr-copiloto-emendas wr-copiloto-reveal">
      <header
        className="wr-copiloto-emendas__toolbar wr-copiloto-reveal__card"
        style={{ ['--wr-reveal-i' as string]: 0 }}
      >
        <div className="wr-copiloto-emendas__toolbar-meta">
          <h2 className="wr-copiloto-emendas__title">Emendas</h2>
          <p className="wr-copiloto-emendas__hint">
            {subTab === 'comparativo'
              ? 'Comparativo da bancada federal do Piauí · Portal da Transparência'
              : 'Cadastro e acompanhamento institucional'}
          </p>
        </div>
        <div className="wr-copiloto-emendas__toolbar-actions">
          <div className="wr-copiloto-emendas__subtabs" role="tablist" aria-label="Visão de emendas">
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'comparativo'}
              className={cn(
                'wr-copiloto-emendas__subtab',
                subTab === 'comparativo' && 'wr-copiloto-emendas__subtab--on',
              )}
              onClick={() => setSubTab('comparativo')}
            >
              Comparativo PI
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subTab === 'cadastro'}
              className={cn(
                'wr-copiloto-emendas__subtab',
                subTab === 'cadastro' && 'wr-copiloto-emendas__subtab--on',
              )}
              onClick={() => setSubTab('cadastro')}
            >
              Cadastro
            </button>
          </div>
          {subTab === 'cadastro' ? (
            <Link href="/dashboard/emendas" className="wr-copiloto-redes__ghost-btn">
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              Abrir Emendas
            </Link>
          ) : null}
        </div>
      </header>

      <div className="wr-copiloto-emendas__body wr-copiloto-reveal__board">
        {subTab === 'comparativo' ? (
          <WarRoomCopilotoEmendasComparativoView />
        ) : (
          <EmendasPanel variant="copiloto" />
        )}
      </div>
    </div>
  )
}
