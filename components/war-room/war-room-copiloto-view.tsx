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
import { useWarRoomViewMode } from '@/components/war-room/war-room-view-mode-context'

/**
 * Visão Copiloto — página inteira = Ranking completo de Expectativa (224).
 * Mesma fonte de dados do modal aberto pelo card Expectativa.
 */
export function WarRoomCopilotoView() {
  const { municipios, obras, loading, error, recarregar } = useIpt()
  const { setViewMode } = useWarRoomViewMode()
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

  if (loading && municipios.length === 0) {
    return (
      <div className="wr-copiloto-view__state">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--wr-accent,#F04B23)]" />
        <span>Carregando ranking do Copiloto…</span>
      </div>
    )
  }

  if (error && municipios.length === 0) {
    return (
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
    )
  }

  return (
    <div className="wr-copiloto-view">
      <WarRoomExpectativaRankingModal
        variant="page"
        municipios={municipios}
        obras={obras}
        agendaPorMunicipio={agendaPorMunicipio}
        onClose={() => setViewMode('padrao')}
      />
    </div>
  )
}
