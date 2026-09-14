'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Clock3,
  History,
  MapPin,
  Navigation,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import type { TerritoryCityBrief } from '@/lib/war-room/territorio-presenca'
import {
  formatAbsoluteVisitDate,
  formatDeltaVisitas,
  formatRelativeVisitDays,
  territoryRecencyThresholds,
} from '@/lib/war-room/territorio-presenca'
import { WarRoomUltimaVisitaModal } from '@/components/war-room/war-room-ultima-visita-modal'
import { cn } from '@/lib/utils'

type Props = {
  city: TerritoryCityBrief
  onClose: () => void
}

function formatNum(n: number): string {
  return n.toLocaleString('pt-BR')
}

/**
 * Painel contextual da cidade — investigação sem sair do workspace.
 */
export function TerritoryCityDrawer({ city, onClose }: Props) {
  const tituloId = useId()
  const [mounted, setMounted] = useState(false)
  const [showUltima, setShowUltima] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!mounted) return null

  const rel = formatRelativeVisitDays(city.daysSinceLastVisit)
  const abs = formatAbsoluteVisitDate(city.ultimaVisita)
  const deltaLabel = formatDeltaVisitas(city.deltaVisitas)
  const DeltaIcon = city.deltaVisitas > 0 ? TrendingUp : TrendingDown

  return createPortal(
    <div className="wr-territorio-drawer" role="presentation">
      <button
        type="button"
        className="wr-territorio-drawer__backdrop"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <aside
        className="wr-territorio-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <header className="wr-territorio-drawer__head">
          <div>
            <p className="wr-territorio-drawer__eyebrow">{city.regiao}</p>
            <h3 id={tituloId} className="wr-territorio-drawer__title">
              {city.municipio}
            </h3>
          </div>
          <button
            type="button"
            className="wr-territorio-drawer__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={16} strokeWidth={2.2} aria-hidden />
          </button>
        </header>

        <div className="wr-territorio-drawer__body">
          <section className="wr-territorio-drawer__block">
            <p className="wr-territorio-drawer__label">
              <Navigation size={13} strokeWidth={2.2} aria-hidden />
              Presença
            </p>
            <p className="wr-territorio-drawer__hero tabular-nums">
              {city.visitasNoPeriodo > 0
                ? `${city.visitasNoPeriodo} visita${city.visitasNoPeriodo === 1 ? '' : 's'}`
                : 'Sem visita'}
              <span>
                {city.visitasNoPeriodo > 0
                  ? `últimos ${territoryRecencyThresholds.periodDays} dias`
                  : `nos últimos ${territoryRecencyThresholds.periodDays} dias`}
              </span>
            </p>
            {deltaLabel ? (
              <p
                className={cn(
                  'wr-territorio-drawer__delta',
                  city.deltaVisitas > 0
                    ? 'wr-territorio-drawer__delta--up'
                    : 'wr-territorio-drawer__delta--down',
                )}
              >
                <DeltaIcon size={13} strokeWidth={2.2} aria-hidden />
                {deltaLabel} vs. período anterior
              </p>
            ) : null}
          </section>

          <section className="wr-territorio-drawer__block">
            <p className="wr-territorio-drawer__label">
              <Clock3 size={13} strokeWidth={2.2} aria-hidden />
              Última visita
            </p>
            {abs || rel ? (
              <>
                <p className="wr-territorio-drawer__value">{abs ?? '—'}</p>
                {rel ? <p className="wr-territorio-drawer__muted">{rel}</p> : null}
              </>
            ) : (
              <p className="wr-territorio-drawer__muted">Sem registro de visita recente.</p>
            )}
          </section>

          <section className="wr-territorio-drawer__grid">
            <div>
              <p className="wr-territorio-drawer__label">
                <MapPin size={13} strokeWidth={2.2} aria-hidden />
                Cobertura
              </p>
              <p className="wr-territorio-drawer__value">{city.coberturaLabel}</p>
            </div>
            <div>
              <p className="wr-territorio-drawer__label">
                <Target size={13} strokeWidth={2.2} aria-hidden />
                Meta
              </p>
              <p className="wr-territorio-drawer__value tabular-nums">
                {city.hasMeta ? formatNum(city.expectativaVotos) : '—'}
              </p>
            </div>
          </section>

          {city.visitasHistorico > 0 ? (
            <section className="wr-territorio-drawer__block">
              <p className="wr-territorio-drawer__label">
                <History size={13} strokeWidth={2.2} aria-hidden />
                Histórico acumulado
              </p>
              <p className="wr-territorio-drawer__muted">
                {city.visitasHistorico} visita{city.visitasHistorico === 1 ? '' : 's'} no
                histórico de campo disponível.
              </p>
            </section>
          ) : null}

          <button
            type="button"
            className="wr-territorio-drawer__cta"
            onClick={() => setShowUltima(true)}
          >
            Ver última visita →
          </button>
        </div>
      </aside>

      {showUltima ? (
        <WarRoomUltimaVisitaModal
          municipio={city.municipio}
          onClose={() => setShowUltima(false)}
        />
      ) : null}
    </div>,
    document.body,
  )
}
