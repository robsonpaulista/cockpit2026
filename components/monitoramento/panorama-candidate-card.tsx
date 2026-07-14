'use client'

import Link from 'next/link'
import { ExternalLink, Megaphone, Newspaper, TrendingDown, TrendingUp, Youtube } from 'lucide-react'
import { TrendsSearchContextBlock } from '@/components/trends-radar/trends-search-context-block'
import type { PanoramaCandidateColumn, PanoramaHighlight } from '@/lib/monitoramento-panorama'
import { PANORAMA_WINDOW_DAYS } from '@/lib/monitoramento-panorama-window'
import type { GoogleTrendsInterestPoint } from '@/lib/google-trends-types'
import { googleTrendsTimeframeLabel, PANORAMA_GOOGLE_TRENDS_TIMEFRAME } from '@/lib/google-trends-timeframe'
import { cn } from '@/lib/utils'

function formatInt(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function highlightRing(h: PanoramaHighlight): string {
  if (h === 'best') return 'ring-1 ring-[#3B6D11]/30 bg-[#F4FAF0]'
  if (h === 'worst') return 'ring-1 ring-[#A32D2D]/20 bg-[#FDF6F6]'
  return 'bg-bg-app'
}

function Sparkline({ points, color }: { points: GoogleTrendsInterestPoint[]; color: string }) {
  if (points.length < 2) return null
  const w = 120
  const h = 36
  const scores = points.map((p) => p.score)
  const max = Math.max(...scores, 1)
  const min = Math.min(...scores, 0)
  const range = Math.max(max - min, 1)
  const coords = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w
      const y = h - ((p.score - min) / range) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full max-w-[140px]" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" points={coords} />
    </svg>
  )
}

function MetricChip({
  label,
  value,
  sub,
  highlight = 'none',
}: {
  label: string
  value: string
  sub?: string
  highlight?: PanoramaHighlight
}) {
  return (
    <div className={cn('rounded-lg px-2.5 py-2 text-center', highlightRing(highlight))}>
      <p className="text-[10px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums leading-tight text-text-primary">{value}</p>
      {sub ? <p className="truncate text-[10px] text-text-muted">{sub}</p> : null}
    </div>
  )
}

interface PanoramaCandidateCardProps {
  column: PanoramaCandidateColumn
}

export function PanoramaCandidateCard({ column: col }: PanoramaCandidateCardProps) {
  const growth = col.trends?.weekChangePct ?? null
  const growthUp = (growth ?? 0) > 0
  const growthDown = (growth ?? 0) < 0

  return (
    <article
      className="flex flex-col overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface shadow-sm"
      style={{ borderTopWidth: 4, borderTopColor: col.accentColor }}
    >
      <header className="border-b border-[rgb(var(--color-border-tertiary)/0.5)] px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-text-primary">{col.name}</h3>
            <p className="text-[11px] capitalize text-text-muted">{col.actorTypeLabel}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex justify-end gap-0.5">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn('text-xs', i <= col.digitalScore.stars ? 'text-[#F59E0B]' : 'text-[#D1D5DB]')}
                >
                  ★
                </span>
              ))}
            </div>
            <p className="text-[10px] text-text-muted">{col.digitalScore.label}</p>
          </div>
        </div>
        <p className="mt-2 text-sm leading-snug text-text-secondary">{col.headline}</p>
      </header>

      <div className="grid grid-cols-2 gap-2 border-b border-[rgb(var(--color-border-tertiary)/0.4)] px-3 py-3 sm:grid-cols-4">
        <MetricChip
          label="Trends"
          value={col.trends ? String(col.trends.currentIndex) : '—'}
          sub={col.trends ? col.trends.trendLabel : 'sem coleta'}
          highlight={col.trends?.highlights.currentIndex}
        />
        <MetricChip
          label="Imprensa"
          value={String(col.googleNews?.mentions7d ?? 0)}
          sub={col.googleNews?.topSource ?? `${PANORAMA_WINDOW_DAYS} dias`}
          highlight={col.googleNews?.highlights.mentions7d}
        />
        <MetricChip
          label="Meta Ads"
          value={String(col.metaAds?.activeAds ?? 0)}
          sub={
            col.metaAds?.spendLabel ??
            (col.metaAds?.topPage ? `de ${col.metaAds.topPage}` : 'ativos')
          }
          highlight={col.metaAds?.highlights.activeAds}
        />
        <MetricChip
          label="YouTube"
          value={String(col.youtube?.videos7d ?? 0)}
          sub={`${formatInt(col.youtube?.views7d ?? 0)} views`}
          highlight={col.youtube?.highlights.views7d}
        />
      </div>

      {col.trends && col.trends.points.length >= 2 ? (
        <div className="flex items-center justify-between gap-3 border-b border-[rgb(var(--color-border-tertiary)/0.4)] px-4 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              Curva Trends · {googleTrendsTimeframeLabel(PANORAMA_GOOGLE_TRENDS_TIMEFRAME)}
            </p>
            {col.trends.weekChangePct !== null ? (
              <p
                className={cn(
                  'mt-0.5 inline-flex items-center gap-0.5 text-xs font-medium',
                  growthUp && 'text-[#3B6D11]',
                  growthDown && 'text-[#A32D2D]',
                  !growthUp && !growthDown && 'text-text-muted'
                )}
              >
                {growthDown ? <TrendingDown className="h-3 w-3" /> : null}
                {growthUp ? <TrendingUp className="h-3 w-3" /> : null}
                {growth !== null ? `${growth > 0 ? '+' : ''}${growth}% semana` : null}
              </p>
            ) : null}
          </div>
          <Sparkline points={col.trends.points} color={col.accentColor} />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-3 p-4">
        {col.trends?.searchContext ? (
          <TrendsSearchContextBlock context={col.trends.searchContext} compact />
        ) : null}

        {col.googleNews && col.googleNews.previews.length > 0 ? (
          <section>
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              <Newspaper className="h-3 w-3" aria-hidden />
              Imprensa recente
            </p>
            <ul className="space-y-1.5">
              {col.googleNews.previews.map((n) => (
                <li key={n.url}>
                  <a
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-lg border border-[rgb(var(--color-border-tertiary)/0.45)] px-2.5 py-2 hover:bg-bg-app"
                  >
                    <p className="line-clamp-2 text-xs font-medium text-text-primary group-hover:text-[rgb(var(--color-primary))]">
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-text-muted">
                      {n.source ?? 'Fonte'} · {formatDate(n.publishedAt)}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {col.youtube && col.youtube.previews.length > 0 ? (
          <section>
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              <Youtube className="h-3 w-3" aria-hidden />
              Vídeos em destaque
            </p>
            <ul className="space-y-2">
              {col.youtube.previews.map((v) => (
                <li key={v.url}>
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex gap-2 rounded-lg border border-[rgb(var(--color-border-tertiary)/0.45)] p-2 hover:bg-bg-app"
                  >
                    {v.thumbnailUrl ? (
                      <img
                        src={v.thumbnailUrl}
                        alt=""
                        className="h-12 w-20 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded bg-[#F3F4F6]">
                        <Youtube className="h-5 w-5 text-text-muted" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-xs font-medium text-text-primary">{v.title}</p>
                      <p className="mt-0.5 text-[10px] text-text-muted">
                        {v.channel ?? 'Canal'} · {formatInt(v.views)} views
                      </p>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {col.metaAds && col.metaAds.previews.length > 0 ? (
          <section>
            <p className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              <Megaphone className="h-3 w-3 shrink-0" aria-hidden />
              <span>
                Anúncios Meta ({col.metaAds.activeAds} ativo{col.metaAds.activeAds === 1 ? '' : 's'})
              </span>
              {col.metaAds.spendLabel ? (
                <span className="font-normal normal-case text-text-secondary">
                  · investido {col.metaAds.spendLabel}
                </span>
              ) : null}
            </p>
            <ul className="space-y-1.5">
              {col.metaAds.previews.map((ad) => (
                <li key={ad.url}>
                  <a
                    href={ad.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-lg border border-[rgb(var(--color-border-tertiary)/0.45)] px-2.5 py-2 hover:bg-bg-app"
                  >
                    <div className="flex items-center gap-2">
                      <p className="truncate text-xs font-medium text-text-primary">
                        {ad.pageName ?? 'Página desconhecida'}
                      </p>
                      {ad.isActive ? (
                        <span className="shrink-0 rounded-full bg-[rgb(var(--color-primary-tint))] px-1.5 py-px text-[9px] font-medium text-[rgb(var(--color-primary))]">
                          ativo
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-bg-app px-1.5 py-px text-[9px] text-text-muted">
                          inativo
                        </span>
                      )}
                    </div>
                    {ad.body ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-secondary">
                        {ad.body}
                      </p>
                    ) : null}
                    <p className="mt-1 truncate text-[10px] text-text-muted">
                      Gasto: {ad.spendLabel}
                      {ad.impressionsText ? ` · Imp.: ${ad.impressionsText}` : ''}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!col.trends?.searchContext?.hasData &&
        (col.googleNews?.previews.length ?? 0) === 0 &&
        (col.youtube?.previews.length ?? 0) === 0 &&
        (col.metaAds?.previews.length ?? 0) === 0 ? (
          <p className="text-center text-xs text-text-muted">
            Sem evidências recentes.{' '}
            <Link href="/dashboard/noticias/monitoramento?tab=youtube" className="text-[rgb(var(--color-primary))] hover:underline">
              Coletar dados
            </Link>
          </p>
        ) : null}
      </div>
    </article>
  )
}
