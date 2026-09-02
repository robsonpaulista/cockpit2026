'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Activity,
  ExternalLink,
  Eye,
  MapPin,
  Megaphone,
  Target,
  Trophy,
  Wallet,
} from 'lucide-react'
import type {
  WarRoomAnuncioListRow,
  WarRoomAnunciosCompetitorRow,
  WarRoomAnunciosLocationRow,
  WarRoomAnunciosScore,
} from '@/lib/war-room/anuncios-copiloto'
import type { MetaAdsPeriodTotals } from '@/lib/meta-ads-aggregate'
import { cn } from '@/lib/utils'

type Props = {
  periodLabel: string
  ownName: string
  score: WarRoomAnunciosScore
  totals: MetaAdsPeriodTotals
  ownActiveCount: number
  geoCoveragePct: number
  competitorRows: WarRoomAnunciosCompetitorRow[]
  locationRows: WarRoomAnunciosLocationRow[]
  adRows: WarRoomAnuncioListRow[]
  isActiveLeader: boolean
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function prefersReduceMotion(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useCountUp(value: number, enabled: boolean): number {
  const [shown, setShown] = useState(value)
  const fromRef = useRef(value)
  useEffect(() => {
    if (!enabled || prefersReduceMotion()) {
      fromRef.current = value
      setShown(value)
      return
    }
    const from = fromRef.current
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 400)
      setShown(from + (value - from) * p)
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, enabled])
  return shown
}

function DotBar({ pct }: { pct: number }) {
  const filled = Math.round(clamp(pct, 0, 100) / 10)
  return (
    <span className="wr-anuncios-dots" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={i < filled ? 'on' : undefined} />
      ))}
    </span>
  )
}

function AnunciosSection({
  title,
  sub,
  children,
  className,
}: {
  title: string
  sub: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('wr-anuncios-section', className)}>
      <header className="wr-anuncios-section__head">
        <div>
          <h3 className="wr-anuncios-section__title">{title}</h3>
          <p className="wr-anuncios-section__sub">{sub}</p>
        </div>
      </header>
      <div className="wr-anuncios-section__body">{children}</div>
    </section>
  )
}

function AnunciosRankList({
  rows,
}: {
  rows: Array<{
    key: string
    rank: number
    name: string
    metric: string
    sub?: string | null
    pct: number
    isLeader?: boolean
  }>
}) {
  if (rows.length === 0) return null
  return (
    <ol className="wr-anuncios-rank">
      {rows.map((row) => (
        <li key={row.key} className="wr-anuncios-rank__item">
          <span className="wr-anuncios-rank__num tabular-nums">{String(row.rank).padStart(2, '0')}</span>
          <div className="wr-anuncios-rank__main">
            <div className="wr-anuncios-rank__head">
              <span className="wr-anuncios-rank__name">
                {row.name}
                {row.isLeader ? (
                  <span className="rc-ios-champ__badge rc-ios-champ__badge--top">TOP</span>
                ) : null}
              </span>
              <strong className="wr-anuncios-rank__metric tabular-nums">{row.metric}</strong>
            </div>
            <span className="wr-anuncios-rank__bar" aria-hidden>
              <i style={{ width: `${Math.max(row.pct, row.pct > 0 ? 8 : 0)}%` }} />
            </span>
            {row.sub ? <p className="wr-anuncios-rank__sub">{row.sub}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function WarRoomAnunciosHud({
  periodLabel,
  ownName,
  score,
  totals,
  ownActiveCount,
  geoCoveragePct,
  competitorRows,
  locationRows,
  adRows,
  isActiveLeader,
}: Props) {
  const scoreShown = useCountUp(score.score, true)
  const activeShown = useCountUp(ownActiveCount, true)
  const geoShown = useCountUp(geoCoveragePct, true)

  const champion = adRows[0] ?? null
  const rest = adRows.slice(1, 8)
  const locationMax = Math.max(1, ...locationRows.map((row) => row.count))

  const wins = useMemo(
    () => [
      {
        Icon: Trophy,
        title: isActiveLeader ? 'Liderança em ativos' : 'Share no comparativo',
        value: isActiveLeader ? 'TOP' : `${competitorRows.find((r) => r.isOwn)?.sharePct ?? 0}%`,
        sub: isActiveLeader ? 'Mais anúncios veiculando' : 'participação no campo',
      },
      {
        Icon: Megaphone,
        title: 'Anúncios ativos',
        value: String(ownActiveCount),
        sub: ownName,
      },
      {
        Icon: Wallet,
        title: 'Investimento',
        value: totals.spendLabel || '—',
        sub: 'faixa estimada',
      },
      {
        Icon: Eye,
        title: 'Impressões',
        value: totals.impressionsLabel || '—',
        sub: 'alcance no período',
      },
      {
        Icon: MapPin,
        title: 'Segmentação geo',
        value: `${geoCoveragePct}%`,
        sub: 'com localização',
      },
    ],
    [competitorRows, geoCoveragePct, isActiveLeader, ownActiveCount, ownName, totals],
  )

  return (
    <div className="wr-anuncios-hud">
      <AnunciosSection
        title="Momento da campanha"
        sub={`Desempenho de mídia paga nos últimos ${periodLabel}`}
      >
        <div className="wr-anuncios-kpis">
          <article className="wr-anuncios-kpi">
            <span className="wr-anuncios-kpi__ico" aria-hidden>
              <Activity size={14} strokeWidth={2.2} />
            </span>
            <p className="wr-anuncios-kpi__label">Performance</p>
            <div className="wr-anuncios-kpi__top">
              <strong className="wr-anuncios-kpi__val tabular-nums">
                {scoreShown.toFixed(1).replace('.', ',')}
              </strong>
              {isActiveLeader ? (
                <span className="rc-ios-champ__badge rc-ios-champ__badge--top">TOP</span>
              ) : null}
            </div>
            <DotBar pct={score.score * 10} />
            <p className={cn('wr-anuncios-kpi__foot', `wr-anuncios-kpi__foot--${score.footTone}`)}>
              {score.label}
            </p>
          </article>
          <article className="wr-anuncios-kpi">
            <span className="wr-anuncios-kpi__ico" aria-hidden>
              <Megaphone size={14} strokeWidth={2.2} />
            </span>
            <p className="wr-anuncios-kpi__label">Ativos</p>
            <strong className="wr-anuncios-kpi__val tabular-nums">{Math.round(activeShown)}</strong>
            <DotBar pct={clamp(ownActiveCount * 12, 8, 100)} />
            <p className="wr-anuncios-kpi__foot">veiculando agora</p>
          </article>
          <article className="wr-anuncios-kpi">
            <span className="wr-anuncios-kpi__ico" aria-hidden>
              <Wallet size={14} strokeWidth={2.2} />
            </span>
            <p className="wr-anuncios-kpi__label">Investimento</p>
            <strong className="wr-anuncios-kpi__val wr-anuncios-kpi__val--sm tabular-nums">
              {totals.spendLabel || '—'}
            </strong>
            <p className="wr-anuncios-kpi__foot">Meta Ads Library</p>
          </article>
          <article className="wr-anuncios-kpi">
            <span className="wr-anuncios-kpi__ico" aria-hidden>
              <Eye size={14} strokeWidth={2.2} />
            </span>
            <p className="wr-anuncios-kpi__label">Impressões</p>
            <strong className="wr-anuncios-kpi__val wr-anuncios-kpi__val--sm tabular-nums">
              {totals.impressionsLabel || '—'}
            </strong>
            <p className="wr-anuncios-kpi__foot">alcance estimado</p>
          </article>
          <article className="wr-anuncios-kpi">
            <span className="wr-anuncios-kpi__ico" aria-hidden>
              <Target size={14} strokeWidth={2.2} />
            </span>
            <p className="wr-anuncios-kpi__label">Geo</p>
            <strong className="wr-anuncios-kpi__val tabular-nums">{Math.round(geoShown)}%</strong>
            <DotBar pct={geoCoveragePct} />
            <p className="wr-anuncios-kpi__foot">localização capturada</p>
          </article>
        </div>
      </AnunciosSection>

      <AnunciosSection title="Segmentação geográfica" sub="Cidades e estados incluídos">
        {locationRows.length === 0 ? (
          <p className="wr-anuncios-empty">Localização ainda não capturada.</p>
        ) : (
          <AnunciosRankList
            rows={locationRows.map((row, index) => ({
              key: row.name,
              rank: index + 1,
              name: row.name,
              metric: `${row.count} anúncio${row.count === 1 ? '' : 's'}`,
              sub: null,
              pct: locationMax > 0 ? Math.round((row.count / locationMax) * 100) : 0,
            }))}
          />
        )}
      </AnunciosSection>

      <AnunciosSection title="Anúncios em destaque" sub="Maior participação de impressões">
        {!champion ? (
          <p className="wr-anuncios-empty">Nenhum anúncio ativo neste período.</p>
        ) : (
          <div className="wr-anuncios-rail">
            {[champion, ...rest].map((row, index) => {
              const CardTag = row.ad.library_url ? 'a' : 'div'
              const linkProps = row.ad.library_url
                ? { href: row.ad.library_url, target: '_blank' as const, rel: 'noopener noreferrer' }
                : {}
              return (
                <CardTag
                  key={row.ad.id}
                  className={cn('wr-anuncios-card', index === 0 && 'wr-anuncios-card--top')}
                  {...linkProps}
                >
                  {index === 0 ? (
                    <span className="rc-ios-champ__badge rc-ios-champ__badge--top">TOP</span>
                  ) : (
                    <span className="wr-anuncios-card__rank">{String(index + 1).padStart(2, '0')}</span>
                  )}
                  <span className="wr-anuncios-card__ico" aria-hidden>
                    <Megaphone size={18} strokeWidth={1.5} />
                  </span>
                  <p className="wr-anuncios-card__title">{row.short}</p>
                  <p className="wr-anuncios-card__meta">
                    Início {row.startedLabel}
                    {row.locationsLabel ? ` · ${row.locationsLabel}` : ''}
                  </p>
                  <p className="wr-anuncios-card__metric tabular-nums">
                    {row.impressionsLabel}
                    {row.sharePct != null ? ` · ${row.sharePct}%` : ''}
                  </p>
                </CardTag>
              )
            })}
          </div>
        )}
      </AnunciosSection>

      <AnunciosSection title="Conquistas do período" sub="Marcos da campanha paga">
        <div className="wr-anuncios-wins">
          {wins.map((win) => (
            <article key={win.title} className="wr-anuncios-win">
              <span className="wr-anuncios-win__ico" aria-hidden>
                <win.Icon size={16} strokeWidth={2} />
              </span>
              <strong className="wr-anuncios-win__title">{win.title}</strong>
              <em className="wr-anuncios-win__val tabular-nums">{win.value}</em>
              <span className="wr-anuncios-win__sub">{win.sub}</span>
            </article>
          ))}
        </div>
      </AnunciosSection>

      <AnunciosSection
        title={`Anúncios ativos · ${ownName}`}
        sub="Todos os criativos veiculando no período"
      >
        {adRows.length === 0 ? (
          <p className="wr-anuncios-empty">Nenhum anúncio ativo neste período.</p>
        ) : (
          <div className="wr-copiloto-list-card wr-copiloto-list-card--dense wr-anuncios-lista">
            <ul className="wr-copiloto-list-card__list" aria-label="Anúncios ativos">
              {adRows.map((row) => {
                const barPct = row.sharePct ?? 0
                const body = (
                  <>
                    <span
                      className="wr-copiloto-list-card__thumb wr-copiloto-list-card__thumb--icon"
                      aria-hidden
                    >
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
                        {row.locationsLabel ? ` · ${row.locationsLabel}` : ''}
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
                      <span className="wr-copiloto-list-card__bar" role="presentation" aria-hidden>
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
                      </a>
                    ) : (
                      <div className="wr-copiloto-list-card__row-inner">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="wr-copiloto-list-card__footer">
              <span className="tabular-nums">
                {adRows.length} ativo{adRows.length === 1 ? '' : 's'}
                {totals.impressionsLabel ? ` · ${totals.impressionsLabel}` : ''}
                {totals.spendLabel ? ` · ${totals.spendLabel}` : ''}
              </span>
            </div>
          </div>
        )}
      </AnunciosSection>
    </div>
  )
}
