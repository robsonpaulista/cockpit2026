'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotProps,
  type TooltipProps,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { Eye, Loader2 } from 'lucide-react'
import {
  IconChartBar,
  IconRefresh,
  IconTrendingDown,
  IconTrendingUp,
  IconUsers,
} from '@tabler/icons-react'
import { PremiumMetricCard } from '@/components/premium/metric-card'
import { PremiumSectionHeader } from '@/components/conteudo-redes/premium-section-header'
import { InstagramFollowersDayPostsModal } from '@/components/conteudo-redes/instagram-followers-day-posts-modal'
import type { InstagramHistoryResponse } from '@/lib/instagramApi'
import { fetchInstagramPostsByPublishDate } from '@/lib/instagramApi'
import type { InstagramDayPostRecord } from '@/lib/instagram-engagement-history'
import {
  filterLivePostsByPublishDate,
  mergeInstagramDayPosts,
} from '@/lib/instagram-day-posts'
import {
  buildFollowersHistoryChartData,
  computeOverallAvgEngagement,
  FOLLOWERS_HISTORY_RANGE_OPTIONS,
  formatEngagementValue,
  formatFollowersDelta,
  type FollowersHistoryChartPoint,
  type PostEngagementInput,
} from '@/lib/instagram-followers-history-chart'
import { cn } from '@/lib/utils'
import {
  conteudoRedesAmberTextClass,
  conteudoRedesGhostButtonClass,
  conteudoRedesPillFilterActiveClass,
  conteudoRedesPillFilterIdleClass,
  conteudoRedesTextClass,
} from '@/lib/conteudo-redes-styles'
import type { PopupAnchor } from '@/lib/anchored-popup-position'
import { getChartPointAnchor } from '@/lib/chart-svg-anchor'

type InstagramFollowersHistoryChartProps = {
  metricsHistory: InstagramHistoryResponse | null
  loading: boolean
  dateRange: string
  onDateRangeChange: (range: string) => void
  onRefresh: () => void
  className?: string
  currentFollowers?: number
  posts?: PostEngagementInput[]
  livePosts?: InstagramDayPostRecord[]
}

const FOLLOWERS_COLOR = '#C8900A'
const ENGAGEMENT_COLOR = '#9A6B08'
const GRID_STROKE = 'rgb(var(--color-border-tertiary) / 0.45)'
const TICK_STYLE = { fontSize: 10, fill: '#000000' }

function formatCount(value: number): string {
  return value.toLocaleString('pt-BR')
}

function formatAxisEngagement(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  }
  return formatEngagementValue(value)
}

function FollowersHistoryTooltip({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null

  const variacao = payload.find((p) => p.dataKey === 'variacao')?.value as number | undefined
  const engajamento = payload.find((p) => p.dataKey === 'engajamentoMedio')?.value as
    | number
    | null
    | undefined

  return (
    <div className="min-w-[168px] rounded-xl border border-[rgb(var(--color-border-tertiary)/0.9)] bg-bg-surface/95 px-3 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur-sm">
      <p className={cn('mb-2 text-[11px] font-medium uppercase tracking-[0.04em]', conteudoRedesTextClass)}>
        {label}
      </p>
      <div className="space-y-1.5">
        {typeof variacao === 'number' ? (
          <div className="flex items-center justify-between gap-3">
            <span className={cn('inline-flex items-center gap-1.5 text-[11px]', conteudoRedesTextClass)}>
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ backgroundColor: FOLLOWERS_COLOR }}
                aria-hidden
              />
              Seguidores
            </span>
            <span
              className={cn(
                'text-[12px] font-semibold tabular-nums',
                variacao > 0
                  ? 'text-status-success'
                  : variacao < 0
                    ? 'text-status-error'
                    : conteudoRedesTextClass
              )}
            >
              {formatFollowersDelta(variacao)}
            </span>
          </div>
        ) : null}
        {typeof engajamento === 'number' ? (
          <div className="flex items-center justify-between gap-3">
            <span className={cn('inline-flex items-center gap-1.5 text-[11px]', conteudoRedesTextClass)}>
              <span
                className="h-0.5 w-3 rounded-full border border-dashed"
                style={{ borderColor: ENGAGEMENT_COLOR }}
                aria-hidden
              />
              Engajamento
            </span>
            <span className={cn('text-[12px] font-semibold tabular-nums', conteudoRedesTextClass)}>
              {formatEngagementValue(engajamento)}
            </span>
          </div>
        ) : null}
      </div>
      <p className={cn('mt-2 border-t border-[rgb(var(--color-border-tertiary)/0.5)] pt-2 text-[10px]', conteudoRedesTextClass)}>
        Clique no ponto para ver publicações do dia
      </p>
    </div>
  )
}

export function InstagramFollowersHistoryChart({
  metricsHistory,
  loading,
  dateRange,
  onDateRangeChange,
  onRefresh,
  className,
  currentFollowers,
  posts = [],
  livePosts = [],
}: InstagramFollowersHistoryChartProps) {
  const [selectedPoint, setSelectedPoint] = useState<FollowersHistoryChartPoint | null>(null)
  const [popupAnchor, setPopupAnchor] = useState<PopupAnchor | null>(null)
  const [dayPosts, setDayPosts] = useState<InstagramDayPostRecord[]>([])
  const [loadingDayPosts, setLoadingDayPosts] = useState(false)
  const chartWrapRef = useRef<HTMLDivElement>(null)

  const chartData = useMemo(
    () =>
      buildFollowersHistoryChartData(
        metricsHistory?.history ?? [],
        posts,
        metricsHistory?.publishDayEngagement ?? []
      ),
    [metricsHistory?.history, metricsHistory?.publishDayEngagement, posts]
  )

  const currentAvgEngagement = useMemo(() => computeOverallAvgEngagement(posts), [posts])

  const summary = metricsHistory?.summary
  const hasChartData = chartData.length > 0
  const hasEngagementLine = chartData.some((point) => point.engajamentoMedio != null)

  const resolveChartAnchor = useCallback((cx: number, cy: number): PopupAnchor | null => {
    return getChartPointAnchor(chartWrapRef.current, cx, cy)
  }, [])

  const openDayPosts = useCallback(
    async (point: FollowersHistoryChartPoint, cx: number, cy: number) => {
      const anchor = resolveChartAnchor(cx, cy)
      if (!anchor) return

      const publishDate = point.fullDate.split('T')[0]
      setSelectedPoint(point)
      setPopupAnchor(anchor)
      setLoadingDayPosts(true)

      const fromLive = filterLivePostsByPublishDate(livePosts, publishDate)
      setDayPosts(fromLive)

      try {
        const fromHistory = await fetchInstagramPostsByPublishDate(publishDate)
        setDayPosts(mergeInstagramDayPosts(fromLive, fromHistory))
      } catch {
        setDayPosts(fromLive)
      } finally {
        setLoadingDayPosts(false)
      }
    },
    [livePosts, resolveChartAnchor]
  )

  const closeDayPosts = useCallback(() => {
    setSelectedPoint(null)
    setPopupAnchor(null)
    setDayPosts([])
    setLoadingDayPosts(false)
  }, [])

  const renderFollowerDot = useCallback(
    (props: DotProps & { payload?: FollowersHistoryChartPoint }) => {
      const { cx, cy, payload } = props
      if (cx == null || cy == null || !payload) return <g />

      const point = payload
      const isSelected = selectedPoint?.fullDate === point.fullDate

      return (
        <circle
          cx={cx}
          cy={cy}
          r={isSelected ? 6 : 3.5}
          fill={isSelected ? '#C8900A' : FOLLOWERS_COLOR}
          stroke="rgb(var(--bg-surface))"
          strokeWidth={isSelected ? 2 : 1.5}
          style={{ cursor: 'pointer' }}
          onClick={(event) => {
            event.stopPropagation()
            void openDayPosts(point, cx, cy)
          }}
        />
      )
    },
    [openDayPosts, selectedPoint?.fullDate]
  )

  return (
    <div className={className}>
      <PremiumSectionHeader
        title="Histórico de Seguidores"
        description="Variação diária de seguidores e engajamento médio das publicações feitas em cada dia"
        hint="Passe o mouse para detalhes · clique em um ponto para ver as publicações do dia"
        actions={
          <>
            <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
              {FOLLOWERS_HISTORY_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onDateRangeChange(option.value)}
                  className={cn(
                    dateRange === option.value ? conteudoRedesPillFilterActiveClass : conteudoRedesPillFilterIdleClass
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className={cn(conteudoRedesGhostButtonClass, 'disabled:opacity-50')}
            >
              {loading ? (
                <Loader2 className="h-[14px] w-[14px] animate-spin opacity-70" />
              ) : (
                <IconRefresh className="h-[14px] w-[14px] opacity-70" stroke={1.5} aria-hidden />
              )}
              Atualizar
            </button>
          </>
        }
      />

      {summary && summary.growth !== 0 ? (
        <p
          className={cn(
            'mb-3 flex items-center gap-1 text-[11px]',
            summary.growth > 0 ? 'text-status-success' : 'text-status-error'
          )}
        >
          {summary.growth > 0 ? (
            <IconTrendingUp className="h-3.5 w-3.5" stroke={1.5} aria-hidden />
          ) : (
            <IconTrendingDown className="h-3.5 w-3.5" stroke={1.5} aria-hidden />
          )}
          {formatFollowersDelta(summary.growth)} no período ({summary.growthPercentage}%)
        </p>
      ) : null}

      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:max-w-md">
        {typeof currentFollowers === 'number' ? (
          <PremiumMetricCard
            compact
            label="Seguidores atuais"
            value={formatCount(currentFollowers)}
            icon={IconUsers}
            labelClassName={conteudoRedesTextClass}
            valueClassName={conteudoRedesTextClass}
            iconClassName={conteudoRedesAmberTextClass}
          />
        ) : null}
        {typeof currentAvgEngagement === 'number' && currentAvgEngagement > 0 ? (
          <PremiumMetricCard
            compact
            label="Engajamento médio"
            value={formatEngagementValue(currentAvgEngagement)}
            icon={IconChartBar}
            labelClassName={conteudoRedesTextClass}
            valueClassName={conteudoRedesTextClass}
            iconClassName={conteudoRedesAmberTextClass}
          />
        ) : null}
      </div>

      {loading && !hasChartData ? (
        <div className={cn('flex h-[200px] flex-col items-center justify-center', conteudoRedesTextClass)}>
          <Loader2 className={cn('mb-3 h-7 w-7 animate-spin', conteudoRedesAmberTextClass)} />
          <p className="text-sm">Carregando histórico...</p>
        </div>
      ) : hasChartData ? (
        <>
          {!hasEngagementLine ? (
            <p className={cn('mb-2 text-[11px]', conteudoRedesTextClass)}>
              O engajamento histórico é salvo a cada atualização. Publique conteúdo ou atualize os dados para enriquecer o histórico.
            </p>
          ) : null}
          <div
            ref={chartWrapRef}
            className="relative h-[220px] w-full overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-[linear-gradient(180deg,rgba(200,144,10,0.04)_0%,transparent_42%)] p-2 sm:h-[240px] sm:p-2.5"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 22, right: 4, left: -8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="followersAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8900A" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#C8900A" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke={GRID_STROKE}
                  strokeDasharray="4 6"
                />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={TICK_STYLE}
                  interval="preserveStartEnd"
                  minTickGap={28}
                  dy={6}
                />
                <YAxis
                  yAxisId="followers"
                  axisLine={false}
                  tickLine={false}
                  tick={TICK_STYLE}
                  tickFormatter={(value: number) => formatFollowersDelta(value)}
                  width={44}
                />
                <YAxis
                  yAxisId="engagement"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ ...TICK_STYLE, fill: ENGAGEMENT_COLOR }}
                  tickFormatter={formatAxisEngagement}
                  width={40}
                  hide={!hasEngagementLine}
                />
                <ReferenceLine
                  yAxisId="followers"
                  y={0}
                  stroke={GRID_STROKE}
                  strokeWidth={1}
                />
                {selectedPoint ? (
                  <ReferenceLine
                    x={selectedPoint.date}
                    stroke="rgba(200, 144, 10, 0.2)"
                    strokeDasharray="3 4"
                  />
                ) : null}
                <Tooltip
                  content={<FollowersHistoryTooltip />}
                  cursor={{
                    stroke: 'rgba(200, 144, 10, 0.25)',
                    strokeWidth: 1,
                    strokeDasharray: '4 4',
                  }}
                />
                <Area
                  yAxisId="followers"
                  type="monotone"
                  dataKey="variacao"
                  fill="url(#followersAreaGradient)"
                  stroke="none"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="followers"
                  type="monotone"
                  dataKey="variacao"
                  name="variacao"
                  stroke={FOLLOWERS_COLOR}
                  strokeWidth={2}
                  dot={renderFollowerDot}
                  activeDot={false}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="variacao"
                    content={(props) => {
                      const x = typeof props.x === 'number' ? props.x : Number(props.x)
                      const y = typeof props.y === 'number' ? props.y : Number(props.y)
                      const value = typeof props.value === 'number' ? props.value : Number(props.value)
                      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(value)) return null

                      const fill =
                        value > 0
                          ? 'rgb(var(--status-success))'
                          : value < 0
                            ? 'rgb(var(--status-danger))'
                            : 'rgb(var(--text-muted))'
                      const dy = value >= 0 ? -9 : 11

                      return (
                        <text
                          x={x}
                          y={y}
                          dy={dy}
                          fill={fill}
                          fontSize={9}
                          fontWeight={600}
                          textAnchor="middle"
                          style={{ pointerEvents: 'none' }}
                        >
                          {formatFollowersDelta(value)}
                        </text>
                      )
                    }}
                  />
                </Line>
                {hasEngagementLine ? (
                  <Line
                    yAxisId="engagement"
                    type="monotone"
                    dataKey="engajamentoMedio"
                    name="engajamentoMedio"
                    stroke={ENGAGEMENT_COLOR}
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    strokeOpacity={0.9}
                    connectNulls={false}
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: ENGAGEMENT_COLOR,
                      stroke: 'rgb(var(--bg-surface))',
                      strokeWidth: 2,
                    }}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="engajamentoMedio"
                      content={(props) => {
                        const x = typeof props.x === 'number' ? props.x : Number(props.x)
                        const y = typeof props.y === 'number' ? props.y : Number(props.y)
                        const value = typeof props.value === 'number' ? props.value : Number(props.value)
                        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(value)) return null

                        return (
                          <text
                            x={x}
                            y={y}
                            dy={12}
                            fill={ENGAGEMENT_COLOR}
                            fontSize={9}
                            fontWeight={600}
                            textAnchor="middle"
                            style={{ pointerEvents: 'none' }}
                          >
                            {formatEngagementValue(value)}
                          </text>
                        )
                      }}
                    />
                  </Line>
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-start">
            <span className={cn('inline-flex items-center gap-2 text-[11px]', conteudoRedesTextClass)}>
              <span
                className="h-0.5 w-5 rounded-full"
                style={{ backgroundColor: FOLLOWERS_COLOR }}
                aria-hidden
              />
              Variação de seguidores
            </span>
            {hasEngagementLine ? (
              <span className={cn('inline-flex items-center gap-2 text-[11px]', conteudoRedesTextClass)}>
                <span
                  className="h-0 w-5 border-t-[1.5px] border-dashed"
                  style={{ borderColor: ENGAGEMENT_COLOR }}
                  aria-hidden
                />
                Engajamento médio
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <div className={cn('flex h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-card', conteudoRedesTextClass)}>
          <Eye className="mb-2 h-8 w-8 opacity-50" />
          {(metricsHistory?.history?.length ?? 0) === 1 ? (
            <>
              <p className="text-sm">Ainda há apenas um registro no histórico</p>
              <p className="mt-1 text-xs">A variação diária aparece a partir do segundo dia coletado</p>
            </>
          ) : (
            <>
              <p className="text-sm">Dados de histórico serão coletados automaticamente</p>
              <p className="mt-1 text-xs">Volte amanhã para ver a evolução dos seguidores</p>
            </>
          )}
        </div>
      )}

      <InstagramFollowersDayPostsModal
        open={selectedPoint != null}
        onClose={closeDayPosts}
        anchor={popupAnchor}
        publishDate={selectedPoint?.fullDate.split('T')[0] ?? ''}
        displayDate={selectedPoint?.date ?? ''}
        followerDelta={selectedPoint?.variacao ?? 0}
        avgEngagement={selectedPoint?.engajamentoMedio}
        posts={dayPosts}
        loading={loadingDayPosts}
      />
    </div>
  )
}
