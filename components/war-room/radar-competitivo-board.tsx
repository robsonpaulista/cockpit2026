'use client'

import { Loader2, Star } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import '@/app/dashboard/war-room/radar-competitivo-ios.css'
import {
  buildRadarCompetitivoModel,
  formatCompact,
  type RadarCompetitivoCandidate,
  type RadarCompetitivoModel,
  type RadarCommenterStatsInput,
} from '@/lib/war-room/radar-competitivo-model'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import { proxiedInstagramMediaUrl } from '@/lib/instagram-cdn-proxy'
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

function WinStar({ show }: { show: boolean }) {
  if (!show) return <span className="rc-ios-map__win" aria-hidden />
  return <Star className="rc-ios-map__win" size={10} fill="currentColor" strokeWidth={0} aria-label="Vencedor" />
}

function MetricBar({
  value,
  max,
  color,
  display,
  win,
}: {
  value: number
  max: number
  color: string
  display: string
  win: boolean
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const barColor = win ? '#F04B23' : color
  return (
    <div className="rc-ios-map__cell">
      <div className="rc-ios-bar" aria-hidden>
        <span
          className="rc-ios-bar__fill"
          style={{ width: `${pct}%`, ['--rc-bar-color' as string]: barColor }}
        />
      </div>
      <span className="rc-ios-map__val">{display}</span>
      <WinStar show={win} />
    </div>
  )
}

function TopPostThumb({
  thumbnailUrl,
  name,
}: {
  thumbnailUrl: string | null
  name: string
}) {
  const [broken, setBroken] = useState(false)
  const src = proxiedInstagramMediaUrl(thumbnailUrl)
  const showImg = Boolean(src) && !broken

  useEffect(() => {
    setBroken(false)
  }, [src])

  return (
    <>
      {showImg ? (
        <img
          src={src!}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <div
          className="rc-ios-top__media-fallback"
          style={{ background: 'linear-gradient(160deg, #ececea, #f7f7f6)' }}
          aria-hidden
        >
          <span>{initials(name)}</span>
        </div>
      )}
    </>
  )
}

function PresentationStage({ children }: { children: ReactNode }) {
  return <div className="rc-ios-stage">{children}</div>
}

function FormatPerfCell({
  format,
  avgEngagement,
  count,
  max,
}: {
  format: 'image' | 'reels' | 'carousel'
  avgEngagement: number
  count: number
  max: number
}) {
  const pct = max > 0 ? Math.min(100, Math.round((avgEngagement / max) * 100)) : 0
  const empty = count === 0
  return (
    <div
      className={cn('rc-ios-fperf__cell', empty && 'rc-ios-fperf__cell--empty')}
      title={
        empty
          ? 'Sem posts neste formato'
          : `${formatCompact(avgEngagement)} eng. médio · ${count} post${count === 1 ? '' : 's'}`
      }
    >
      <div className="rc-ios-fperf__bar" aria-hidden>
        <span
          className={`rc-ios-fperf__fill rc-ios-fperf__fill--${format}`}
          style={{ width: empty ? '0%' : `${Math.max(pct, avgEngagement > 0 ? 6 : 0)}%` }}
        />
      </div>
      <span className="rc-ios-fperf__val tabular-nums">
        {empty ? '—' : formatCompact(avgEngagement)}
      </span>
    </div>
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
      views: Math.max(...cs.map((c) => c.avgReelViews), 1),
      comments: Math.max(...cs.map((c) => c.avgComments), 1),
      reels: Math.max(...cs.map((c) => c.reelsShare), 1),
      eff: Math.max(...cs.map((c) => c.efficiency), 1),
      aud: Math.max(...cs.map((c) => c.audience), 1),
      unique: Math.max(...cs.map((c) => c.uniqueCommenters), 1),
    }
  }, [model.candidates])

  const reachRows = useMemo(() => {
    return [...model.candidates].sort((a, b) => b.uniqueCommenters - a.uniqueCommenters)
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

  const w = model.winners

  return (
    <div className="rc-ios" style={{ width: '100%', height: '100%', minHeight: 0 }}>
      <PresentationStage>
        <div className="rc-ios-board" role="region" aria-label="Radar Competitivo">
          <div className="rc-ios-main">
            <section className="rc-ios-panel rc-ios-panel--glass" aria-label="Visão geral competitiva">
              <div className="rc-ios-panel__head">
                <h3 className="rc-ios-panel__title">Visão geral competitiva</h3>
                <div className="rc-ios-panel__head-actions">
                  <p className="rc-ios-panel__hint">
                    {model.candidates.length} perfis · {periodLabel} · selecione até {MAX_SELECT}
                  </p>
                  <button
                    type="button"
                    className={cn(
                      'rc-ios-compare-cta',
                      compareReady && 'rc-ios-compare-cta--visible',
                    )}
                    disabled={!compareReady}
                  >
                    Comparar selecionados ({selected.length})
                  </button>
                </div>
              </div>
              <div className="rc-ios-profiles">
                {Array.from({ length: 9 }).map((_, i) => {
                  const c = model.candidates[i]
                  if (!c) {
                    return <div key={`empty-${i}`} className="rc-ios-profile" aria-hidden />
                  }
                  const isOn = selected.includes(c.slug)
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      className={cn(
                        'rc-ios-profile',
                        hasSelection && !isOn && 'rc-ios-profile--dim',
                        isOn && 'rc-ios-profile--selected',
                      )}
                      onClick={() => toggle(c.slug)}
                      aria-pressed={isOn}
                    >
                      <span className="rc-ios-profile__rank">{String(c.rank).padStart(2, '0')}</span>
                      <Avatar
                        name={c.name}
                        url={c.avatarUrl}
                        className="rc-ios-profile__avatar"
                        fallbackClassName="rc-ios-profile__avatar--fb"
                      />
                      <p className="rc-ios-profile__name">{c.name}</p>
                      <p className="rc-ios-profile__user">
                        {c.username ? `@${c.username}` : '—'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>

            <div className="rc-ios-mid">
              <section className="rc-ios-panel rc-ios-rank" aria-label="Ranking geral">
                <div className="rc-ios-panel__head">
                  <h3 className="rc-ios-panel__title">Ranking geral</h3>
                  <p className="rc-ios-panel__hint">Audiência</p>
                </div>
                <ul className="rc-ios-rank__list">
                  {model.candidates.map((c) => (
                    <li key={c.slug} className="rc-ios-rank__row">
                      <span className="rc-ios-rank__pos">
                        {String(c.rank).padStart(2, '0')}
                      </span>
                      <Avatar
                        name={c.name}
                        url={c.avatarUrl}
                        className="rc-ios-rank__avatar"
                        fallbackClassName="rc-ios-rank__avatar--fb"
                      />
                      <span className="rc-ios-rank__name">
                        {c.name}
                        {c.slug === w.audienceSlug ? (
                          <Star className="rc-ios-rank__star" size={11} fill="currentColor" strokeWidth={0} />
                        ) : null}
                      </span>
                      <span className="rc-ios-rank__val">{formatCompact(c.audience)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rc-ios-panel rc-ios-map" aria-label="Mapa de performance com ênfase em Reels">
                <div className="rc-ios-panel__head">
                  <h3 className="rc-ios-panel__title">Mapa de performance · ênfase Reels</h3>
                  <p className="rc-ios-panel__hint">
                    Views e % de formato · demais métricas no total
                  </p>
                </div>
                <div className="rc-ios-map__table">
                  <div className="rc-ios-map__th rc-ios-map__th--name">#</div>
                  <div className="rc-ios-map__th">Engajamento</div>
                  <div className="rc-ios-map__th">Views / Reels</div>
                  <div className="rc-ios-map__th">Comentários</div>
                  <div className="rc-ios-map__th">Reels</div>
                  <div className="rc-ios-map__th">Eficiência</div>
                  <div className="rc-ios-map__th">Audiência</div>
                  {model.candidates.map((c, i) => (
                    <MapRow
                      key={c.slug}
                      c={c}
                      mapIndex={i}
                      maxes={maxes}
                      winners={w}
                    />
                  ))}
                </div>
              </section>

              <section className="rc-ios-panel rc-ios-pulse" aria-label="Alcance de conversa">
                <div className="rc-ios-panel__head">
                  <h3 className="rc-ios-panel__title">Alcance de conversa</h3>
                  <p className="rc-ios-panel__hint">
                    Contas únicas nos comentários · posts no período
                  </p>
                </div>
                <div className="rc-ios-reach">
                  <div className="rc-ios-reach__head" aria-hidden>
                    <span className="rc-ios-reach__h-perfil">Perfil</span>
                    <span className="rc-ios-reach__h-posts">Posts</span>
                    <span className="rc-ios-reach__h-unique" title="Contas únicas nos comentários">
                      Únicas
                    </span>
                    <span
                      className="rc-ios-reach__h-recur"
                      title="Comentários amostrados ÷ contas únicas — alto = mesmas contas voltando"
                    >
                      Recorr.
                    </span>
                  </div>
                  <ul className="rc-ios-reach__list">
                    {reachRows.map((c, i) => {
                      const barPct =
                        maxes.unique > 0
                          ? Math.min(100, Math.round((c.uniqueCommenters / maxes.unique) * 100))
                          : 0
                      const dimmed = hasSelection && !selected.includes(c.slug)
                      return (
                        <li
                          key={c.slug}
                          className={cn('rc-ios-reach__row', dimmed && 'rc-ios-reach__row--dim')}
                        >
                          <span className="rc-ios-reach__rank">{String(i + 1).padStart(2, '0')}</span>
                          <span className="rc-ios-reach__name" title={c.name}>
                            {c.name}
                          </span>
                          <span className="rc-ios-reach__posts tabular-nums">{c.postCount}</span>
                          <div className="rc-ios-reach__unique">
                            <div className="rc-ios-reach__bar" aria-hidden>
                              <span
                                className="rc-ios-reach__fill"
                                style={{
                                  width: c.uniqueCommenters > 0 ? `${Math.max(barPct, 6)}%` : '0%',
                                }}
                              />
                            </div>
                            <span className="rc-ios-reach__val tabular-nums">
                              {c.uniqueCommenters > 0 ? formatCompact(c.uniqueCommenters) : '—'}
                            </span>
                          </div>
                          <span
                            className="rc-ios-reach__recur tabular-nums"
                            title={
                              c.uniqueCommenters > 0
                                ? `${c.commentsSampled} comentários amostrados / ${c.uniqueCommenters} contas`
                                : 'Sem amostra de comentários — rode a coleta Apify'
                            }
                          >
                            {c.uniqueCommenters > 0
                              ? `${c.commentsPerUnique.toFixed(1).replace('.', ',')}×`
                              : '—'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  {reachRows.every((c) => c.uniqueCommenters === 0) ? (
                    <p className="rc-ios-reach__empty">
                      Sem comentários coletados ainda. Execute a coleta do Radar (Apify comments) e o
                      SQL <code>create-instagram-radar-comments-table.sql</code>.
                    </p>
                  ) : null}
                </div>
              </section>
            </div>

            <div className="rc-ios-bottom">
              <section className="rc-ios-panel rc-ios-dna" aria-label="DNA do conteúdo">
                <div className="rc-ios-panel__head">
                  <h3 className="rc-ios-panel__title">DNA do conteúdo</h3>
                </div>
                <ul className="rc-ios-dna__rows">
                  {model.candidates.map((c) => {
                    const mix = c.contentMix
                    const sum = Math.max(1, mix.image + mix.reels + mix.carousel)
                    return (
                      <li key={c.slug} className="rc-ios-dna__row">
                        <span className="rc-ios-dna__rank">
                          {String(c.rank).padStart(2, '0')}
                        </span>
                        <div className="rc-ios-dna__main">
                          <div
                            className="rc-ios-dna__stack"
                            aria-label={`${c.name}: imagem ${mix.image}%, reels ${mix.reels}%, carrossel ${mix.carousel}%`}
                          >
                            <span
                              className="rc-ios-dna__seg"
                              style={{
                                width: `${(mix.image / sum) * 100}%`,
                                background: 'var(--rc-mix-image)',
                              }}
                              title={`Imagem ${mix.image}%`}
                            />
                            <span
                              className="rc-ios-dna__seg"
                              style={{
                                width: `${(mix.reels / sum) * 100}%`,
                                background: 'var(--rc-mix-reels)',
                              }}
                              title={`Reels ${mix.reels}%`}
                            />
                            <span
                              className="rc-ios-dna__seg"
                              style={{
                                width: `${(mix.carousel / sum) * 100}%`,
                                background: 'var(--rc-mix-carousel)',
                              }}
                              title={`Carrossel ${mix.carousel}%`}
                            />
                          </div>
                          <div className="rc-ios-dna__pcts" aria-hidden>
                            <span style={{ color: 'var(--rc-mix-image)' }}>{mix.image}%</span>
                            <span style={{ color: 'var(--rc-mix-reels)' }}>{mix.reels}%</span>
                            <span style={{ color: 'var(--rc-mix-carousel)' }}>{mix.carousel}%</span>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
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
                  <span className="rc-ios-dna__legend-note">soma 100%</span>
                </div>
              </section>

              <div className="rc-ios-center-stack">
                <section className="rc-ios-panel rc-ios-tops" aria-label="Top conteúdos">
                  <div className="rc-ios-panel__head">
                    <h3 className="rc-ios-panel__title">Top conteúdos do universo</h3>
                  </div>
                  <div className="rc-ios-tops__strip">
                    {Array.from({ length: 8 }).map((_, i) => {
                      const p = model.topPosts[i]
                      if (!p) {
                        return (
                          <div key={`top-empty-${i}`} className="rc-ios-top rc-ios-top--empty" aria-hidden>
                            <div className="rc-ios-top__media rc-ios-top__media--empty">
                              <span className="rc-ios-top__badge">{String(i + 1).padStart(2, '0')}</span>
                            </div>
                          </div>
                        )
                      }
                      return (
                        <a
                          key={p.id}
                          className="rc-ios-top"
                          href={p.postUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <div className="rc-ios-top__media">
                            <TopPostThumb
                              thumbnailUrl={p.thumbnailUrl}
                              name={p.name}
                            />
                            <span className="rc-ios-top__badge">{String(p.rank).padStart(2, '0')}</span>
                            <div className="rc-ios-top__meta">
                              {p.avatarUrl ? (
                                <img src={p.avatarUrl} alt="" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="rc-ios-top__av">{initials(p.name)}</span>
                              )}
                              <span>{formatCompact(p.viewsProxy)}</span>
                            </div>
                          </div>
                          <span className="rc-ios-top__eng" title={p.name}>
                            {formatCompact(p.engagement)} eng. · {p.name.split(' ')[0]}
                          </span>
                        </a>
                      )
                    })}
                  </div>
                </section>

                <section
                  className="rc-ios-panel rc-ios-fperf"
                  aria-label="Performance por formato"
                >
                  <div className="rc-ios-panel__head">
                    <h3 className="rc-ios-panel__title">Performance por formato</h3>
                    <p className="rc-ios-panel__hint">engaj. médio/post · % do engajamento total</p>
                  </div>
                  <div className="rc-ios-fperf__cols-head" aria-hidden>
                    <span />
                    <span className="rc-ios-fperf__col-label rc-ios-fperf__col-label--image">
                      Imagem
                    </span>
                    <span className="rc-ios-fperf__col-label rc-ios-fperf__col-label--reels">
                      Reels
                    </span>
                    <span className="rc-ios-fperf__col-label rc-ios-fperf__col-label--carousel">
                      Carrossel
                    </span>
                    <span className="rc-ios-fperf__col-label rc-ios-fperf__col-label--share">
                      Mix eng.
                    </span>
                  </div>
                  <ul className="rc-ios-fperf__rows">
                    {model.candidates.map((c) => {
                      const share = c.formatEngShare
                      return (
                        <li key={c.slug} className="rc-ios-fperf__row">
                          <span className="rc-ios-fperf__rank">
                            {String(c.rank).padStart(2, '0')}
                          </span>
                          <FormatPerfCell
                            format="image"
                            avgEngagement={c.formatPerf.image.avgEngagement}
                            count={c.formatPerf.image.count}
                            max={model.formatPerfMax.image.avgEngagement}
                          />
                          <FormatPerfCell
                            format="reels"
                            avgEngagement={c.formatPerf.reels.avgEngagement}
                            count={c.formatPerf.reels.count}
                            max={model.formatPerfMax.reels.avgEngagement}
                          />
                          <FormatPerfCell
                            format="carousel"
                            avgEngagement={c.formatPerf.carousel.avgEngagement}
                            count={c.formatPerf.carousel.count}
                            max={model.formatPerfMax.carousel.avgEngagement}
                          />
                          <div
                            className="rc-ios-fperf__share"
                            title={`Parte do engajamento: Imagem ${share.image}% · Reels ${share.reels}% · Carrossel ${share.carousel}%`}
                          >
                            <span className="rc-ios-fperf__share-item rc-ios-fperf__share-item--image">
                              {share.image}%
                            </span>
                            <span className="rc-ios-fperf__share-item rc-ios-fperf__share-item--reels">
                              {share.reels}%
                            </span>
                            <span className="rc-ios-fperf__share-item rc-ios-fperf__share-item--carousel">
                              {share.carousel}%
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              </div>

              <section className="rc-ios-panel rc-ios-connections" aria-label="Destaques por formato">
                <div className="rc-ios-panel__head">
                  <h3 className="rc-ios-panel__title">Destaques por formato</h3>
                </div>
                <ul className="rc-ios-connections__list">
                  {model.formatLeaders.map((leader) => (
                    <li key={leader.format} className="rc-ios-connections__row">
                      {leader.avatarUrl ? (
                        <img src={leader.avatarUrl} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="rc-ios-connections__av">{initials(leader.name)}</span>
                      )}
                      <span className="rc-ios-connections__meta">
                        <span className="rc-ios-connections__format">{leader.label}</span>
                        <span className="rc-ios-connections__name">{leader.name}</span>
                      </span>
                      <span className="rc-ios-connections__score tabular-nums">
                        {leader.postCount === 0
                          ? '—'
                          : formatCompact(leader.avgEngagement)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </div>
      </PresentationStage>
    </div>
  )
}

function MapRow({
  c,
  mapIndex,
  maxes,
  winners,
}: {
  c: RadarCompetitivoCandidate
  mapIndex: number
  maxes: {
    eng: number
    views: number
    comments: number
    reels: number
    eff: number
    aud: number
  }
  winners: RadarCompetitivoModel['winners']
}) {
  const num = String(mapIndex + 1).padStart(2, '0')
  return (
    <>
      <div className="rc-ios-map__name" title={c.name}>
        <span className="rc-ios-map__num">{num}</span>
      </div>
      <MetricBar
        value={c.avgEngagement}
        max={maxes.eng}
        color={c.color}
        display={formatCompact(c.avgEngagement)}
        win={winners.engagementSlug === c.slug}
      />
      <MetricBar
        value={c.avgReelViews}
        max={maxes.views}
        color={c.color}
        display={formatCompact(c.avgReelViews)}
        win={false}
      />
      <MetricBar
        value={c.avgComments}
        max={maxes.comments}
        color={c.color}
        display={formatCompact(c.avgComments)}
        win={winners.commentsSlug === c.slug}
      />
      <MetricBar
        value={c.reelsShare}
        max={maxes.reels}
        color={c.color}
        display={`${c.reelsShare}%`}
        win={winners.reelsSlug === c.slug}
      />
      <MetricBar
        value={c.efficiency}
        max={maxes.eff}
        color={c.color}
        display={c.efficiency.toFixed(2).replace('.', ',')}
        win={winners.efficiencySlug === c.slug}
      />
      <MetricBar
        value={c.audience}
        max={maxes.aud}
        color={c.color}
        display={formatCompact(c.audience)}
        win={winners.audienceSlug === c.slug}
      />
    </>
  )
}
