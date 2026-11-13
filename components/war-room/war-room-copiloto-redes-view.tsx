'use client'

import { Instagram, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import Link from 'next/link'
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
import {
  TseCarregando,
  TseErro,
  TseFilterBar,
  TseModal,
  TseSegmentado,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
} from '@/components/tse/tse-ui'

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
    return <TseCarregando texto="Carregando Redes Sociais…" className="min-h-[30vh]" />
  }

  if (!configured) {
    return (
      <div className="flex flex-col items-start gap-3">
        <TseVazio>{error || 'Instagram Pessoal não configurado'}</TseVazio>
        <Link href="/dashboard/conteudo/redes" className={tseBotaoCinzaClass}>
          <Instagram className={tseBotaoIconeClass} strokeWidth={1.5} aria-hidden />
          Configurar em Redes
        </Link>
      </div>
    )
  }

  if (error && !metrics) {
    return (
      <div className="flex flex-col items-start gap-3">
        <TseErro>{error}</TseErro>
        <button type="button" className={tseBotaoCinzaClass} onClick={() => void load()}>
          Tentar de novo
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4" data-tse-redes="">
      <TseFilterBar>
        <div>
          <h2 className="text-[18px] font-bold text-[var(--tse-text)]">Redes Sociais</h2>
          <p className="mt-0.5 text-[13px] text-[var(--tse-muted)]">
            Instagram · desempenho e evolução
          </p>
        </div>
        <div className="flex flex-col gap-1 text-[13px] font-semibold text-[var(--tse-text)]">
          Período
          <TseSegmentado
            opcoes={COPILOTO_REDES_PERIOD_OPTIONS.map((opt) => ({
              id: opt.value,
              label: opt.label,
            }))}
            valor={period}
            onChange={setPeriod}
          />
        </div>
        <p className="text-[12px] text-[var(--tse-muted)]">
          <span className="font-semibold">Atualizado:</span>{' '}
          {lastUpdatedAt ? formatLastUpdateLabel(lastUpdatedAt) : '—'}
        </p>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <Link href="/dashboard/conteudo/redes" className={tseBotaoCinzaClass}>
            <Instagram className={tseBotaoIconeClass} strokeWidth={1.5} aria-hidden />
            Instagram
          </Link>
          <button
            type="button"
            className={tseBotaoCinzaClass}
            onClick={() => {
              void load()
            }}
            disabled={loading}
          >
            <RefreshCw
              className={cn(tseBotaoIconeClass, loading && 'animate-spin')}
              strokeWidth={1.5}
              aria-hidden
            />
            Atualizar
          </button>
        </div>
      </TseFilterBar>

      <WarRoomRedesHud
        periodLabel={periodLabel}
        kpis={desempenhoKpis}
        onVisitsDoubleClick={() => setVisitasManualOpen(true)}
      />

      {visitasManualOpen ? (
        <TseModal
          id={visitasManualModalTitleId}
          titulo="Visitas ao perfil"
          subtitulo={`Meta Insights · Instagram · últimos ${periodLabel}`}
          onClose={() => setVisitasManualOpen(false)}
          largura="max-w-2xl"
        >
          <p className="text-[13px] text-[var(--tse-muted)]">
            Informe um valor por dia (últimos {periodLabel}). Os indicadores atualizam ao salvar.
          </p>
          <WarRoomRedesVisitasManualForm
            embedded
            dates={visitDayKeys}
            initialByDate={manualVisitsByDate}
            formatDateLabel={formatVisitDayLabel}
            onSaved={handleManualVisitsSaved}
          />
        </TseModal>
      ) : null}
    </div>
  )
}
