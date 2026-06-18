'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotProps,
} from 'recharts'
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
import { ghostButtonClass, pillFilterActiveClass, pillFilterIdleClass } from '@/lib/premium-ui-classes'
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

function formatCount(value: number): string {
  return value.toLocaleString('pt-BR')
}

const ENGAGEMENT_LINE_COLOR = '#6366f1'

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

  return (
    <div className={className}>
      <PremiumSectionHeader
        title="Histórico de Seguidores"
        description="Variação diária de seguidores e engajamento médio das publicações feitas em cada dia"
        hint="Clique em um ponto da linha de seguidores para ver as publicações daquele dia."
        actions={
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {FOLLOWERS_HISTORY_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onDateRangeChange(option.value)}
                  className={cn(
                    dateRange === option.value ? pillFilterActiveClass : pillFilterIdleClass
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
              className={cn(ghostButtonClass, 'disabled:opacity-50')}
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
            'mb-4 flex items-center gap-1 text-[11px]',
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

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        {typeof currentFollowers === 'number' ? (
          <PremiumMetricCard
            label="Seguidores atuais"
            value={formatCount(currentFollowers)}
            icon={IconUsers}
          />
        ) : null}
        {typeof currentAvgEngagement === 'number' && currentAvgEngagement > 0 ? (
          <PremiumMetricCard
            label="Engajamento médio"
            value={formatEngagementValue(currentAvgEngagement)}
            icon={IconChartBar}
          />
        ) : null}
      </div>

      {loading && !hasChartData ? (
        <div className="flex h-[300px] flex-col items-center justify-center text-secondary">
          <Loader2 className="mb-3 h-7 w-7 animate-spin text-[rgb(var(--color-primary))]" />
          <p className="text-sm">Carregando histórico...</p>
        </div>
      ) : hasChartData ? (
        <>
          {!hasEngagementLine ? (
            <p className="mb-2 text-xs text-secondary">
              O engajamento histórico é salvo a cada atualização. Publique conteúdo ou atualize os dados para enriquecer o histórico.
            </p>
          ) : null}
          <div
            ref={chartWrapRef}
            className="h-[320px] w-full rounded-xl border border-card bg-background/60 p-2 sm:h-[340px] sm:p-3"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 32, right: 16, left: 4, bottom: 8 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'rgb(var(--text-secondary))' }}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="followers"
                  tick={{ fontSize: 11, fill: 'rgb(var(--text-secondary))' }}
                  tickFormatter={(value: number) => formatFollowersDelta(value)}
                  width={48}
                />
                <YAxis
                  yAxisId="engagement"
                  orientation="right"
                  tick={{ fontSize: 11, fill: ENGAGEMENT_LINE_COLOR }}
                  tickFormatter={(value: number) => formatEngagementValue(value)}
                  width={52}
                />
                <ReferenceLine yAxisId="followers" y={0} stroke="rgb(var(--border-card))" strokeWidth={1.5} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgb(var(--bg-surface))',
                    border: '1px solid rgb(var(--border-card))',
                    borderRadius: '0.75rem',
                    fontSize: '12px',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'variacao') {
                      return [formatFollowersDelta(value), 'Variação de seguidores']
                    }
                    return [formatEngagementValue(value), 'Engajamento médio']
                  }}
                  labelFormatter={(label) => `Dia: ${label} · clique no ponto para ver posts`}
                />
                <Legend
                  formatter={(value) =>
                    value === 'variacao' ? 'Variação de seguidores' : 'Engajamento médio'
                  }
                />
                <Line
                  yAxisId="followers"
                  type="monotone"
                  dataKey="variacao"
                  name="variacao"
                  stroke="rgb(var(--accent-gold))"
                  strokeWidth={2.5}
                  dot={(props) => {
                    const { cx, cy, payload } = props
                    if (cx == null || cy == null || !payload) {
                      return <g />
                    }

                    const point = payload as FollowersHistoryChartPoint
                    const isSelected = selectedPoint?.fullDate === point.fullDate
                    const color =
                      point.variacao > 0
                        ? 'rgb(var(--status-success))'
                        : point.variacao < 0
                          ? 'rgb(var(--status-danger))'
                          : 'rgb(var(--text-secondary))'

                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isSelected ? 7 : 5}
                        fill={color}
                        stroke={isSelected ? 'rgb(var(--accent-gold))' : 'rgb(var(--bg-surface))'}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        style={{ cursor: 'pointer' }}
                        onClick={(event) => {
                          event.stopPropagation()
                          void openDayPosts(point, cx, cy)
                        }}
                      />
                    )
                  }}
                  activeDot={(props: DotProps & { payload?: FollowersHistoryChartPoint }) => {
                    const { cx, cy, payload } = props
                    if (cx == null || cy == null || !payload) return <g />

                    const point = payload as FollowersHistoryChartPoint

                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7}
                        fill="rgb(var(--accent-gold))"
                        stroke="rgb(var(--bg-surface))"
                        strokeWidth={2.5}
                        style={{ cursor: 'pointer' }}
                        onClick={(event) => {
                          event.stopPropagation()
                          void openDayPosts(point, cx, cy)
                        }}
                      />
                    )
                  }}
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
                            : 'rgb(var(--text-secondary))'
                      const dy = value >= 0 ? -10 : 14

                      return (
                        <text
                          x={x}
                          y={y}
                          dy={dy}
                          fill={fill}
                          fontSize={11}
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
                <Line
                  yAxisId="engagement"
                  type="monotone"
                  dataKey="engajamentoMedio"
                  name="engajamentoMedio"
                  stroke={ENGAGEMENT_LINE_COLOR}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  connectNulls={false}
                  dot={{ r: 3.5, fill: ENGAGEMENT_LINE_COLOR, strokeWidth: 1.5, stroke: '#fff' }}
                  activeDot={{ r: 5 }}
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
                          dy={-12}
                          fill={ENGAGEMENT_LINE_COLOR}
                          fontSize={10}
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
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="flex h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-card text-secondary">
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
