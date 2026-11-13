'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { EmendasPanel } from '@/components/emendas/emendas-panel'
import { WarRoomCopilotoEmendasComparativoView } from '@/components/war-room/war-room-copiloto-emendas-comparativo-view'
import { TseSegmentado, tseBotaoCinzaClass, tseBotaoIconeClass } from '@/components/tse/tse-ui'

type EmendasSubTab = 'comparativo' | 'cadastro'

/** Copiloto · Emendas — Comparativo PI + cadastro institucional (pele TSE). */
export function WarRoomCopilotoEmendasView() {
  const [subTab, setSubTab] = useState<EmendasSubTab>('comparativo')

  return (
    <div className="flex flex-col gap-4" data-tse-emendas="">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-bold text-[var(--tse-text)]">Emendas</h2>
          <p className="mt-0.5 text-[13px] text-[var(--tse-muted)]">
            {subTab === 'comparativo'
              ? 'Comparativo da bancada federal do Piauí · Portal da Transparência'
              : 'Cadastro e acompanhamento institucional'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1 text-[13px] font-semibold text-[var(--tse-text)]">
            Visão
            <TseSegmentado
              opcoes={
                [
                  { id: 'comparativo', label: 'Comparativo PI' },
                  { id: 'cadastro', label: 'Cadastro' },
                ] as const
              }
              valor={subTab}
              onChange={setSubTab}
            />
          </div>
          {subTab === 'cadastro' ? (
            <Link href="/dashboard/emendas" className={tseBotaoCinzaClass}>
              <ExternalLink className={tseBotaoIconeClass} strokeWidth={1.5} aria-hidden />
              Abrir Emendas
            </Link>
          ) : null}
        </div>
      </header>

      <div className="min-w-0">
        {subTab === 'comparativo' ? (
          <WarRoomCopilotoEmendasComparativoView />
        ) : (
          <EmendasPanel variant="copiloto" />
        )}
      </div>
    </div>
  )
}
