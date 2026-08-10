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
import { WarRoomCopilotoPanoramaView } from '@/components/war-room/war-room-copiloto-panorama-view'
import { WarRoomCopilotoComparativoView } from '@/components/war-room/war-room-copiloto-comparativo-view'
import { WarRoomCopilotoObrasView } from '@/components/war-room/war-room-copiloto-obras-view'
import { WarRoomCopilotoEmendasView } from '@/components/war-room/war-room-copiloto-emendas-view'
import { WarRoomCopilotoRedesView } from '@/components/war-room/war-room-copiloto-redes-view'
import { useWarRoomViewMode } from '@/components/war-room/war-room-view-mode-context'
import { cn } from '@/lib/utils'

type CopilotoTab = 'cidades' | 'obras' | 'emendas' | 'redes' | 'panorama' | 'comparativo'

/**
 * Visão Copiloto — Cidades, Obras, Emendas, Redes, Comparativo e Radar.
 */
export function WarRoomCopilotoView() {
  const { municipios, obras, loading, error, recarregar } = useIpt()
  const { setViewMode } = useWarRoomViewMode()
  const [tab, setTab] = useState<CopilotoTab>('cidades')
  const [agendaPorMunicipio, setAgendaPorMunicipio] = useState<
    Map<string, WarRoomAgendaProximoItem[]>
  >(() => new Map())

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
    <div className="wr-copiloto-view">
      <nav className="wr-copiloto-tabs" aria-label="Seções do Copiloto">
        <button
          type="button"
          className={cn(
            'wr-copiloto-tabs__btn wr-copiloto-press',
            tab === 'cidades' && 'wr-copiloto-tabs__btn--active',
          )}
          aria-pressed={tab === 'cidades'}
          onClick={() => setTab('cidades')}
        >
          Cidades
        </button>
        <button
          type="button"
          className={cn(
            'wr-copiloto-tabs__btn wr-copiloto-press',
            tab === 'obras' && 'wr-copiloto-tabs__btn--active',
          )}
          aria-pressed={tab === 'obras'}
          onClick={() => setTab('obras')}
        >
          Obras
        </button>
        <button
          type="button"
          className={cn(
            'wr-copiloto-tabs__btn wr-copiloto-press',
            tab === 'emendas' && 'wr-copiloto-tabs__btn--active',
          )}
          aria-pressed={tab === 'emendas'}
          onClick={() => setTab('emendas')}
        >
          Emendas
        </button>
        <button
          type="button"
          className={cn(
            'wr-copiloto-tabs__btn wr-copiloto-press',
            tab === 'redes' && 'wr-copiloto-tabs__btn--active',
          )}
          aria-pressed={tab === 'redes'}
          onClick={() => setTab('redes')}
        >
          Redes Sociais
        </button>
        <button
          type="button"
          className={cn(
            'wr-copiloto-tabs__btn wr-copiloto-press',
            tab === 'comparativo' && 'wr-copiloto-tabs__btn--active',
          )}
          aria-pressed={tab === 'comparativo'}
          onClick={() => setTab('comparativo')}
        >
          Comparativo
        </button>
        <button
          type="button"
          className={cn(
            'wr-copiloto-tabs__btn wr-copiloto-press',
            tab === 'panorama' && 'wr-copiloto-tabs__btn--active',
          )}
          aria-pressed={tab === 'panorama'}
          onClick={() => setTab('panorama')}
        >
          Radar
        </button>
      </nav>

      <div key={tab} className="wr-copiloto-view__panel">
        {tab === 'obras' ? (
          <WarRoomCopilotoObrasView />
        ) : tab === 'emendas' ? (
          <WarRoomCopilotoEmendasView />
        ) : tab === 'redes' ? (
          <WarRoomCopilotoRedesView />
        ) : tab === 'panorama' ? (
          <WarRoomCopilotoPanoramaView />
        ) : tab === 'comparativo' ? (
          <WarRoomCopilotoComparativoView />
        ) : loading && municipios.length === 0 ? (
          <div className="wr-copiloto-view__state">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--wr-accent,#F04B23)]" strokeWidth={1.5} />
            <span>Carregando ranking do Copiloto…</span>
          </div>
        ) : error && municipios.length === 0 ? (
          <div className="wr-copiloto-view__state">
            <p>{error}</p>
            <button
              type="button"
              className="wr-copiloto-view__retry wr-copiloto-press"
              onClick={() => void recarregar()}
            >
              Tentar de novo
            </button>
          </div>
        ) : (
          <WarRoomExpectativaRankingModal
            variant="page"
            municipios={municipios}
            obras={obras}
            agendaPorMunicipio={agendaPorMunicipio}
            onClose={() => setViewMode('padrao')}
          />
        )}
      </div>
    </div>
  )
}
