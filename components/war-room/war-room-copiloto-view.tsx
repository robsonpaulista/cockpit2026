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
import { WarRoomCopilotoRedesView } from '@/components/war-room/war-room-copiloto-redes-view'
import { useWarRoomViewMode } from '@/components/war-room/war-room-view-mode-context'
import { cn } from '@/lib/utils'

type CopilotoTab = 'cidades' | 'redes'

/**
 * Visão Copiloto — abas Cidades (ranking expectativa) e Redes Sociais.
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
          className={cn('wr-copiloto-tabs__btn', tab === 'cidades' && 'wr-copiloto-tabs__btn--active')}
          aria-pressed={tab === 'cidades'}
          onClick={() => setTab('cidades')}
        >
          Cidades
        </button>
        <button
          type="button"
          className={cn('wr-copiloto-tabs__btn', tab === 'redes' && 'wr-copiloto-tabs__btn--active')}
          aria-pressed={tab === 'redes'}
          onClick={() => setTab('redes')}
        >
          Redes Sociais
        </button>
      </nav>

      {tab === 'redes' ? (
        <WarRoomCopilotoRedesView />
      ) : loading && municipios.length === 0 ? (
        <div className="wr-copiloto-view__state">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--wr-accent,#F04B23)]" />
          <span>Carregando ranking do Copiloto…</span>
        </div>
      ) : error && municipios.length === 0 ? (
        <div className="wr-copiloto-view__state">
          <p>{error}</p>
          <button
            type="button"
            className="wr-copiloto-view__retry"
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
  )
}
