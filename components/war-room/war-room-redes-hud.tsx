'use client'

import { useMemo, type ReactNode } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Eye,
  Heart,
  MessageCircle,
  Minus,
  Share2,
  Users,
  Video,
} from 'lucide-react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import type { WarRoomDesempenhoKpi } from '@/components/war-room/war-room-redes-desempenho-view'
import { cn } from '@/lib/utils'

type Props = {
  periodLabel: string
  kpis: WarRoomDesempenhoKpi[]
  onVisitsDoubleClick: () => void
}

const MERGED_CHART_IDS = new Set(['visits', 'followers'])
const MERGED_CHART_ANCHOR = 'visits-followers'

function formatDelta(deltaPct: number | null): { text: string; tone: 'up' | 'down' | 'flat'; abs: string } {
  if (deltaPct == null || !Number.isFinite(deltaPct)) {
    return { text: '—', abs: '—', tone: 'flat' }
  }
  const tone = deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'flat'
  const abs = `${Math.abs(deltaPct).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}%`
  const sign = deltaPct > 0 ? '↑ ' : deltaPct < 0 ? '↓ ' : ''
  return { text: `${sign}${abs}`, abs, tone }
}

function trendAria(tone: 'up' | 'down' | 'flat'): string {
  if (tone === 'up') return 'Tendência de alta'
  if (tone === 'down') return 'Tendência de queda'
  return 'Tendência estável'
}

function TrendMark({ tone }: { tone: 'up' | 'down' | 'flat' }) {
  return (
    <span className={cn('wr-rs-menu__trend', `is-${tone}`)} aria-label={trendAria(tone)} title={trendAria(tone)}>
      {tone === 'up' ? <ArrowUpRight size={11} strokeWidth={2.4} aria-hidden /> : null}
      {tone === 'down' ? <ArrowDownRight size={11} strokeWidth={2.4} aria-hidden /> : null}
      {tone === 'flat' ? <Minus size={11} strokeWidth={2.4} aria-hidden /> : null}
    </span>
  )
}

function kpiIcon(id: string) {
  switch (id) {
    case 'views':
      return Eye
    case 'story-views':
      return Video
    case 'visits':
    case 'followers':
      return Users
    case 'engagement':
    case 'likes':
      return Heart
    case 'comments':
      return MessageCircle
    case 'shares':
      return Share2
    default:
      return BarChart3
  }
}

function DeltaPill({ delta }: { delta: ReturnType<typeof formatDelta> }) {
  return (
    <span className={cn('wr-rs-delta', `wr-rs-delta--${delta.tone}`)}>
      {delta.tone === 'up' ? <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden /> : null}
      {delta.tone === 'down' ? <ArrowDownRight size={12} strokeWidth={2.4} aria-hidden /> : null}
      {delta.abs}
    </span>
  )
}

function Card({
  className,
  children,
  id,
}: {
  className?: string
  children: ReactNode
  id?: string
}) {
  return (
    <article id={id} className={cn('wr-rs-card', className)}>
      {children}
    </article>
  )
}

function IndicatorChart({
  kpi,
  chartType,
}: {
  kpi: WarRoomDesempenhoKpi
  chartType: 'area' | 'bar'
}) {
  const data = kpi.series
  if (data.length < 2) {
    return <p className="wr-rs-empty">Série insuficiente para o gráfico neste período.</p>
  }

  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 26, right: 28, left: 14, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="rgba(43,45,49,0.08)" strokeDasharray="3 6" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#70737a' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(43,45,49,0.12)' }}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: '1px solid rgba(43,45,49,0.12)',
              fontSize: 12,
            }}
            formatter={(value: number) => [formatWarRoomNumber(value), kpi.label]}
          />
          <Bar dataKey="value" name={kpi.id} fill="#f2d06b" radius={[6, 6, 0, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="value"
              position="top"
              offset={6}
              style={{ fontSize: 10, fontWeight: 600, fill: '#2b2d31' }}
              formatter={(v: number) => (v === 0 ? '' : formatWarRoomNumber(v))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 26, right: 28, left: 14, bottom: 4 }}>
        <defs>
          <linearGradient id={`wr-rs-fill-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2d06b" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#f2d06b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(43,45,49,0.08)" strokeDasharray="3 6" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#70737a' }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(43,45,49,0.12)' }}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 10,
            border: '1px solid rgba(43,45,49,0.12)',
            fontSize: 12,
          }}
          formatter={(value: number) => [formatWarRoomNumber(value), kpi.label]}
        />
        <Area
          type="monotone"
          dataKey="value"
          name={kpi.id}
          stroke="#f2d06b"
          strokeWidth={2.4}
          fill={`url(#wr-rs-fill-${kpi.id})`}
          dot={{ r: 3, fill: '#f2d06b', stroke: '#2b2d31', strokeWidth: 1 }}
          activeDot={{ r: 4, fill: '#f2d06b', stroke: '#2b2d31', strokeWidth: 1.5 }}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="value"
            position="top"
            offset={8}
            style={{ fontSize: 10, fontWeight: 600, fill: '#2b2d31' }}
            formatter={(v: number) => (v === 0 ? '' : formatWarRoomNumber(v))}
          />
        </Area>
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function VisitsFollowersChart({
  visits,
  followers,
}: {
  visits: WarRoomDesempenhoKpi
  followers: WarRoomDesempenhoKpi
}) {
  const data = useMemo(() => {
    const byDate = new Map<
      string,
      { label: string; visitas: number; seguidores: number; conversao: number | null }
    >()
    for (const p of visits.series) {
      byDate.set(p.date, {
        label: p.label,
        visitas: p.value,
        seguidores: 0,
        conversao: null,
      })
    }
    for (const p of followers.series) {
      const cur = byDate.get(p.date) ?? {
        label: p.label,
        visitas: 0,
        seguidores: 0,
        conversao: null,
      }
      cur.seguidores = p.value
      cur.label = p.label
      byDate.set(p.date, cur)
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, row]) => ({
        ...row,
        conversao: row.visitas > 0 ? (Math.max(0, row.seguidores) / row.visitas) * 100 : null,
      }))
  }, [visits.series, followers.series])

  if (data.length < 2) {
    return <p className="wr-rs-empty">Série insuficiente para o gráfico neste período.</p>
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 26, right: 28, left: 14, bottom: 4 }}>
        <defs>
          <linearGradient id="wr-rs-fill-visitas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2d06b" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#f2d06b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(43,45,49,0.08)" strokeDasharray="3 6" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#70737a' }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(43,45,49,0.12)' }}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 10,
            border: '1px solid rgba(43,45,49,0.12)',
            fontSize: 12,
          }}
          labelFormatter={(label, payload) => {
            const conv = (payload?.[0]?.payload as { conversao?: number | null } | undefined)
              ?.conversao
            if (conv == null || !Number.isFinite(conv)) return String(label)
            return `${label} · conversão ${conv.toLocaleString('pt-BR', {
              maximumFractionDigits: 1,
            })}%`
          }}
          formatter={(value: number, name: string) => [
            formatWarRoomNumber(value),
            name === 'visitas' ? 'Visitas ao perfil' : 'Novos seguidores',
          ]}
        />
        <Area
          type="monotone"
          dataKey="visitas"
          name="visitas"
          stroke="#f2d06b"
          strokeWidth={2.4}
          fill="url(#wr-rs-fill-visitas)"
          dot={{ r: 3, fill: '#f2d06b', stroke: '#2b2d31', strokeWidth: 1 }}
          activeDot={{ r: 4, fill: '#f2d06b', stroke: '#2b2d31', strokeWidth: 1.5 }}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="visitas"
            position="top"
            offset={8}
            style={{ fontSize: 10, fontWeight: 600, fill: '#8a7340' }}
            formatter={(v: number) => (v === 0 ? '' : formatWarRoomNumber(v))}
          />
        </Area>
        <Line
          type="monotone"
          dataKey="seguidores"
          name="seguidores"
          stroke="#2b2d31"
          strokeWidth={2.2}
          dot={{ r: 3, fill: '#2b2d31', stroke: '#fff', strokeWidth: 1.5 }}
          activeDot={{ r: 4, fill: '#2b2d31', stroke: '#fff', strokeWidth: 2 }}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="seguidores"
            position="top"
            offset={8}
            style={{ fontSize: 10, fontWeight: 600, fill: '#2b2d31' }}
            formatter={(v: number) => (v === 0 ? '' : formatWarRoomNumber(v))}
          />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function WarRoomRedesHud({ periodLabel, kpis, onVisitsDoubleClick }: Props) {
  const visitsKpi = kpis.find((k) => k.id === 'visits')
  const followersKpi = kpis.find((k) => k.id === 'followers')
  const soloKpis = useMemo(() => kpis.filter((k) => !MERGED_CHART_IDS.has(k.id)), [kpis])

  const menuItems = useMemo(() => {
    const items: Array<{
      id: string
      href: string
      label: string
      legend: string
      valueText: string
      delta: ReturnType<typeof formatDelta>
      iconId: string
      onDoubleClick?: () => void
      title?: string
    }> = []

    for (const kpi of kpis) {
      if (MERGED_CHART_IDS.has(kpi.id)) continue
      items.push({
        id: kpi.id,
        href: `#wr-rs-chart-${kpi.id}`,
        label: kpi.label,
        legend: kpi.legend || 'Evolução no período',
        valueText: kpi.valueLabel ?? formatWarRoomNumber(kpi.total),
        delta: formatDelta(kpi.deltaPct),
        iconId: kpi.id,
      })
    }

    if (visitsKpi || followersKpi) {
      const visitas = visitsKpi?.total ?? 0
      const seguidores = followersKpi?.total ?? 0
      const conversionPct = visitas > 0 ? (Math.max(0, seguidores) / visitas) * 100 : null
      const conversionText =
        conversionPct == null
          ? '—'
          : `${conversionPct.toLocaleString('pt-BR', {
              maximumFractionDigits: 1,
              minimumFractionDigits: 0,
            })}%`
      items.splice(Math.min(2, items.length), 0, {
        id: MERGED_CHART_ANCHOR,
        href: `#wr-rs-chart-${MERGED_CHART_ANCHOR}`,
        label: 'Visitas → Seguidores',
        legend:
          visitas > 0
            ? `${formatWarRoomNumber(visitas)} visitas · ${seguidores > 0 ? '+' : ''}${formatWarRoomNumber(seguidores)} seg.`
            : 'Conversão visita → seguidor no período',
        valueText: conversionText,
        delta: formatDelta(followersKpi?.deltaPct ?? visitsKpi?.deltaPct ?? null),
        iconId: 'visits',
        onDoubleClick: onVisitsDoubleClick,
        title: 'Duplo clique para informar visitas ao perfil',
      })
    }

    return items
  }, [kpis, visitsKpi, followersKpi, onVisitsDoubleClick])

  const conversionLabel = useMemo(() => {
    const visitas = visitsKpi?.total ?? 0
    const seguidores = followersKpi?.total ?? 0
    if (visitas <= 0) return null
    const pct = seguidores <= 0 ? 0 : (seguidores / visitas) * 100
    return `${pct.toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    })}%`
  }, [visitsKpi?.total, followersKpi?.total])

  return (
    <div className="wr-rs">
      <section className="wr-rs-explorer" aria-label="Indicadores e evolução">
        <aside className="wr-rs-menu" aria-label="Menu de indicadores">
          <div className="wr-rs-menu__head">
            <h3 className="wr-rs-menu__title">Indicadores</h3>
            <p className="wr-rs-menu__period">{periodLabel} · até ontem</p>
          </div>
          <ul className="wr-rs-menu__list" aria-label="Indicadores gerais">
            {menuItems.map((item) => {
              const Icon = kpiIcon(item.iconId)
              return (
                <li key={item.id}>
                  <a
                    href={item.href}
                    className="wr-rs-menu__item"
                    onDoubleClick={(e) => {
                      if (!item.onDoubleClick) return
                      e.preventDefault()
                      item.onDoubleClick()
                    }}
                    title={item.title}
                  >
                    <span className="wr-rs-menu__ico" aria-hidden>
                      <Icon size={12} strokeWidth={2.2} />
                    </span>
                    <span className="wr-rs-menu__lines">
                      <span className="wr-rs-menu__line wr-rs-menu__line--1">
                        <strong>{item.label}</strong>
                        <TrendMark tone={item.delta.tone} />
                      </span>
                      <span className="wr-rs-menu__line wr-rs-menu__line--2">{item.legend}</span>
                      <span className="wr-rs-menu__line wr-rs-menu__line--3">
                        <span className="wr-rs-menu__value tabular-nums">{item.valueText}</span>
                        <DeltaPill delta={item.delta} />
                      </span>
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </aside>

        <div className="wr-rs-charts" id="wr-rs-evolution">
          <div className="wr-rs-charts__head">
            <div>
              <p className="wr-rs-kicker">Evolução no período</p>
              <h3 className="wr-rs-charts__title">
                Todos os indicadores · {periodLabel} · até ontem
              </h3>
            </div>
          </div>

          {kpis.length === 0 ? (
            <p className="wr-rs-empty">Nenhum indicador disponível.</p>
          ) : (
            <div className="wr-rs-charts__grid">
              {(visitsKpi || followersKpi) && (
                <Card
                  className="wr-rs-chart-card"
                  id={`wr-rs-chart-${MERGED_CHART_ANCHOR}`}
                >
                  <div className="wr-rs-chart-card__head wr-rs-chart-card__head--compact">
                    <h4 className="wr-rs-chart-card__title">
                      <Users size={14} strokeWidth={2.2} aria-hidden />
                      Visitas × Seguidores
                    </h4>
                    <div className="wr-rs-chart-card__inline" aria-label="Resumo">
                      <span>
                        <em>Visitas</em>
                        <strong className="tabular-nums">
                          {formatWarRoomNumber(visitsKpi?.total ?? 0)}
                        </strong>
                      </span>
                      <span>
                        <em>Seg.</em>
                        <strong className="tabular-nums">
                          {(followersKpi?.total ?? 0) > 0 ? '+' : ''}
                          {formatWarRoomNumber(followersKpi?.total ?? 0)}
                        </strong>
                      </span>
                      <span className="is-accent">
                        <em>Conv.</em>
                        <strong className="tabular-nums">{conversionLabel ?? '—'}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="wr-rs-chart-card__body">
                    <VisitsFollowersChart
                      visits={
                        visitsKpi ?? {
                          id: 'visits',
                          label: 'Visitas ao perfil',
                          total: 0,
                          deltaPct: null,
                          series: [],
                        }
                      }
                      followers={
                        followersKpi ?? {
                          id: 'followers',
                          label: 'Seguidores',
                          total: 0,
                          deltaPct: null,
                          series: [],
                        }
                      }
                    />
                  </div>
                </Card>
              )}

              {soloKpis.map((kpi, index) => {
                const delta = formatDelta(kpi.deltaPct)
                const Icon = kpiIcon(kpi.id)
                // Alterna linha / coluna na grade (o card combinado já ocupa o 1º slot em linha).
                const chartSlot = (visitsKpi || followersKpi ? 1 : 0) + index
                const chartType = chartSlot % 2 === 0 ? 'area' : 'bar'
                const valueText = kpi.valueLabel ?? formatWarRoomNumber(kpi.total)
                return (
                  <Card key={kpi.id} className="wr-rs-chart-card" id={`wr-rs-chart-${kpi.id}`}>
                    <div className="wr-rs-chart-card__head wr-rs-chart-card__head--compact">
                      <h4 className="wr-rs-chart-card__title">
                        <Icon size={14} strokeWidth={2.2} aria-hidden />
                        {kpi.label}
                      </h4>
                      <div className="wr-rs-chart-card__inline">
                        <span>
                          <strong className="tabular-nums">{valueText}</strong>
                        </span>
                        <DeltaPill delta={delta} />
                      </div>
                    </div>
                    <div className="wr-rs-chart-card__body">
                      <IndicatorChart kpi={kpi} chartType={chartType} />
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
