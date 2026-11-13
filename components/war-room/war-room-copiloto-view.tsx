'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useIpt } from '@/hooks/use-ipt'
import {
  buildAgendaProximosPorMunicipio,
  type WarRoomAgendaProximoItem,
} from '@/lib/war-room/agenda-proximos'
import type { CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import { WarRoomExpectativaRankingModal } from '@/components/war-room/war-room-expectativa-ranking-modal'
import { WarRoomCopilotoObrasView } from '@/components/war-room/war-room-copiloto-obras-view'
import { WarRoomCopilotoEmendasView } from '@/components/war-room/war-room-copiloto-emendas-view'
import { WarRoomCopilotoRedesView } from '@/components/war-room/war-room-copiloto-redes-view'
import { WarRoomCopilotoRelatorioView } from '@/components/war-room/war-room-copiloto-relatorio-view'
import { WarRoomCopilotoCoberturaView } from '@/components/war-room/war-room-copiloto-cobertura-view'
import { useWarRoomViewMode } from '@/components/war-room/war-room-view-mode-context'
import {
  TseTabs,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  type TseAba,
} from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'

type CopilotoTab = 'cidades' | 'cobertura' | 'obras' | 'emendas' | 'redes' | 'relatorio'

const COPILOTO_ABAS: readonly TseAba<CopilotoTab>[] = [
  { id: 'cidades', label: 'Cidades' },
  { id: 'cobertura', label: 'Cobertura' },
  { id: 'obras', label: 'Obras' },
  { id: 'emendas', label: 'Emendas' },
  { id: 'redes', label: 'Redes Sociais' },
  { id: 'relatorio', label: 'Relatório' },
] as const

/**
 * Visão Copiloto — Cidades, Cobertura, Obras, Emendas, Redes e Relatório.
 */
export function WarRoomCopilotoView() {
  const { municipios, obras, loading, error, recarregar } = useIpt()
  const { copilotoTabHint, clearCopilotoTabHint } = useWarRoomViewMode()
  const [tab, setTab] = useState<CopilotoTab>('cidades')
  const [agendaPorMunicipio, setAgendaPorMunicipio] = useState<
    Map<string, WarRoomAgendaProximoItem[]>
  >(() => new Map())

  useEffect(() => {
    if (!copilotoTabHint) return
    setTab(copilotoTabHint)
    clearCopilotoTabHint()
  }, [copilotoTabHint, clearCopilotoTabHint])

  const loadAgendaProximos = useCallback(async () => {
    try {
      const res = await fetch('/api/agenda/events', { cache: 'no-store' })
      if (!res.ok) {
        setAgendaPorMunicipio(new Map())
        return
      }
      const data = (await res.json()) as { events?: CalendarEventRow[] }
      setAgendaPorMunicipio(buildAgendaProximosPorMunicipio(data.events ?? []))
    } catch {
      setAgendaPorMunicipio(new Map())
    }
  }, [])

  useEffect(() => {
    void loadAgendaProximos()
  }, [loadAgendaProximos])

  return (
    <div className="flex flex-col gap-4">
      <TseTabs abas={COPILOTO_ABAS} ativa={tab} onChange={setTab} />

      <div key={tab} className="min-w-0">
        {tab === 'obras' ? (
          <WarRoomCopilotoObrasView />
        ) : tab === 'emendas' ? (
          <WarRoomCopilotoEmendasView />
        ) : tab === 'relatorio' ? (
          <WarRoomCopilotoRelatorioView municipios={municipios} />
        ) : tab === 'redes' ? (
          <WarRoomCopilotoRedesView />
        ) : tab === 'cobertura' ? (
          <WarRoomCopilotoCoberturaView municipios={municipios} loading={loading} />
        ) : loading && municipios.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-16 text-[13px] text-[var(--tse-muted)] shadow-sm">
            <Loader2 className={cn(tseBotaoIconeClass, 'animate-spin')} strokeWidth={1.5} />
            <span>Carregando ranking do Copiloto…</span>
          </div>
        ) : error && municipios.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-[13px] text-[var(--tse-text)]">{error}</p>
            <button type="button" className={tseBotaoCinzaClass} onClick={() => void recarregar()}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <WarRoomExpectativaRankingModal
            variant="page"
            municipios={municipios}
            obras={obras}
            agendaPorMunicipio={agendaPorMunicipio}
            onClose={() => undefined}
          />
        )}
      </div>
    </div>
  )
}
