'use client'

import { ExternalLink, Loader2, Megaphone } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

import { OWN_CANDIDATE_SLUG } from '@/lib/instagram-radar-own-sync'
import { buildMetaAdsPeriodTotals } from '@/lib/meta-ads-aggregate'
import { parseMetricRange } from '@/lib/meta-ads-format'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import { formatDataCurta } from '@/lib/war-room/redes-copiloto'
import { cn } from '@/lib/utils'

const ADS_LOOKBACK_DAYS = 30
const ADS_FETCH_LIMIT = 400
const HEADLINE_MAX = 48
const LIST_PREVIEW = 5

type MentionsApiPayload = {
  error?: string
  ads?: MetaAdsMentionWithActor[]
}

function adHeadline(ad: MetaAdsMentionWithActor): { short: string; full: string } {
  const body = ad.ad_body?.replace(/\s+/g, ' ').trim() ?? ''
  if (body) {
    const firstChunk = body.split(/(?<=[.!?])\s+/)[0]?.trim() || body
    const short =
      firstChunk.length > HEADLINE_MAX
        ? `${firstChunk.slice(0, HEADLINE_MAX).trimEnd()}…`
        : firstChunk
    return { short, full: body }
  }
  const fallback =
    ad.page_name?.trim() ||
    (ad.library_ad_id ? `Anúncio ${ad.library_ad_id}` : 'Anúncio sem texto')
  return { short: fallback, full: fallback }
}

function impressionMid(ad: MetaAdsMentionWithActor): number {
  const parsed = parseMetricRange(ad.impressions_text)
  const lo = parsed.min ?? parsed.max
  const hi = parsed.max ?? parsed.min
  if (lo == null && hi == null) return 0
  if (lo != null && hi != null) return (lo + hi) / 2
  return lo ?? hi ?? 0
}

function formatImpressionsLabel(ad: MetaAdsMentionWithActor): string {
  return ad.impressions_text?.trim() || '—'
}

type AdListRow = {
  ad: MetaAdsMentionWithActor
  short: string
  full: string
  startedLabel: string
  impressionsLabel: string
  mid: number
  sharePct: number | null
}

type Props = {
  className?: string
}

/** Anúncios Meta ativos do candidato próprio (Jadyel) — lista com participação relativa. */
export function WarRoomCopilotoJadyelAnuncios({ className }: Props) {
  const [ads, setAds] = useState<MetaAdsMentionWithActor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/meta-ads/mentions?politico=${OWN_CANDIDATE_SLUG}&days=${ADS_LOOKBACK_DAYS}&limit=${ADS_FETCH_LIMIT}`,
        { cache: 'no-store' },
      )
      const json = (await res.json()) as MentionsApiPayload
      if (!res.ok) throw new Error(json.error || 'Falha ao carregar anúncios')
      setAds(json.ads ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar anúncios')
      setAds([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const activeAds = useMemo(
    () =>
      ads
        .filter((ad) => ad.is_active === true)
        .sort((a, b) => {
          const da = a.started_running_at ?? ''
          const db = b.started_running_at ?? ''
          return db.localeCompare(da)
        }),
    [ads],
  )

  const totals = useMemo(() => buildMetaAdsPeriodTotals(activeAds), [activeAds])

  const rows = useMemo((): AdListRow[] => {
    const mids = activeAds.map(impressionMid)
    const totalMid = mids.reduce((sum, n) => sum + n, 0)
    return activeAds.map((ad, i) => {
      const { short, full } = adHeadline(ad)
      const mid = mids[i] ?? 0
      return {
        ad,
        short,
        full,
        startedLabel: ad.started_running_at
          ? formatDataCurta(ad.started_running_at)
          : '—',
        impressionsLabel: formatImpressionsLabel(ad),
        mid,
        sharePct: totalMid > 0 && mid > 0 ? Math.round((mid / totalMid) * 100) : null,
      }
    })
  }, [activeAds])

  const visibleRows = expanded ? rows : rows.slice(0, LIST_PREVIEW)
  const hasMore = rows.length > LIST_PREVIEW

  if (loading) {
    return (
      <p className={cn('wr-copiloto-redes__empty wr-copiloto-redes__empty--inline', className)}>
        <Loader2
          className="h-4 w-4 animate-spin text-[var(--wr-accent,#F04B23)]"
          aria-hidden
        />
        Carregando anúncios…
      </p>
    )
  }

  if (error) {
    return <p className={cn('wr-copiloto-redes__empty', className)}>{error}</p>
  }

  if (rows.length === 0) {
    return (
      <p className={cn('wr-copiloto-redes__empty', className)}>
        Nenhum anúncio ativo do Jadyel nos últimos {ADS_LOOKBACK_DAYS} dias.
      </p>
    )
  }

  return (
    <div className={cn('wr-copiloto-list-card wr-copiloto-list-card--dense wr-copiloto-redes-anuncios', className)}>
      <ul className="wr-copiloto-list-card__list" aria-label="Anúncios ativos">
        {visibleRows.map((row) => {
          const barPct = row.sharePct ?? 0
          const body = (
            <>
              <span className="wr-copiloto-list-card__thumb wr-copiloto-list-card__thumb--icon" aria-hidden>
                <Megaphone className="h-3.5 w-3.5" strokeWidth={1.5} />
              </span>
              <span className="wr-copiloto-list-card__main">
                <span className="wr-copiloto-list-card__title" title={row.full}>
                  {row.short}
                  {row.ad.library_url ? (
                    <ExternalLink
                      className="wr-copiloto-list-card__ext"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  ) : null}
                </span>
                <span className="wr-copiloto-list-card__sub">
                  Início {row.startedLabel}
                </span>
              </span>
              <span className="wr-copiloto-list-card__metrics">
                <span className="wr-copiloto-list-card__metric-primary tabular-nums">
                  {row.impressionsLabel}
                  {row.sharePct != null ? (
                    <span className="wr-copiloto-list-card__metric-unit">
                      {' '}
                      · {row.sharePct}%
                    </span>
                  ) : null}
                </span>
                <span
                  className="wr-copiloto-list-card__bar"
                  role="presentation"
                  aria-hidden
                >
                  <span
                    className="wr-copiloto-list-card__bar-fill"
                    style={{ width: `${Math.min(100, Math.max(0, barPct))}%` }}
                  />
                </span>
              </span>
            </>
          )

          return (
            <li key={row.ad.id} className="wr-copiloto-list-card__row">
              {row.ad.library_url ? (
                <a
                  href={row.ad.library_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="wr-copiloto-list-card__row-inner wr-copiloto-list-card__row-inner--link"
                >
                  {body}
                  <span className="sr-only">Abrir na biblioteca Meta</span>
                </a>
              ) : (
                <div className="wr-copiloto-list-card__row-inner">{body}</div>
              )}
            </li>
          )
        })}
      </ul>

      {hasMore ? (
        <button
          type="button"
          className="wr-copiloto-list-card__more"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Ver menos' : 'Ver todos os anúncios'}
        </button>
      ) : null}

      <div className="wr-copiloto-list-card__footer">
        <span className="tabular-nums">
          {activeAds.length} ativo{activeAds.length === 1 ? '' : 's'}
          {totals.impressionsLabel ? ` · ${totals.impressionsLabel}` : ''}
        </span>
        <Link
          href="/dashboard/noticias/monitoramento?tab=meta-ads"
          className="wr-copiloto-list-card__footer-link"
        >
          Ver todos os anúncios →
        </Link>
      </div>
    </div>
  )
}
