'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IconExternalLink, IconLoader2 } from '@tabler/icons-react'
import { OWN_CANDIDATE_SLUG } from '@/lib/instagram-radar-own-sync'
import { buildMetaAdsPeriodTotals } from '@/lib/meta-ads-aggregate'
import type { MetaAdsMentionWithActor } from '@/lib/meta-ads-types'
import { cn } from '@/lib/utils'

const ADS_LOOKBACK_DAYS = 30
const ADS_FETCH_LIMIT = 400
const HEADLINE_MAX = 72

type MentionsApiPayload = {
  error?: string
  ads?: MetaAdsMentionWithActor[]
}

function formatAdStarted(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** Preferência: texto do anúncio (ad_body); página quase sempre é só o nome do político. */
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

function formatImpressions(ad: MetaAdsMentionWithActor): string {
  return ad.impressions_text?.trim() || '—'
}

type Props = {
  className?: string
}

/** Anúncios Meta ativos do candidato próprio (Jadyel) — mesma fonte da guia Anúncios. */
export function WarRoomCopilotoJadyelAnuncios({ className }: Props) {
  const [ads, setAds] = useState<MetaAdsMentionWithActor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (loading) {
    return (
      <p className={cn('wr-copiloto-redes__empty wr-copiloto-redes__empty--inline', className)}>
        <IconLoader2
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

  if (activeAds.length === 0) {
    return (
      <p className={cn('wr-copiloto-redes__empty', className)}>
        Nenhum anúncio ativo do Jadyel nos últimos {ADS_LOOKBACK_DAYS} dias.
      </p>
    )
  }

  return (
    <div className={cn('wr-copiloto-redes__themes-panel wr-copiloto-redes-anuncios', className)}>
      <div className="wr-copiloto-redes__table-scroll">
        <table className="wr-copiloto-redes__table wr-copiloto-redes__table--anuncios">
          <thead>
            <tr>
              <th>Anúncio</th>
              <th className="wr-copiloto-redes__num">Início</th>
              <th className="wr-copiloto-redes__num">Impr.</th>
            </tr>
          </thead>
          <tbody>
            {activeAds.map((ad) => {
              const { short, full } = adHeadline(ad)
              const impressions = formatImpressions(ad)
              const cell = (
                <span className="wr-copiloto-redes__cell-truncate" title={full}>
                  {short}
                </span>
              )
              return (
                <tr key={ad.id}>
                  <td className="wr-copiloto-redes__cell-anuncio">
                    {ad.library_url ? (
                      <a
                        href={ad.library_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wr-copiloto-redes__cell-link wr-copiloto-redes__cell-anuncio-link"
                        title={full}
                      >
                        {cell}
                        <IconExternalLink
                          className="wr-copiloto-redes__cell-anuncio-ext"
                          stroke={1.75}
                          aria-hidden
                        />
                        <span className="sr-only">Abrir na biblioteca Meta</span>
                      </a>
                    ) : (
                      cell
                    )}
                  </td>
                  <td className="wr-copiloto-redes__num tabular-nums">
                    {formatAdStarted(ad.started_running_at)}
                  </td>
                  <td
                    className="wr-copiloto-redes__num wr-copiloto-redes__cell-compact tabular-nums"
                    title={impressions}
                  >
                    {impressions}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>
                <span className="tabular-nums">{activeAds.length} ativos</span>
                <Link
                  href="/dashboard/noticias/monitoramento?tab=meta-ads"
                  className="wr-copiloto-redes-anuncios__footer-inline"
                >
                  Abrir Anúncios Meta
                </Link>
              </td>
              <td className="wr-copiloto-redes__num" />
              <td
                className="wr-copiloto-redes__num wr-copiloto-redes__cell-compact tabular-nums"
                title={totals.impressionsLabel ?? undefined}
              >
                {totals.impressionsLabel ?? '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
