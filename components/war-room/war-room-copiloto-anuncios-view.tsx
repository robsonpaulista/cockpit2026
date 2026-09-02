'use client'

import { Loader2, MapPin, Megaphone, RefreshCw } from 'lucide-react'
import '@/app/dashboard/war-room/radar-competitivo-ios.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MetaAdsCollectProgressBar } from '@/components/meta-ads-radar/meta-ads-collect-progress-bar'
import { WarRoomAnunciosHud } from '@/components/war-room/war-room-anuncios-hud'
import { useMetaAdsCollectPolling } from '@/hooks/use-meta-ads-collect-polling'
import { OWN_CANDIDATE_SLUG } from '@/lib/instagram-radar-own-sync'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import {
  buildOwnAnunciosTotals,
  buildWarRoomAnuncioListRows,
  buildWarRoomAnunciosCompareRows,
  buildWarRoomAnunciosCompetitorRows,
  buildWarRoomAnunciosLocationRows,
  computeWarRoomAnunciosScore,
  filterActiveAds,
  filterOwnCandidateAds,
  geoCoveragePct,
} from '@/lib/war-room/anuncios-copiloto'
import {
  COPILOTO_REDES_PERIOD_OPTIONS,
  copilotoRedesDays,
  type CopilotoRedesPeriod,
} from '@/lib/war-room/redes-copiloto'
import { cn } from '@/lib/utils'

const FETCH_LIMIT = 500

type MentionsPayload = {
  error?: string
  retryable?: boolean
  setupRequired?: boolean
  ads?: MetaAdsMentionWithActor[]
}

type ActorsPayload = {
  error?: string
  retryable?: boolean
  setupRequired?: boolean
  actors?: PoliticalActorWithTerms[]
}

function formatLastUpdateLabel(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Erros do execFile trazem stdout/stderr inteiro — mostra só um resumo legível. */
function summarizeCollectError(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return 'Falha na coleta Meta Ads'
  if (/Chromium|playwright install/i.test(text)) {
    return 'Chromium do Playwright não instalado. Rode: npx playwright install chromium'
  }
  if (/timeout|ETIMEDOUT|timed out/i.test(text)) {
    return 'Coleta expirou (timeout). Tente de novo ou rode o script no terminal.'
  }
  const jsonMatch = text.match(/\{[^{}]*"error"\s*:\s*"([^"]+)"/)
  if (jsonMatch?.[1]) return jsonMatch[1]
  if (text.startsWith('Command failed:')) {
    return 'Coleta Meta Ads falhou no script. Os anúncios já salvos continuam visíveis abaixo.'
  }
  return text.length > 220 ? `${text.slice(0, 220)}…` : text
}

/** Copiloto · Anúncios — Meta Ads Library com gamificação iOS. */
export function WarRoomCopilotoAnunciosView() {
  const [period, setPeriod] = useState<CopilotoRedesPeriod>('28d')
  const days = copilotoRedesDays(period)
  const periodLabel =
    COPILOTO_REDES_PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? `${days} dias`

  const [actors, setActors] = useState<PoliticalActorWithTerms[]>([])
  const [ads, setAds] = useState<MetaAdsMentionWithActor[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [collecting, setCollecting] = useState(false)
  const [collectMessage, setCollectMessage] = useState('')
  const [collectError, setCollectError] = useState<string | null>(null)
  const [pollCollect, setPollCollect] = useState(false)

  const { progress, status, refresh: refreshStatus } = useMetaAdsCollectPolling(
    collecting || pollCollect,
  )

  useEffect(() => {
    if (status?.collectInProgress) setPollCollect(true)
    else if (!collecting) setPollCollect(false)
  }, [status?.collectInProgress, collecting])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [actorsRes, adsRes] = await Promise.all([
        fetch('/api/monitoramento/actors', { cache: 'no-store' }),
        fetch(`/api/meta-ads/mentions?politico=all&days=${days}&limit=${FETCH_LIMIT}`, {
          cache: 'no-store',
        }),
        refreshStatus(),
      ])

      const actorsJson = (await actorsRes.json()) as ActorsPayload
      const adsJson = (await adsRes.json()) as MentionsPayload

      if (actorsRes.ok) {
        setSetupRequired(Boolean(actorsJson.setupRequired))
        setActors(actorsJson.actors ?? [])
      } else if (actorsJson.setupRequired) {
        setSetupRequired(true)
      }

      if (!adsRes.ok) {
        if (adsJson.setupRequired) {
          setSetupRequired(true)
          setAds([])
        } else {
          throw new Error(adsJson.error || 'Falha ao carregar anúncios Meta')
        }
      } else {
        setSetupRequired(Boolean(adsJson.setupRequired))
        setAds(adsJson.ads ?? [])
      }

      setLastUpdatedAt(new Date())
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erro ao carregar anúncios')
      setAds([])
    } finally {
      setLoading(false)
    }
  }, [days, refreshStatus])

  useEffect(() => {
    void load()
  }, [load])

  const coletar = useCallback(async (opts?: { geoOnly?: boolean }) => {
    const geoOnly = Boolean(opts?.geoOnly)
    setCollecting(true)
    setCollectMessage('')
    setCollectError(null)
    try {
      const res = await fetch('/api/meta-ads/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          geoOnly
            ? { politicoSlug: OWN_CANDIDATE_SLUG, geoOnly: true }
            : {},
        ),
      })
      const json = (await res.json()) as {
        error?: string
        totals?: { adsFound: number; adsInserted: number; adsUpdated: number }
      }
      if (!res.ok) throw new Error(json.error ?? 'Falha na coleta Meta Ads')
      const t = json.totals
      setCollectMessage(
        t
          ? geoOnly
            ? `Localização: ${t.adsUpdated} anúncio(s) atualizado(s) · ${t.adsFound} processado(s)`
            : `Coleta concluída: ${t.adsFound} anúncios · ${t.adsInserted} novos · ${t.adsUpdated} atualizados`
          : geoOnly
            ? 'Captura de localização concluída.'
            : 'Coleta concluída.',
      )
    } catch (err) {
      setCollectError(
        summarizeCollectError(err instanceof Error ? err.message : 'Erro na coleta'),
      )
    } finally {
      setCollecting(false)
      await refreshStatus()
      await load()
    }
  }, [load, refreshStatus])

  const ownCandidate = useMemo(
    () => actors.find((a) => a.slug === OWN_CANDIDATE_SLUG) ?? actors.find((a) => a.actor_type === 'own_candidate'),
    [actors],
  )
  const ownName = ownCandidate?.name ?? 'Jadyel Alencar'

  const compareRows = useMemo(
    () => buildWarRoomAnunciosCompareRows(actors, ads),
    [actors, ads],
  )
  const competitorRows = useMemo(
    () => buildWarRoomAnunciosCompetitorRows(compareRows),
    [compareRows],
  )

  const ownAds = useMemo(() => filterOwnCandidateAds(ads), [ads])
  const ownActiveAds = useMemo(() => filterActiveAds(ownAds), [ownAds])
  const ownAdsPendingGeo = useMemo(
    () =>
      ownActiveAds.filter(
        (ad) =>
          !(
            Boolean(ad.target_locations_text?.trim()) ||
            (Array.isArray(ad.target_locations) && ad.target_locations.length > 0)
          ),
      ).length,
    [ownActiveAds],
  )
  const adRows = useMemo(() => buildWarRoomAnuncioListRows(ownAds, true), [ownAds])
  const totals = useMemo(() => buildOwnAnunciosTotals(ownActiveAds), [ownActiveAds])
  const locationRows = useMemo(
    () => buildWarRoomAnunciosLocationRows(ownActiveAds),
    [ownActiveAds],
  )
  const geoPct = useMemo(() => geoCoveragePct(ownActiveAds), [ownActiveAds])

  const totalActiveCount = useMemo(
    () => compareRows.reduce((sum, row) => sum + row.activeCount, 0),
    [compareRows],
  )
  const ownCompetitor = competitorRows.find((row) => row.isOwn)
  const isActiveLeader = Boolean(ownCompetitor?.isLeader && ownCompetitor.activeCount > 0)

  const score = useMemo(
    () =>
      computeWarRoomAnunciosScore({
        ownActiveCount: ownActiveAds.length,
        totalActiveCount,
        geoCoveragePct: geoPct,
        isActiveLeader,
      }),
    [geoPct, isActiveLeader, ownActiveAds.length, totalActiveCount],
  )

  const collectInProgress = collecting || Boolean(status?.collectInProgress)
  const canCollect = status?.canCollect ?? true
  const runnerAvailable = status?.runnerAvailable !== false
  const dailyLimitEnabled = status?.dailyLimitEnabled ?? true
  const collectDisabled =
    collectInProgress ||
    setupRequired ||
    !runnerAvailable ||
    (dailyLimitEnabled && !canCollect && !collecting)
  const geoCollectDisabled =
    collectInProgress || setupRequired || !runnerAvailable || ownAdsPendingGeo === 0

  if (loading && ads.length === 0) {
    return (
      <div className="wr-copiloto-view__state">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--wr-accent,#F04B23)]" strokeWidth={1.5} />
        <span>Carregando Anúncios…</span>
      </div>
    )
  }

  return (
    <div className="wr-copiloto-anuncios wr-copiloto-reveal">
      <header
        className="wr-copiloto-anuncios__toolbar wr-copiloto-reveal__card"
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
              aria-pressed={period === opt.value}
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </nav>

        <div className="wr-copiloto-anuncios__toolbar-actions">
          <p className="wr-copiloto-redes__last-update">
            <span className="wr-copiloto-redes__last-update-label">Última atualização:</span>{' '}
            <span className="wr-copiloto-redes__last-update-value">
              {lastUpdatedAt ? formatLastUpdateLabel(lastUpdatedAt) : '—'}
            </span>
          </p>
          <Link
            href="/dashboard/noticias/monitoramento?tab=meta-ads"
            className="wr-copiloto-redes__ghost-btn"
          >
            <Megaphone size={14} strokeWidth={2} aria-hidden />
            Monitoramento
          </Link>
          <button
            type="button"
            className="wr-copiloto-redes__ghost-btn"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={14} strokeWidth={2} aria-hidden className={loading ? 'animate-spin' : undefined} />
            Atualizar
          </button>
          <button
            type="button"
            className="wr-copiloto-redes__ghost-btn"
            onClick={() => void coletar({ geoOnly: true })}
            disabled={geoCollectDisabled}
            title={
              ownAdsPendingGeo > 0
                ? `Capturar localização dos ${ownAdsPendingGeo} anúncio(s) sem geo`
                : 'Todos os anúncios ativos já têm localização'
            }
          >
            {collectInProgress ? (
              <Loader2 size={14} strokeWidth={2} className="animate-spin" aria-hidden />
            ) : (
              <MapPin size={14} strokeWidth={2} aria-hidden />
            )}
            Capturar localização
            {ownAdsPendingGeo > 0 ? ` (${ownAdsPendingGeo})` : ''}
          </button>
          <button
            type="button"
            className="wr-copiloto-redes__chip wr-copiloto-redes__chip--primary"
            onClick={() => void coletar()}
            disabled={collectDisabled}
          >
            {collectInProgress ? (
              <Loader2 size={14} strokeWidth={2} className="animate-spin" aria-hidden />
            ) : (
              <RefreshCw size={14} strokeWidth={2} aria-hidden />
            )}
            Coletar biblioteca
          </button>
        </div>
      </header>

      <div className="wr-copiloto-anuncios__body">
        {setupRequired ? (
          <p className="wr-copiloto-anuncios__hint">
            Execute <code>database/create-meta-ads-radar-tables.sql</code> no Supabase para habilitar
            anúncios Meta.
          </p>
        ) : null}

        {loadError ? <p className="wr-copiloto-anuncios__error">{loadError}</p> : null}

        {collectError ? <p className="wr-copiloto-anuncios__error">{collectError}</p> : null}

        {collectMessage ? (
          <p className="wr-copiloto-anuncios__hint" role="status">
            {collectMessage}
          </p>
        ) : null}

        <MetaAdsCollectProgressBar progress={progress} collecting={collectInProgress} />

        {!setupRequired && !loadError ? (
          <WarRoomAnunciosHud
            periodLabel={periodLabel}
            ownName={ownName}
            score={score}
            totals={totals}
            ownActiveCount={ownActiveAds.length}
            geoCoveragePct={geoPct}
            competitorRows={competitorRows}
            locationRows={locationRows}
            adRows={adRows}
            isActiveLeader={isActiveLeader}
          />
        ) : null}
      </div>
    </div>
  )
}
