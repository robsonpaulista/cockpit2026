'use client'

import { ImageIcon, Layers, Loader2, Star, Video } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import '@/app/dashboard/war-room/radar-competitivo-ios.css'
import {
  buildRadarCompetitivoModel,
  formatCompact,
  type RadarCompetitivoCandidate,
  type RadarCommenterStatsInput,
  type RadarFormatKey,
} from '@/lib/war-room/radar-competitivo-model'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

const MAX_SELECT = 5

type Props = {
  actors: PoliticalActorWithTerms[]
  posts: InstagramRadarPostWithActor[]
  commenterStats?: RadarCommenterStatsInput[]
  days: number
  periodLabel: string
  loading?: boolean
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase()
}

function Avatar({
  name,
  url,
  className,
  fallbackClassName,
}: {
  name: string
  url: string | null
  className: string
  fallbackClassName: string
}) {
  if (url) {
    return <img src={url} alt="" className={className} />
  }
  return (
    <span className={cn(className, fallbackClassName)} aria-hidden>
      {initials(name)}
    </span>
  )
}

function postCaptionPreview(caption: string | null): string {
  if (!caption) return 'Sem legenda'
  return caption.replace(/\s+/g, ' ').trim()
}

function igHandle(username: string | null): string | null {
  if (!username) return null
  const u = username.replace(/^@/, '').trim()
  return u ? `@${u}` : null
}

function PresentationStage({ children }: { children: ReactNode }) {
  return <div className="rc-ios-stage">{children}</div>
}

const MIX_PILL_COUNT = 16

type MixKey = 'image' | 'reels' | 'carousel'

function mixPillKinds(
  mix: { image: number; reels: number; carousel: number },
  n = MIX_PILL_COUNT,
): MixKey[] {
  const sum = Math.max(1, mix.image + mix.reels + mix.carousel)
  const raw: Array<{ k: MixKey; v: number }> = [
    { k: 'image', v: (mix.image / sum) * n },
    { k: 'reels', v: (mix.reels / sum) * n },
    { k: 'carousel', v: (mix.carousel / sum) * n },
  ]
  const counts: Record<MixKey, number> = {
    image: Math.floor(raw[0]!.v),
    reels: Math.floor(raw[1]!.v),
    carousel: Math.floor(raw[2]!.v),
  }
  let left = n - counts.image - counts.reels - counts.carousel
  for (const item of [...raw].sort((a, b) => (b.v % 1) - (a.v % 1))) {
    if (left <= 0) break
    counts[item.k] += 1
    left -= 1
  }
  return [
    ...Array<MixKey>(counts.image).fill('image'),
    ...Array<MixKey>(counts.reels).fill('reels'),
    ...Array<MixKey>(counts.carousel).fill('carousel'),
  ]
}

function MixPills({
  mix,
  label,
}: {
  mix: { image: number; reels: number; carousel: number }
  label: string
}) {
  return (
    <div className="rc-ios-pills rc-ios-dna__pills" aria-label={label}>
      {mixPillKinds(mix).map((kind, i) => (
        <i key={`${kind}-${i}`} className={`rc-ios-pills__tick rc-ios-pills__tick--${kind}`} />
      ))}
    </div>
  )
}

function SharePills({ pct }: { pct: number }) {
  const on = Math.round((Math.min(100, Math.max(0, pct)) / 100) * MIX_PILL_COUNT)
  return (
    <div className="rc-ios-pills" aria-hidden>
      {Array.from({ length: MIX_PILL_COUNT }, (_, i) => (
        <i key={i} className={cn('rc-ios-pills__tick', i < on && 'rc-ios-pills__tick--on')} />
      ))}
    </div>
  )
}

type FormatRankEntry = {
  candidate: RadarCompetitivoCandidate
  avg: number
  rank: number
}

function isHomeCandidate(c: RadarCompetitivoCandidate): boolean {
  return /jadyel/i.test(`${c.slug} ${c.name}`)
}

function rankByFormat(
  candidates: RadarCompetitivoCandidate[],
  format: RadarFormatKey,
): FormatRankEntry[] {
  return [...candidates]
    .map((candidate) => ({
      candidate,
      avg: candidate.formatPerf[format].avgEngagement,
    }))
    .sort((a, b) => b.avg - a.avg || a.candidate.rank - b.candidate.rank)
    .map((row, i) => ({ ...row, rank: i + 1 }))
}

function homeBestFormat(ours: RadarCompetitivoCandidate | undefined): RadarFormatKey | null {
  if (!ours) return null
  const scores: Array<{ k: RadarFormatKey; v: number }> = [
    { k: 'image', v: ours.formatPerf.image.avgEngagement },
    { k: 'reels', v: ours.formatPerf.reels.avgEngagement },
    { k: 'carousel', v: ours.formatPerf.carousel.avgEngagement },
  ]
  const max = Math.max(...scores.map((s) => s.v))
  if (max <= 0) return null
  return scores.find((s) => s.v === max)?.k ?? null
}

function FormatListCard({
  format,
  icon,
  title,
  ranked,
  ours,
  isBestFormat,
}: {
  format: RadarFormatKey
  icon: ReactNode
  title: string
  ranked: FormatRankEntry[]
  ours: RadarCompetitivoCandidate | undefined
  isBestFormat: boolean
}) {
  const rows = ranked
  const max = Math.max(...rows.map((r) => r.avg), 1)
  const ourEntry = ours ? ranked.find((r) => r.candidate.slug === ours.slug) : undefined
  const first = ranked[0]
  const second = ranked[1]
  const third = ranked[2]
  const gapToTop3 =
    ourEntry && ourEntry.rank > 3 && third
      ? Math.max(0, Math.round(third.avg - ourEntry.avg))
      : null
  const leadPct =
    isBestFormat && ourEntry?.rank === 1 && first && second && second.avg > 0
      ? Math.round(((first.avg - second.avg) / second.avg) * 100)
      : null

  return (
    <article className={`rc-ios-dominio-card rc-ios-dominio-card--${format}`}>
      <header className="rc-ios-dominio-card__head">
        <span className="rc-ios-dominio-card__icon">{icon}</span>
        <div className="rc-ios-dominio-card__titles">
          <h4 className="rc-ios-dominio-card__title">{title}</h4>
          <p className="rc-ios-dominio-card__sub">Ranking no período</p>
        </div>
      </header>
      <ul className="rc-ios-dominio-list">
        {rows.map((row) => {
          const pct = max > 0 ? Math.min(100, Math.round((row.avg / max) * 100)) : 0
          const isOurs = ours?.slug === row.candidate.slug
          const showGap = Boolean(isOurs && gapToTop3 != null)
          return (
            <li key={row.candidate.slug} className="rc-ios-dominio-list__row">
              {row.rank === 1 ? null : (
                <span className="rc-ios-champ__badge">{String(row.rank).padStart(2, '0')}</span>
              )}
              <div className="rc-ios-dominio-list__meta">
                <span className="rc-ios-dominio-list__name">
                  <span className="rc-ios-dominio-list__name-text">{row.candidate.name}</span>
                  {row.rank === 1 ? (
                    <span className="rc-ios-champ__badge rc-ios-champ__badge--top">TOP</span>
                  ) : null}
                </span>
                <span className="rc-ios-dominio-list__bar" aria-hidden>
                  <i style={{ width: `${Math.max(pct, row.avg > 0 ? 8 : 0)}%` }} />
                </span>
                {showGap ? (
                  <span className="rc-ios-dominio-chase__gap">
                    -{formatCompact(gapToTop3!)} para o TOP 3
                  </span>
                ) : null}
              </div>
              <strong className="rc-ios-dominio-list__val tabular-nums">
                {row.avg > 0 ? formatCompact(row.avg) : '—'}
              </strong>
            </li>
          )
        })}
      </ul>
      {leadPct != null ? (
        <p className="rc-ios-dominio-banner">
          <Star size={11} fill="currentColor" strokeWidth={0} aria-hidden />
          <span>
            Esse é o nosso melhor formato!
            <strong> +{leadPct}% sobre o 2º colocado.</strong>
          </span>
        </p>
      ) : null}
    </article>
  )
}

export function RadarCompetitivoBoard({
  actors,
  posts,
  commenterStats = [],
  days,
  periodLabel,
  loading = false,
}: Props) {
  const model = useMemo(
    () => buildRadarCompetitivoModel({ actors, posts, days, commenterStats }),
    [actors, posts, days, commenterStats],
  )

  const [selected, setSelected] = useState<string[]>([])

  const toggle = (slug: string) => {
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug)
      if (prev.length >= MAX_SELECT) return prev
      return [...prev, slug]
    })
  }

  const hasSelection = selected.length > 0
  const compareReady = selected.length >= 2 && selected.length <= MAX_SELECT

  const maxes = useMemo(() => {
    const cs = model.candidates
    return {
      eng: Math.max(...cs.map((c) => c.avgEngagement), 1),
    }
  }, [model.candidates])

  const formatDomain = useMemo(() => {
    const ours = model.candidates.find(isHomeCandidate)
    return {
      ours,
      best: homeBestFormat(ours),
      image: rankByFormat(model.candidates, 'image'),
      reels: rankByFormat(model.candidates, 'reels'),
      carousel: rankByFormat(model.candidates, 'carousel'),
    }
  }, [model.candidates])

  if (loading && model.empty) {
    return (
      <div className="rc-ios rc-ios-empty">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--rc-accent)' }} />
        <span style={{ marginTop: 8 }}>Carregando Radar Competitivo…</span>
      </div>
    )
  }

  if (model.empty) {
    return (
      <div className="rc-ios rc-ios-empty">
        Sem dados de candidatos no período ({periodLabel}).
      </div>
    )
  }

  return (
    <div className="rc-ios rc-ios--game" style={{ width: '100%', height: '100%', minHeight: 0 }}>
      <PresentationStage>
        <div className="rc-ios-board" role="region" aria-label="Radar Competitivo">
          <div className="rc-ios-main">
            <section className="rc-ios-panel rc-ios-champs" aria-label="Visão geral competitiva">
              <div className="rc-ios-panel__head">
                <div className="rc-ios-panel__heading">
                  <h3 className="rc-ios-panel__title">Elenco competitivo</h3>
                  <p className="rc-ios-panel__metric-label">
                    Engajamento médio por post (curtidas + comentários)
                  </p>
                </div>
                <div className="rc-ios-panel__head-actions">
                  <p className="rc-ios-panel__hint">
                    {model.candidates.length} perfis · {periodLabel} · toque para selecionar
                  </p>
                  <button
                    type="button"
                    className={cn(
                      'rc-ios-compare-cta',
                      compareReady && 'rc-ios-compare-cta--visible',
                    )}
                    disabled={!compareReady}
                  >
                    Comparar ({selected.length})
                  </button>
                </div>
              </div>
              <div className="rc-ios-champs__strip">
                {model.candidates.map((c) => {
                  const isOn = selected.includes(c.slug)
                  const share = maxes.eng > 0 ? (c.avgEngagement / maxes.eng) * 100 : 0
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      className={cn(
                        'rc-ios-champ',
                        c.rank === 1 && 'rc-ios-champ--lead',
                        hasSelection && !isOn && 'rc-ios-champ--dim',
                        isOn && 'rc-ios-champ--selected',
                      )}
                      onClick={() => toggle(c.slug)}
                      aria-pressed={isOn}
                    >
                      <span className={cn('rc-ios-champ__badge', c.rank === 1 && 'rc-ios-champ__badge--top')}>
                        {c.rank === 1 ? 'TOP' : String(c.rank).padStart(2, '0')}
                      </span>
                      <Avatar
                        name={c.name}
                        url={c.avatarUrl}
                        className="rc-ios-champ__avatar"
                        fallbackClassName="rc-ios-champ__avatar--fb"
                      />
                      <p className="rc-ios-champ__name">{c.name}</p>
                      <p className="rc-ios-champ__stat">{formatCompact(c.avgEngagement)}</p>
                      <SharePills pct={share} />
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="rc-ios-panel rc-ios-dna" aria-label="DNA do conteúdo">
              <div className="rc-ios-panel__head">
                <div className="rc-ios-panel__heading">
                  <h3 className="rc-ios-panel__title">DNA do conteúdo</h3>
                  <p className="rc-ios-panel__metric-label">
                    Mix de formatos no período (imagem · reels · carrossel)
                  </p>
                </div>
                <div className="rc-ios-dna__legend">
                  <span>
                    <i style={{ background: 'var(--rc-mix-image)' }} />
                    Imagem
                  </span>
                  <span>
                    <i style={{ background: 'var(--rc-mix-reels)' }} />
                    Reels
                  </span>
                  <span>
                    <i style={{ background: 'var(--rc-mix-carousel)' }} />
                    Carrossel
                  </span>
                </div>
              </div>
              <div className="rc-ios-dna__grid">
                {model.candidates.map((c) => {
                  const mix = c.contentMix
                  return (
                    <article
                      key={c.slug}
                      className={cn(
                        'rc-ios-dna-tile',
                        hasSelection && !selected.includes(c.slug) && 'rc-ios-dna-tile--dim',
                      )}
                    >
                      <header className="rc-ios-dna-tile__head">
                        <p className="rc-ios-dna-tile__name" title={c.name}>
                          {c.name}
                        </p>
                      </header>
                      <MixPills
                        mix={mix}
                        label={`${c.name}: imagem ${mix.image}%, reels ${mix.reels}%, carrossel ${mix.carousel}%`}
                      />
                      <p className="rc-ios-dna-tile__pcts" aria-hidden>
                        <span style={{ color: 'var(--rc-mix-image)' }}>{mix.image}%</span>
                        <span style={{ color: 'var(--rc-mix-reels)' }}>{mix.reels}%</span>
                        <span style={{ color: 'var(--rc-mix-carousel)' }}>{mix.carousel}%</span>
                      </p>
                    </article>
                  )
                })}
              </div>
            </section>

            <div className="rc-ios-split">
            <section
              className="rc-ios-panel rc-ios-fperf"
              aria-label="Performance por formato"
            >
              <div className="rc-ios-panel__head">
                <div className="rc-ios-panel__heading">
                  <h3 className="rc-ios-panel__title">Performance por formato</h3>
                  <p className="rc-ios-panel__metric-label">
                    Quem performa melhor em cada tipo de conteúdo
                  </p>
                </div>
              </div>
              <div className="rc-ios-dominio">
                <FormatListCard
                  format="reels"
                  title="Reels"
                  icon={<Video size={13} strokeWidth={2.2} aria-hidden />}
                  ranked={formatDomain.reels}
                  ours={formatDomain.ours}
                  isBestFormat={formatDomain.best === 'reels'}
                />
                <FormatListCard
                  format="image"
                  title="Imagem"
                  icon={<ImageIcon size={13} strokeWidth={2.2} aria-hidden />}
                  ranked={formatDomain.image}
                  ours={formatDomain.ours}
                  isBestFormat={formatDomain.best === 'image'}
                />
                <FormatListCard
                  format="carousel"
                  title="Carrossel"
                  icon={<Layers size={13} strokeWidth={2.2} aria-hidden />}
                  ranked={formatDomain.carousel}
                  ours={formatDomain.ours}
                  isBestFormat={formatDomain.best === 'carousel'}
                />
              </div>
            </section>

            <section className="rc-ios-panel rc-ios-tops" aria-label="Top conteúdos">
              <div className="rc-ios-panel__head">
                <div className="rc-ios-panel__heading">
                  <h3 className="rc-ios-panel__title">Top conteúdos do universo</h3>
                  <p className="rc-ios-panel__metric-label">
                    Melhor post de cada perfil no período
                  </p>
                </div>
              </div>
              <ul className="rc-ios-tops__list">
                {model.topPosts.length === 0 ? (
                  <li className="rc-ios-tops__empty">Sem posts no período.</li>
                ) : (
                  model.topPosts.map((p) => {
                    const handle = igHandle(p.username)
                    const caption = postCaptionPreview(p.caption)
                    return (
                      <li key={p.id}>
                        <a
                          className={cn('rc-ios-tops__row', p.rank === 1 && 'rc-ios-tops__row--lead')}
                          href={p.postUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {p.rank === 1 ? null : (
                            <span className="rc-ios-champ__badge">
                              {String(p.rank).padStart(2, '0')}
                            </span>
                          )}
                          <div className="rc-ios-tops__head">
                            <p className="rc-ios-tops__name">
                              <span className="rc-ios-tops__name-text">{p.name}</span>
                              {handle ? <span className="rc-ios-tops__handle">{handle}</span> : null}
                              {p.rank === 1 ? (
                                <span className="rc-ios-champ__badge rc-ios-champ__badge--top">TOP</span>
                              ) : null}
                            </p>
                            <p className="rc-ios-tops__caption">{caption}</p>
                          </div>
                          <strong
                            className="rc-ios-tops__val tabular-nums"
                            title={`${formatCompact(p.engagement)} (curtidas + comentários)`}
                          >
                            {formatCompact(p.engagement)}
                          </strong>
                        </a>
                      </li>
                    )
                  })
                )}
              </ul>
            </section>
            </div>
          </div>
        </div>
      </PresentationStage>
    </div>
  )
}
