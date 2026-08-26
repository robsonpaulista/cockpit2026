'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Eye,
  FileText,
  Flame,
  ImageIcon,
  Layers,
  Send,
  Trophy,
  Video,
  Zap,
} from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { proxiedInstagramMediaUrl } from '@/lib/instagram-cdn-proxy'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import type { WarRoomRedesTopPost } from '@/lib/war-room/redes-copiloto'
import type { WarRoomDesempenhoKpi } from '@/components/war-room/war-room-redes-desempenho-view'
import { cn } from '@/lib/utils'

type ThemeRow = {
  theme: string
  stats: { posts: number; views: number; engagement: number; avgEngagement: number }
  isLeader: boolean
}

type DnaSlice = {
  key: 'image' | 'reels' | 'carousel'
  label: string
  count: number
  pct: number
  avgEng: number
}

type PostInPeriod = {
  id?: string
  type: 'image' | 'video' | 'carousel'
  metrics: { engagement: number; views?: number }
}

type Props = {
  days: number
  periodLabel: string
  handle: string | null
  postsInPeriod: PostInPeriod[]
  topPosts: WarRoomRedesTopPost[]
  themeRows: ThemeRow[]
  themeMetricMax: number
  kpis: WarRoomDesempenhoKpi[]
  onThemeClick: (theme: string) => void
  onVisitsDoubleClick: () => void
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function formatDelta(deltaPct: number | null): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (deltaPct == null || !Number.isFinite(deltaPct)) return { text: '—', tone: 'flat' }
  const tone = deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'flat'
  const sign = deltaPct > 0 ? '↑ ' : deltaPct < 0 ? '↓ ' : ''
  return {
    text: `${sign}${Math.abs(deltaPct).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    })}%`,
    tone,
  }
}

function initials(text: string): string {
  const parts = text.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '•'
}

function formatType(type: PostInPeriod['type'] | undefined): string {
  if (type === 'video') return 'REELS'
  if (type === 'carousel') return 'CARROSSEL'
  if (type === 'image') return 'IMAGEM'
  return ''
}

function weekdayPt(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { weekday: 'long' })
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
      const next = from + (value - from) * p
      setShown(next)
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
    <span className="wr-pc-dots" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} className={i < filled ? 'on' : undefined} />
      ))}
    </span>
  )
}

function MiniSpark({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return <div className={cn('wr-pc-spark', className)} />
  const data = values.map((value, i) => ({ i, value }))
  return (
    <div className={cn('wr-pc-spark', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#555a60"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function PlacarSparkTip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: { label?: string; value?: number } }>
}) {
  if (!active || !payload?.[0]?.payload) return null
  const point = payload[0].payload
  return (
    <div className="wr-pc-spark-tip">
      <span>{String(point.label ?? '')}</span>
      <strong className="tabular-nums">
        {formatWarRoomNumber(Number(point.value ?? 0))}
      </strong>
    </div>
  )
}

function PlacarSpark({ kpi }: { kpi: WarRoomDesempenhoKpi }) {
  if (kpi.series.length < 2) return <div className="wr-pc-spark" />
  return (
    <div className="wr-pc-spark">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={kpi.series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            cursor={false}
            allowEscapeViewBox={{ x: true, y: true }}
            // Fixo no canto esquerdo do spark — sempre cabe, inclusive nos cards da direita
            position={{ x: 0, y: 0 }}
            wrapperStyle={{ zIndex: 40, pointerEvents: 'none', outline: 'none' }}
            content={PlacarSparkTip}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#555a60"
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function Thumb({ src, alt, className }: { src: string | null | undefined; alt: string; className: string }) {
  const [broken, setBroken] = useState(false)
  const proxied = proxiedInstagramMediaUrl(src)
  if (!proxied || broken) {
    return <div className={className}>{initials(alt)}</div>
  }
  return (
    <img src={proxied} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
  )
}

export function WarRoomRedesHud({
  days,
  periodLabel,
  postsInPeriod,
  topPosts,
  themeRows,
  kpis,
  onThemeClick,
  onVisitsDoubleClick,
}: Props) {
  const viewsKpi = kpis.find((k) => k.id === 'views')
  const engKpi = kpis.find((k) => k.id === 'engagement')
  const followersKpi = kpis.find((k) => k.id === 'followers')

  const postCount = postsInPeriod.length
  const cadence = days > 0 ? postCount / days : 0
  const engDelta = engKpi?.deltaPct ?? 0
  const viewsDelta = viewsKpi?.deltaPct ?? 0
  const scoreRaw =
    (clamp(cadence, 0, 1.4) / 1.4) * 3.5 +
    clamp((engDelta + 20) / 60, 0, 1) * 3.5 +
    clamp((viewsDelta + 20) / 60, 0, 1) * 3
  const score = Math.round(clamp(scoreRaw, 0, 10) * 10) / 10
  const scoreLabel =
    score >= 8 ? 'Muito bom' : score >= 6 ? 'Bom' : score >= 4 ? 'Regular' : 'Fraco'
  const scoreFootTone = score >= 6 ? 'ok' : score >= 4 ? 'flat' : 'down'
  const scoreDelta = formatDelta(engKpi?.deltaPct ?? null)
  const scoreShown = useCountUp(score, true)

  const alcance = viewsKpi?.total ?? 0
  const alcanceShown = useCountUp(alcance, true)
  const alcanceDelta = formatDelta(viewsKpi?.deltaPct ?? null)

  const ritmoIdeal = cadence >= 0.85
  const ritmoDelta = formatDelta(days > 0 ? ((postCount - days) / Math.max(days, 1)) * 100 : null)
  const postsShown = useCountUp(postCount, true)

  const typeById = useMemo(() => {
    const map = new Map<string, PostInPeriod['type']>()
    for (const post of postsInPeriod) {
      if (post.id) map.set(post.id, post.type)
    }
    return map
  }, [postsInPeriod])

  const rankedPosts = useMemo(
    () => [...topPosts].sort((a, b) => b.engagement - a.engagement).slice(0, 5),
    [topPosts],
  )
  const champion = rankedPosts[0] ?? null
  const rest = rankedPosts.slice(1)

  const postsPerDay = useMemo(() => {
    const byDate = new Map<string, number>()
    for (const p of topPosts) {
      byDate.set(p.dayKey, (byDate.get(p.dayKey) ?? 0) + 1)
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, n]) => n)
  }, [topPosts])

  const bestDay = useMemo(() => {
    const series = engKpi?.series ?? []
    if (series.length === 0) return null
    const best = series.reduce((a, b) => (b.value > a.value ? b : a))
    if (!best || best.value <= 0) return null
    return {
      label: best.label,
      value: best.value,
      weekday: weekdayPt(best.date),
    }
  }, [engKpi])

  const dna = useMemo((): DnaSlice[] => {
    const buckets = {
      image: { count: 0, eng: 0 },
      reels: { count: 0, eng: 0 },
      carousel: { count: 0, eng: 0 },
    }
    for (const post of postsInPeriod) {
      const key = post.type === 'video' ? 'reels' : post.type
      buckets[key].count += 1
      buckets[key].eng += post.metrics.engagement || 0
    }
    const total = Math.max(1, postsInPeriod.length)
    return [
      { key: 'image' as const, label: 'Imagem', ...buckets.image },
      { key: 'reels' as const, label: 'Reels', ...buckets.reels },
      { key: 'carousel' as const, label: 'Carrossel', ...buckets.carousel },
    ].map((row) => ({
      key: row.key,
      label: row.label,
      count: row.count,
      pct: Math.round((row.count / total) * 100),
      avgEng: row.count > 0 ? Math.round(row.eng / row.count) : 0,
    }))
  }, [postsInPeriod])

  const formatoDominante = [...dna].sort((a, b) => b.count - a.count)[0]
  const maiorEficiencia = [...dna].sort((a, b) => b.avgEng - a.avgEng)[0]

  const themeRank = useMemo(() => {
    return [...themeRows]
      .sort((a, b) => b.stats.avgEngagement - a.stats.avgEngagement)
      .slice(0, 5)
  }, [themeRows])
  const themeMax = Math.max(1, ...themeRank.map((r) => r.stats.avgEngagement))
  const risingTheme = themeRank[1] ?? null

  const mixIcon = (key: DnaSlice['key']) => {
    if (key === 'reels') return <Video size={16} strokeWidth={2} />
    if (key === 'carousel') return <Layers size={16} strokeWidth={2} />
    return <ImageIcon size={16} strokeWidth={2} />
  }

  const championEngShown = useCountUp(champion?.engagement ?? 0, Boolean(champion))

  const wins = [
    {
      ico: 'trophy' as const,
      Icon: Trophy,
      title: 'Crescimento de seguidores',
      value:
        followersKpi && followersKpi.total !== 0
          ? `${followersKpi.total > 0 ? '+' : ''}${formatWarRoomNumber(followersKpi.total)}`
          : '0',
      sub: 'no período',
    },
    {
      ico: 'chart' as const,
      Icon: BarChart3,
      title: 'Engajamento',
      value: formatWarRoomNumber(engKpi?.total ?? 0),
      sub: `${scoreDelta.text} vs. início`,
    },
    {
      ico: 'flame' as const,
      Icon: Flame,
      title: ritmoIdeal ? 'Ritmo consistente' : 'Ritmo abaixo do ideal',
      value: String(postCount),
      sub: ritmoIdeal ? 'Frequência ideal' : `posts em ${periodLabel}`,
    },
    {
      ico: 'eye' as const,
      Icon: Eye,
      title: 'Alcance de visualizações',
      value: formatWarRoomNumber(alcance),
      sub: 'views no período',
    },
    {
      ico: 'zap' as const,
      Icon: Zap,
      title: 'Post destaque',
      value: champion ? formatWarRoomNumber(champion.engagement) : '—',
      sub: champion ? 'de engajamento' : 'Sem postagens',
    },
  ]

  const placarOrder = [
    'engagement',
    'views',
    'visits',
    'story-views',
    'followers',
    'likes',
    'comments',
    'shares',
  ]
  const placarKpis = placarOrder
    .map((id) => kpis.find((k) => k.id === id))
    .filter((k): k is WarRoomDesempenhoKpi => Boolean(k))

  return (
    <div className="wr-redes-hud">
      <section className="wr-pc-panel wr-pc-momento" aria-label="Momento do perfil">
        <div className="wr-pc-panel__head">
          <h3 className="wr-pc-panel__title">Momento do perfil</h3>
          <p className="wr-pc-panel__sub">Desempenho geral nos últimos {periodLabel}</p>
        </div>
        <div className="wr-pc-momento__mods">
          <article className="wr-pc-mod">
            <div className="wr-pc-mod__head">
              <span className="wr-pc-mod__ico" aria-hidden>
                <Activity size={14} strokeWidth={2.2} />
              </span>
              <p className="wr-pc-mod__label">Performance</p>
            </div>
            <div className="wr-pc-mod__top">
              <p className="wr-pc-mod__val tabular-nums">{scoreShown.toFixed(1).replace('.', ',')}</p>
              <span className={cn('wr-pc-delta', `wr-pc-delta--${scoreDelta.tone}`)}>{scoreDelta.text}</span>
            </div>
            <MiniSpark values={engKpi?.series.map((p) => p.value) ?? []} />
            <DotBar pct={score * 10} />
            <p className={cn('wr-pc-mod__foot', `wr-pc-mod__foot--${scoreFootTone}`)}>{scoreLabel}</p>
          </article>
          <article className="wr-pc-mod">
            <div className="wr-pc-mod__head">
              <span className="wr-pc-mod__ico" aria-hidden>
                <Eye size={14} strokeWidth={2.2} />
              </span>
              <p className="wr-pc-mod__label">Alcance</p>
            </div>
            <div className="wr-pc-mod__top">
              <p className="wr-pc-mod__val tabular-nums">{formatWarRoomNumber(Math.round(alcanceShown))}</p>
              <span className={cn('wr-pc-delta', `wr-pc-delta--${alcanceDelta.tone}`)}>{alcanceDelta.text}</span>
            </div>
            <MiniSpark values={viewsKpi?.series.map((p) => p.value) ?? []} />
            <DotBar pct={clamp((viewsDelta + 20) * 1.4, 8, 100)} />
            <p className="wr-pc-mod__foot">Visualizações</p>
          </article>
          <article className="wr-pc-mod">
            <div className="wr-pc-mod__head">
              <span className="wr-pc-mod__ico" aria-hidden>
                <Send size={14} strokeWidth={2.2} />
              </span>
              <p className="wr-pc-mod__label">Ritmo</p>
            </div>
            <div className="wr-pc-mod__top">
              <p className="wr-pc-mod__val tabular-nums">{Math.round(postsShown)}</p>
              <span className={cn('wr-pc-delta', `wr-pc-delta--${ritmoDelta.tone}`)}>{ritmoDelta.text}</span>
            </div>
            <MiniSpark values={postsPerDay} />
            <DotBar pct={clamp(cadence * 100, 8, 100)} />
            <p className={cn('wr-pc-mod__foot', ritmoIdeal ? 'wr-pc-mod__foot--ok' : 'wr-pc-mod__foot--flat')}>
              {ritmoIdeal ? 'Frequência ideal' : `vs. ${days} dias`}
            </p>
          </article>
          <article className="wr-pc-mod">
            <div className="wr-pc-mod__head">
              <span className="wr-pc-mod__ico" aria-hidden>
                <CalendarDays size={14} strokeWidth={2.2} />
              </span>
              <p className="wr-pc-mod__label">Melhor dia</p>
            </div>
            {bestDay ? (
              <>
                <p className="wr-pc-mod__val tabular-nums">{bestDay.label}</p>
                <p className="wr-pc-mod__hint">{formatWarRoomNumber(bestDay.value)} eng.</p>
                <p className="wr-pc-mod__hint">{bestDay.weekday}</p>
              </>
            ) : (
              <p className="wr-pc-empty">Dados insuficientes para calcular tendência.</p>
            )}
          </article>
          <article className="wr-pc-mod">
            <div className="wr-pc-mod__head">
              <span className="wr-pc-mod__ico" aria-hidden>
                <FileText size={14} strokeWidth={2.2} />
              </span>
              <p className="wr-pc-mod__label">Posts período</p>
            </div>
            <div className="wr-pc-mod__top">
              <p className="wr-pc-mod__val tabular-nums">{Math.round(postsShown)}</p>
              <span className={cn('wr-pc-delta', `wr-pc-delta--${ritmoDelta.tone}`)}>{ritmoDelta.text}</span>
            </div>
            <p className="wr-pc-mod__hint">vs. período de {periodLabel}</p>
          </article>
        </div>
      </section>

      <section className="wr-pc-panel wr-pc-dna" aria-label="DNA do conteúdo">
        <div className="wr-pc-panel__head">
          <h3 className="wr-pc-panel__title">DNA do conteúdo</h3>
          <p className="wr-pc-panel__sub">Mix de formatos no período</p>
        </div>
        {postsInPeriod.length === 0 ? (
          <p className="wr-pc-empty">Nenhum conteúdo publicado neste período.</p>
        ) : (
          <>
            <div className="wr-pc-dna__mix">
              {dna.map((slice) => (
                <div key={slice.key} className="wr-pc-dna__col">
                  <span className={cn('wr-pc-dna__ico', slice.key === 'carousel' && 'wr-pc-dna__ico--carousel')}>
                    {mixIcon(slice.key)}
                  </span>
                  <p className="wr-pc-dna__name">{slice.label}</p>
                  <strong className="wr-pc-dna__pct tabular-nums">{slice.pct}%</strong>
                  <DotBar pct={slice.pct} />
                  <p className="wr-pc-dna__count">{slice.count} posts</p>
                </div>
              ))}
            </div>
            <div className="wr-pc-dna__foot">
              <p>
                <span>Formato dominante</span>
                <strong>
                  {formatoDominante?.label ?? '—'}
                  {formatoDominante ? ` · ${formatoDominante.pct}%` : ''}
                </strong>
              </p>
              <p>
                <span>Maior eficiência</span>
                <strong>
                  {maiorEficiencia?.label ?? '—'}
                  {maiorEficiencia ? ` · ${formatWarRoomNumber(maiorEficiencia.avgEng)}` : ''}
                </strong>
              </p>
            </div>
          </>
        )}
      </section>

      <section className="wr-pc-panel wr-pc-posts" aria-label="Conteúdos em destaque">
        <div className="wr-pc-panel__head">
          <h3 className="wr-pc-panel__title">Conteúdos em destaque</h3>
          <p className="wr-pc-panel__sub">Melhores posts por engajamento</p>
        </div>
        {!champion ? (
          <p className="wr-pc-empty">Nenhum conteúdo publicado neste período.</p>
        ) : (
          <div className="wr-pc-posts__body">
            <div className="wr-pc-rail">
              <a
                className="wr-pc-hero"
                href={champion.url || undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="rc-ios-champ__badge rc-ios-champ__badge--top">TOP</span>
                <div className="wr-pc-hero__art">
                  <Thumb src={champion.thumbnail} alt={champion.header} className="wr-pc-hero__fb" />
                </div>
                <h4 className="wr-pc-hero__title">{champion.header}</h4>
                <p className="wr-pc-hero__meta">
                  {champion.dateLabel}
                  {formatType(typeById.get(champion.id))
                    ? ` · ${formatType(typeById.get(champion.id))}`
                    : ''}
                </p>
                <p className="wr-pc-hero__eng tabular-nums">
                  {formatWarRoomNumber(Math.round(championEngShown))}
                  <span>engajamentos</span>
                </p>
              </a>
              {rest.map((post, i) => (
                <a
                  key={post.id}
                  className="wr-pc-mini"
                  href={post.url || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="wr-pc-mini__rank">{String(i + 2).padStart(2, '0')}</span>
                  <div className="wr-pc-mini__art">
                    <Thumb src={post.thumbnail} alt={post.header} className="wr-pc-mini__fb" />
                  </div>
                  <p className="wr-pc-mini__title">{post.header}</p>
                  <p className="wr-pc-mini__meta">
                    {post.dateLabel}
                    {formatType(typeById.get(post.id)) ? ` · ${formatType(typeById.get(post.id))}` : ''}
                  </p>
                  <p className="wr-pc-mini__eng tabular-nums">
                    {formatWarRoomNumber(post.engagement)}
                    <span>engajamentos</span>
                  </p>
                </a>
              ))}
            </div>
            <Link href="/dashboard/conteudo/redes" className="wr-pc-all">
              Ver todos os conteúdos
              <ArrowRight size={14} strokeWidth={2.2} aria-hidden />
            </Link>
          </div>
        )}
      </section>

      <section className="wr-pc-panel wr-pc-placar" aria-label="Placar de performance">
        <div className="wr-pc-panel__head">
          <h3 className="wr-pc-panel__title">Placar de performance</h3>
          <p className="wr-pc-panel__sub">Série dos últimos {periodLabel}</p>
        </div>
        {placarKpis.length === 0 ? (
          <p className="wr-pc-empty">Dados insuficientes para calcular tendência.</p>
        ) : (
          <div className="wr-pc-placar__grid">
            {placarKpis.map((kpi) => {
              const delta = formatDelta(kpi.deltaPct)
              const isVisits = kpi.id === 'visits'
              const best =
                kpi.series.length > 0
                  ? kpi.series.reduce((a, b) => (b.value > a.value ? b : a)).label
                  : '—'
              return (
                <article
                  key={kpi.id}
                  className={cn('wr-pc-kpi', isVisits && 'wr-pc-kpi--action')}
                  onDoubleClick={isVisits ? onVisitsDoubleClick : undefined}
                  aria-label={isVisits ? 'Visitas no perfil. Duplo clique para informar visitas' : undefined}
                >
                  <p className="wr-pc-kpi__label">{kpi.label}</p>
                  <div className="wr-pc-kpi__row">
                    <strong className="wr-pc-kpi__val tabular-nums">
                      {formatWarRoomNumber(kpi.total)}
                    </strong>
                    <span className={cn('wr-pc-delta', `wr-pc-delta--${delta.tone}`)}>{delta.text}</span>
                  </div>
                  <PlacarSpark kpi={kpi} />
                  <p className="wr-pc-kpi__best">● Melhor dia · {best}</p>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section className="wr-pc-panel wr-pc-themes" aria-label="Poder dos temas">
        <div className="wr-pc-panel__head">
          <h3 className="wr-pc-panel__title">Poder dos temas</h3>
          <p className="wr-pc-panel__sub">Ranking por engajamento médio/post</p>
        </div>
        {themeRank.length === 0 ? (
          <p className="wr-pc-empty">Sem temas classificados nos últimos {periodLabel}.</p>
        ) : (
          <div className="wr-pc-themes__body">
            <ol className="wr-pc-themes__list" key={periodLabel}>
              {themeRank.map((row, index) => {
                const rank = index + 1
                const pct = themeMax > 0 ? Math.round((row.stats.avgEngagement / themeMax) * 100) : 0
                return (
                  <li key={row.theme}>
                    <button type="button" className="wr-pc-theme" onClick={() => onThemeClick(row.theme)}>
                      <span className="wr-pc-theme__rank tabular-nums">{String(rank).padStart(2, '0')}</span>
                      <span className="wr-pc-bar" aria-hidden>
                        <i style={{ width: `${Math.max(pct, row.stats.avgEngagement > 0 ? 8 : 0)}%` }} />
                      </span>
                      <span className="wr-pc-theme__name">
                        <span>{row.theme}</span>
                        {rank === 1 ? (
                          <span className="rc-ios-champ__badge rc-ios-champ__badge--top">TOP</span>
                        ) : null}
                      </span>
                      <span className="wr-pc-theme__sub">
                        {row.stats.posts} posts · {formatWarRoomNumber(row.stats.views)} views
                      </span>
                      <strong className="wr-pc-theme__val tabular-nums">
                        {formatWarRoomNumber(row.stats.avgEngagement)}
                      </strong>
                    </button>
                  </li>
                )
              })}
            </ol>
            <div className="wr-pc-insights">
              <div className="wr-pc-insight">
                <header>
                  <Trophy size={12} strokeWidth={2.2} aria-hidden />
                  Tema dominante
                </header>
                <strong>{themeRank[0]?.theme ?? '—'}</strong>
                <p>
                  {themeRank[0]
                    ? `${formatWarRoomNumber(themeRank[0].stats.avgEngagement)} eng/post`
                    : ''}
                </p>
              </div>
              <div className="wr-pc-insight">
                <header>Em ascensão</header>
                <strong>{risingTheme?.theme ?? '—'}</strong>
                <p>
                  {risingTheme
                    ? `${formatWarRoomNumber(risingTheme.stats.avgEngagement)} eng/post`
                    : 'Sem segundo tema'}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="wr-pc-panel wr-pc-wins" aria-label="Conquistas do período">
        <div className="wr-pc-panel__head">
          <h3 className="wr-pc-panel__title">Conquistas do período</h3>
          <p className="wr-pc-panel__sub">Milestones e destaques alcançados</p>
        </div>
        <div className="wr-pc-wins__rail">
          {wins.map((win) => (
            <article key={win.ico} className="wr-pc-win">
              <span className={cn('wr-pc-win__ico', `wr-pc-win__ico--${win.ico}`)}>
                <win.Icon size={18} strokeWidth={2} aria-hidden />
              </span>
              <strong>{win.title}</strong>
              <em className="tabular-nums">{win.value}</em>
              <span>{win.sub}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
