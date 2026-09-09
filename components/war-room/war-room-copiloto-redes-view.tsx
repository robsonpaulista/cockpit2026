'use client'

import { Instagram, Loader2, RefreshCw, X } from 'lucide-react'
import '@/app/dashboard/war-room/radar-competitivo-ios.css'
import '@/app/dashboard/war-room/war-room-redes-hud.css'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import {
  fetchInstagramData,
  fetchInstagramHistory,
  loadInstagramConfig,
  loadInstagramConfigAsync,
  type InstagramHistoryResponse,
  type InstagramMetrics,
} from '@/lib/instagramApi'
import {
  fetchInstagramProfileVisitsManual,
  type InstagramProfileVisitManual,
} from '@/lib/instagram-profile-visits-manual'
import { WarRoomRedesHud } from '@/components/war-room/war-room-redes-hud'
import { WarRoomRedesVisitasManualForm } from '@/components/war-room/war-room-redes-visitas-manual'
import {
  buildWarRoomRedesDesempenhoKpis,
  copilotoRedesApiTimeRange,
  copilotoRedesDays,
  COPILOTO_REDES_PERIOD_OPTIONS,
  formatDataCurta,
  listDayKeys,
  type CopilotoRedesPeriod,
} from '@/lib/war-room/redes-copiloto'
import { cn } from '@/lib/utils'

function formatLastUpdateLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function WarRoomCopilotoRedesView() {
  const [period, setPeriod] = useState<CopilotoRedesPeriod>('7d')
  const days = copilotoRedesDays(period)
  const periodLabel =
    COPILOTO_REDES_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? `${days} dias`
  const [metrics, setMetrics] = useState<InstagramMetrics | null>(null)
  const [history, setHistory] = useState<InstagramHistoryResponse | null>(null)
  const [manualVisitsByDate, setManualVisitsByDate] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [visitasManualOpen, setVisitasManualOpen] = useState(false)
  const visitasManualModalTitleId = useId()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let cfg = loadInstagramConfig()
      if (!cfg.configured) {
        cfg = await loadInstagramConfigAsync()
      }
      setConfigured(true)
      const apiRange = copilotoRedesApiTimeRange(period)
      const [data, hist, visitsManual] = await Promise.all([
        fetchInstagramData(cfg.token, cfg.businessAccountId, apiRange, false),
        fetchInstagramHistory(days),
        fetchInstagramProfileVisitsManual(days),
      ])
      if (!data) {
        setError('Não foi possível carregar o Instagram')
        setMetrics(null)
        return
      }
      setMetrics(data)
      setHistory(hist)
      setManualVisitsByDate(visitsManual.byDate)
      setLastUpdatedAt(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar Instagram')
      setMetrics(null)
    } finally {
      setLoading(false)
    }
  }, [period, days])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!visitasManualOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setVisitasManualOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visitasManualOpen])

  const desempenhoKpis = useMemo(
    () =>
      buildWarRoomRedesDesempenhoKpis({
        history,
        metrics,
        manualVisitsByDate,
        days,
      }),
    [history, metrics, manualVisitsByDate, days],
  )

  const visitDayKeys = useMemo(() => listDayKeys(days), [days])

  const formatVisitDayLabel = useCallback(
    (dateKey: string) => formatDataCurta(`${dateKey}T12:00:00`),
    [],
  )

  const handleManualVisitsSaved = useCallback((rows: InstagramProfileVisitManual[]) => {
    setManualVisitsByDate((prev) => {
      const next = { ...prev }
      for (const row of rows) {
        next[row.date] = row.visits
      }
      return next
    })
  }, [])

  if (loading && !metrics) {
    return (
      <div className="wr-copiloto-view__state">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--wr-accent,#F04B23)]" strokeWidth={1.5} />
        <span>Carregando Redes Sociais…</span>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="wr-copiloto-view__state">
        <p>{error || 'Instagram Pessoal não configurado'}</p>
        <Link href="/dashboard/conteudo/redes" className="wr-copiloto-view__retry">
          Configurar em Redes
        </Link>
      </div>
    )
  }

  if (error && !metrics) {
    return (
      <div className="wr-copiloto-view__state">
        <p>{error}</p>
        <button type="button" className="wr-copiloto-view__retry" onClick={() => void load()}>
          Tentar de novo
        </button>
      </div>
    )
  }

  return (
    <div className="wr-copiloto-redes wr-copiloto-redes--page wr-copiloto-reveal rc-ios rc-ios--game wr-redes-game">
      <header
        className="wr-copiloto-redes__toolbar wr-copiloto-reveal__card"
        style={{ ['--wr-reveal-i' as string]: 0 }}
      >
        <nav className="wr-copiloto-redes__period-tabs" aria-label="Período">
          {COPILOTO_REDES_PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                'wr-copiloto-redes__period-tab',
                period === opt.value && 'wr-copiloto-redes__period-tab--active',
              )}
              onClick={() => setPeriod(opt.value)}
              aria-pressed={period === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </nav>

        <div className="wr-copiloto-redes__toolbar-actions">
          <p className="wr-copiloto-redes__last-update">
            <span className="wr-copiloto-redes__last-update-label">Última atualização:</span>{' '}
            <span className="wr-copiloto-redes__last-update-value">
              {lastUpdatedAt ? formatLastUpdateLabel(lastUpdatedAt) : '—'}
            </span>
          </p>

          <Link href="/dashboard/conteudo/redes" className="wr-copiloto-redes__ghost-btn">
            <Instagram className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            Instagram
          </Link>

          <button
            type="button"
            className="wr-copiloto-redes__ghost-btn"
            onClick={() => {
              void load()
            }}
            disabled={loading}
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
              strokeWidth={1.5}
              aria-hidden
            />
            Atualizar
          </button>
        </div>
      </header>

      <WarRoomRedesHud
        periodLabel={periodLabel}
        kpis={desempenhoKpis}
        onVisitsDoubleClick={() => setVisitasManualOpen(true)}
      />

      {visitasManualOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="wr-visita-modal" role="presentation">
              <button
                type="button"
                className="wr-visita-modal__backdrop"
                aria-label="Fechar"
                onClick={() => setVisitasManualOpen(false)}
              />
              <div
                className="wr-visita-modal__panel wr-copiloto-redes__visitas-manual-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={visitasManualModalTitleId}
              >
                <header className="wr-visita-modal__head">
                  <div className="wr-visita-modal__head-main min-w-0">
                    <p className="wr-visita-modal__eyebrow">Meta Insights · Instagram</p>
                    <h2 id={visitasManualModalTitleId} className="wr-visita-modal__title">
                      Visitas ao perfil
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="wr-visita-modal__close"
                    aria-label="Fechar"
                    onClick={() => setVisitasManualOpen(false)}
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  </button>
                </header>

                <div className="wr-copiloto-redes__visitas-manual-body">
                  <p className="wr-copiloto-redes__visitas-manual-hint">
                    Informe um valor por dia (últimos {periodLabel}). Os indicadores atualizam ao
                    salvar.
                  </p>
                  <WarRoomRedesVisitasManualForm
                    embedded
                    dates={visitDayKeys}
                    initialByDate={manualVisitsByDate}
                    formatDateLabel={formatVisitDayLabel}
                    onSaved={handleManualVisitsSaved}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
