'use client'

import { useMemo, useState, type ReactNode } from 'react'
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
  type LucideIcon,
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
import { TsePill, TseVazio, tseCardClass } from '@/components/tse/tse-ui'

type Props = {
  periodLabel: string
  kpis: WarRoomDesempenhoKpi[]
  onVisitsDoubleClick: () => void
}

const MERGED_CHART_IDS = new Set(['visits', 'followers'])

type DeltaTone = 'up' | 'down' | 'flat'

function formatDelta(deltaPct: number | null): { abs: string; tone: DeltaTone } {
  if (deltaPct == null || !Number.isFinite(deltaPct)) {
    return { abs: '—', tone: 'flat' }
  }
  const tone: DeltaTone = deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'flat'
  const abs = `${Math.abs(deltaPct).toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}%`
  return { abs, tone }
}

function kpiIcon(id: string): LucideIcon {
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

function DeltaMark({ tone, abs }: { tone: DeltaTone; abs: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums',
        tone === 'up' && 'text-[var(--tse-olive)]',
        tone === 'down' && 'text-[#b45309]',
        tone === 'flat' && 'text-[var(--tse-muted)]',
      )}
    >
      {tone === 'up' ? <ArrowUpRight size={12} strokeWidth={2.4} aria-hidden /> : null}
      {tone === 'down' ? <ArrowDownRight size={12} strokeWidth={2.4} aria-hidden /> : null}
      {tone === 'flat' ? <Minus size={12} strokeWidth={2.4} aria-hidden /> : null}
      {abs}
    </span>
  )
}

function ChartShell({
  children,
  heightClass = 'h-[200px]',
}: {
  children: ReactNode
  heightClass?: string
}) {
  return <div className={cn('w-full', heightClass)}>{children}</div>
}

const tooltipStyle = {
  borderRadius: 10,
  border: '1px solid var(--tse-border, #ddd)',
  fontSize: 12,
  background: '#fff',
  color: 'var(--tse-text, #333)',
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
    return (
      <p className="flex h-full items-center justify-center text-[12px] text-[var(--tse-muted)]">
        Série insuficiente neste período.
      </p>
    )
  }

  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgba(51,51,51,0.08)" strokeDasharray="3 6" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#717171' }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(51,51,51,0.12)' }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [formatWarRoomNumber(value), kpi.label]}
          />
          <Bar dataKey="value" name={kpi.id} fill="#EBB402" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            <LabelList
              dataKey="value"
              position="top"
              offset={4}
              style={{ fontSize: 10, fontWeight: 600, fill: '#333' }}
              formatter={(v: number) => (v === 0 ? '' : formatWarRoomNumber(v))}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 18, right: 12, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={`tse-rs-fill-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EBB402" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#EBB402" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(51,51,51,0.08)" strokeDasharray="3 6" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#717171' }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(51,51,51,0.12)' }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number) => [formatWarRoomNumber(value), kpi.label]}
        />
        <Area
          type="monotone"
          dataKey="value"
          name={kpi.id}
          stroke="#EBB402"
          strokeWidth={2.2}
          fill={`url(#tse-rs-fill-${kpi.id})`}
          dot={{ r: 2.5, fill: '#EBB402', stroke: '#333', strokeWidth: 1 }}
          activeDot={{ r: 4, fill: '#EBB402', stroke: '#333', strokeWidth: 1.5 }}
          isAnimationActive={false}
        >
          <LabelList
            dataKey="value"
            position="top"
            offset={6}
            style={{ fontSize: 10, fontWeight: 600, fill: '#333' }}
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
    return (
      <p className="flex h-full items-center justify-center text-[12px] text-[var(--tse-muted)]">
        Série insuficiente neste período.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 18, right: 12, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="tse-rs-fill-visitas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EBB402" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#EBB402" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(51,51,51,0.08)" strokeDasharray="3 6" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#717171' }}
          tickLine={false}
          axisLine={{ stroke: 'rgba(51,51,51,0.12)' }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
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
          stroke="#EBB402"
          strokeWidth={2.2}
          fill="url(#tse-rs-fill-visitas)"
          dot={{ r: 2.5, fill: '#EBB402', stroke: '#333', strokeWidth: 1 }}
          activeDot={{ r: 4, fill: '#EBB402', stroke: '#333', strokeWidth: 1.5 }}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="seguidores"
          name="seguidores"
          stroke="#333333"
          strokeWidth={2}
          dot={{ r: 2.5, fill: '#333', stroke: '#fff', strokeWidth: 1.5 }}
          activeDot={{ r: 4, fill: '#333', stroke: '#fff', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

type KpiStripItem = {
  id: string
  label: string
  legend: string
  valueText: string
  delta: ReturnType<typeof formatDelta>
  iconId: string
  onDoubleClick?: () => void
  title?: string
}

/**
 * Painel TSE de Redes — faixa de KPIs + gráfico destaque + grade compacta.
 */
export function WarRoomRedesHud({ periodLabel, kpis, onVisitsDoubleClick }: Props) {
  const visitsKpi = kpis.find((k) => k.id === 'visits')
  const followersKpi = kpis.find((k) => k.id === 'followers')
  const soloKpis = useMemo(() => kpis.filter((k) => !MERGED_CHART_IDS.has(k.id)), [kpis])

  const [focusId, setFocusId] = useState<string>('visits-followers')

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

  const stripItems = useMemo((): KpiStripItem[] => {
    const items: KpiStripItem[] = []

    if (visitsKpi || followersKpi) {
      const visitas = visitsKpi?.total ?? 0
      const seguidores = followersKpi?.total ?? 0
      items.push({
        id: 'visits-followers',
        label: 'Visitas → Seguidores',
        legend:
          visitas > 0
            ? `${formatWarRoomNumber(visitas)} visitas · ${seguidores > 0 ? '+' : ''}${formatWarRoomNumber(seguidores)} seg.`
            : 'Conversão no período',
        valueText: conversionLabel ?? '—',
        delta: formatDelta(followersKpi?.deltaPct ?? visitsKpi?.deltaPct ?? null),
        iconId: 'visits',
        onDoubleClick: onVisitsDoubleClick,
        title: 'Duplo clique para informar visitas ao perfil (Meta Insights)',
      })
    }

    for (const kpi of soloKpis) {
      items.push({
        id: kpi.id,
        label: kpi.label,
        legend: kpi.legend || `${periodLabel} · até ontem`,
        valueText: kpi.valueLabel ?? formatWarRoomNumber(kpi.total),
        delta: formatDelta(kpi.deltaPct),
        iconId: kpi.id,
      })
    }

    return items
  }, [soloKpis, visitsKpi, followersKpi, conversionLabel, onVisitsDoubleClick, periodLabel])

  const focusedSolo = soloKpis.find((k) => k.id === focusId) ?? null
  const focusIsMerged = focusId === 'visits-followers'

  if (kpis.length === 0) {
    return <TseVazio>Nenhum indicador disponível neste período.</TseVazio>
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7"
        role="list"
        aria-label="Indicadores do período"
      >
        {stripItems.map((item) => {
          const Icon = kpiIcon(item.iconId)
          const active = focusId === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="listitem"
              title={item.title}
              aria-pressed={active}
              onClick={() => setFocusId(item.id)}
              onDoubleClick={(e) => {
                if (!item.onDoubleClick) return
                e.preventDefault()
                item.onDoubleClick()
              }}
              className={cn(
                'rounded-xl px-3 py-2.5 text-left shadow-sm transition-colors',
                active
                  ? 'bg-[var(--tse-yellow-soft)] ring-1 ring-[var(--tse-yellow)]'
                  : 'bg-white hover:bg-[var(--tse-bar)]',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--tse-yellow-soft)] text-[var(--tse-yellow)]">
                  <Icon size={14} strokeWidth={2.2} aria-hidden />
                </span>
                <DeltaMark tone={item.delta.tone} abs={item.delta.abs} />
              </div>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                {item.label}
              </p>
              <p className="mt-0.5 text-[20px] font-bold tabular-nums leading-none text-[var(--tse-text)]">
                {item.valueText}
              </p>
              <p className="mt-1 line-clamp-1 text-[11px] text-[var(--tse-muted)]">{item.legend}</p>
            </button>
          )
        })}
      </div>

      <p className="text-[12px] text-[var(--tse-muted)]">
        {periodLabel} · até ontem
        {visitsKpi ? (
          <>
            {' · '}
            <span className="font-semibold text-[var(--tse-text)]">
              Duplo clique em Visitas → Seguidores
            </span>{' '}
            para informar visitas manuais (Meta Insights)
          </>
        ) : null}
      </p>

      <section className={cn(tseCardClass, '!p-4')}>
        {focusIsMerged && (visitsKpi || followersKpi) ? (
          <>
            <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-bold text-[var(--tse-text)]">
                  Visitas × Seguidores
                </h3>
                <p className="text-[12px] text-[var(--tse-muted)]">
                  Evolução diária · conversão visita → seguidor
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <TsePill tom="neutro">
                  Visitas {formatWarRoomNumber(visitsKpi?.total ?? 0)}
                </TsePill>
                <TsePill tom="amarelo">
                  Seg. {(followersKpi?.total ?? 0) > 0 ? '+' : ''}
                  {formatWarRoomNumber(followersKpi?.total ?? 0)}
                </TsePill>
                <TsePill tom="verde">Conv. {conversionLabel ?? '—'}</TsePill>
              </div>
            </header>
            <ChartShell heightClass="h-[240px] sm:h-[280px]">
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
            </ChartShell>
          </>
        ) : focusedSolo ? (
          <>
            <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-bold text-[var(--tse-text)]">{focusedSolo.label}</h3>
                <p className="text-[12px] text-[var(--tse-muted)]">
                  {focusedSolo.legend || `${periodLabel} · até ontem`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[22px] font-bold tabular-nums text-[var(--tse-text)]">
                  {focusedSolo.valueLabel ?? formatWarRoomNumber(focusedSolo.total)}
                </span>
                <DeltaMark {...formatDelta(focusedSolo.deltaPct)} />
              </div>
            </header>
            <ChartShell heightClass="h-[240px] sm:h-[280px]">
              <IndicatorChart kpi={focusedSolo} chartType="area" />
            </ChartShell>
          </>
        ) : (
          <TseVazio>Selecione um indicador acima.</TseVazio>
        )}
      </section>

      {soloKpis.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {soloKpis.map((kpi, index) => {
            const delta = formatDelta(kpi.deltaPct)
            const Icon = kpiIcon(kpi.id)
            const chartType = index % 2 === 0 ? 'bar' : 'area'
            const active = focusId === kpi.id
            return (
              <article
                key={kpi.id}
                className={cn(
                  tseCardClass,
                  '!p-3 cursor-pointer transition-shadow',
                  active && 'ring-1 ring-[var(--tse-yellow)]',
                )}
                onClick={() => setFocusId(kpi.id)}
              >
                <header className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--tse-text)]">
                      <Icon size={14} className="shrink-0 text-[var(--tse-yellow)]" strokeWidth={2.2} aria-hidden />
                      <span className="truncate">{kpi.label}</span>
                    </h4>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[15px] font-bold tabular-nums text-[var(--tse-text)]">
                      {kpi.valueLabel ?? formatWarRoomNumber(kpi.total)}
                    </span>
                    <DeltaMark tone={delta.tone} abs={delta.abs} />
                  </div>
                </header>
                <ChartShell heightClass="h-[160px]">
                  <IndicatorChart kpi={kpi} chartType={chartType} />
                </ChartShell>
              </article>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
