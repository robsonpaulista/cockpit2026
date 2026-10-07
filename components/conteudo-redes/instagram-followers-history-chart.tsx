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
import { InstagramFollowersDayPostsModal } from '@/components/conteudo-redes/instagram-followers-day-posts-modal'
import { TseCard, TseCarregando, tseLinkAcaoClass } from '@/components/tse/tse-ui'
import type { InstagramHistoryResponse } from '@/lib/instagramApi'
import { fetchInstagramPostsByPublishDate } from '@/lib/instagramApi'
import type { InstagramDayPostRecord } from '@/lib/instagram-engagement-history'
import { filterLivePostsByPublishDate, mergeInstagramDayPosts } from '@/lib/instagram-day-posts'
import {
  buildFollowersHistoryChartData,
  formatEngagementValue,
  formatFollowersDelta,
  type FollowersHistoryChartPoint,
  type PostEngagementInput,
} from '@/lib/instagram-followers-history-chart'
import type { PopupAnchor } from '@/lib/anchored-popup-position'
import { getChartPointAnchor } from '@/lib/chart-svg-anchor'

type InstagramFollowersHistoryChartProps = {
  metricsHistory: InstagramHistoryResponse | null
  loading: boolean
  onRefresh: () => void
  posts?: PostEngagementInput[]
  livePosts?: InstagramDayPostRecord[]
}

const COR_SEGUIDORES = '#6A8421'
const COR_ENGAJAMENTO = '#EBB402'
const COR_NEGATIVO = '#B42318'
const GRADE = '#EEEEEE'
const TICK = { fontSize: 10, fill: '#717171' }

const corVariacao = (v: number): string => (v > 0 ? COR_SEGUIDORES : v < 0 ? COR_NEGATIVO : '#717171')

function formatEixoEngajamento(value: number): string {
  if (value >= 1000) return `${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  return formatEngagementValue(value)
}

function TooltipHistorico({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (!active || !payload?.length) return null
  const variacao = payload.find((p) => p.dataKey === 'variacao')?.value as number | undefined
  const engajamento = payload.find((p) => p.dataKey === 'engajamentoMedio')?.value as number | null | undefined

  return (
    <div className="min-w-[168px] rounded-lg border border-[#DDDDDD] bg-white px-3 py-2.5 text-[#333333] shadow-lg">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide">{label}</p>
      {typeof variacao === 'number' ? (
        <p className="flex items-center justify-between gap-3 text-[12px]">
          <span>Seguidores</span>
          <strong className="tabular-nums" style={{ color: corVariacao(variacao) }}>
            {formatFollowersDelta(variacao)}
          </strong>
        </p>
      ) : null}
      {typeof engajamento === 'number' ? (
        <p className="mt-1 flex items-center justify-between gap-3 text-[12px]">
          <span>Engajamento médio</span>
          <strong className="tabular-nums text-[#B8960B]">{formatEngagementValue(engajamento)}</strong>
        </p>
      ) : null}
      <p className="mt-2 border-t border-[#EEEEEE] pt-2 text-[10px] text-[#717171]">
        Clique no ponto para ver as publicações do dia
      </p>
    </div>
  )
}

export function InstagramFollowersHistoryChart({
  metricsHistory,
  loading,
  onRefresh,
  posts = [],
  livePosts = [],
}: InstagramFollowersHistoryChartProps) {
  const [selectedPoint, setSelectedPoint] = useState<FollowersHistoryChartPoint | null>(null)
  const [popupAnchor, setPopupAnchor] = useState<PopupAnchor | null>(null)
  const [dayPosts, setDayPosts] = useState<InstagramDayPostRecord[]>([])
  const [loadingDayPosts, setLoadingDayPosts] = useState<boolean>(false)
  const chartWrapRef = useRef<HTMLDivElement>(null)

  const chartData = useMemo(
    () =>
      buildFollowersHistoryChartData(
        metricsHistory?.history ?? [],
        posts,
        metricsHistory?.publishDayEngagement ?? [],
      ),
    [metricsHistory?.history, metricsHistory?.publishDayEngagement, posts],
  )

  const hasChartData = chartData.length > 0
  const hasEngagementLine = chartData.some((point) => point.engajamentoMedio != null)

  const openDayPosts = useCallback(
    async (point: FollowersHistoryChartPoint, cx: number, cy: number) => {
      const anchor = getChartPointAnchor(chartWrapRef.current, cx, cy)
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
    [livePosts],
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
      const isSelected = selectedPoint?.fullDate === payload.fullDate
      return (
        <circle
          cx={cx}
          cy={cy}
          r={isSelected ? 6 : 3.5}
          fill={isSelected ? COR_ENGAJAMENTO : COR_SEGUIDORES}
          stroke="#FFFFFF"
          strokeWidth={isSelected ? 2 : 1.5}
          style={{ cursor: 'pointer' }}
          onClick={(event) => {
            event.stopPropagation()
            void openDayPosts(payload, cx, cy)
          }}
        />
      )
    },
    [openDayPosts, selectedPoint?.fullDate],
  )

  return (
    <TseCard
      titulo="Histórico de seguidores"
      subtitulo="Variação diária de seguidores e engajamento médio das publicações de cada dia · clique em um ponto para ver as publicações"
      acao={
        <button type="button" onClick={onRefresh} disabled={loading} className={tseLinkAcaoClass}>
          Recarregar
        </button>
      }
    >
      {loading && !hasChartData ? (
        <TseCarregando texto="Carregando histórico…" className="min-h-[220px]" />
      ) : hasChartData ? (
        <>
          {!hasEngagementLine ? (
            <p className="mt-2 text-[11px] text-[var(--tse-muted)]">
              O engajamento histórico é salvo a cada atualização. Atualize os dados para enriquecer o histórico.
            </p>
          ) : null}
          <div ref={chartWrapRef} className="relative mt-3 h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 22, right: 4, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="tseFollowersArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9EB737" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#9EB737" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={GRADE} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={TICK}
                  interval="preserveStartEnd"
                  minTickGap={28}
                  dy={6}
                />
                <YAxis
                  yAxisId="followers"
                  axisLine={false}
                  tickLine={false}
                  tick={TICK}
                  tickFormatter={(value: number) => formatFollowersDelta(value)}
                  width={44}
                />
                <YAxis
                  yAxisId="engagement"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ ...TICK, fill: '#B8960B' }}
                  tickFormatter={formatEixoEngajamento}
                  width={40}
                  hide={!hasEngagementLine}
                />
                <ReferenceLine yAxisId="followers" y={0} stroke="#DDDDDD" />
                {selectedPoint ? (
                  <ReferenceLine x={selectedPoint.date} stroke={COR_ENGAJAMENTO} strokeDasharray="3 4" />
                ) : null}
                <Tooltip
                  content={<TooltipHistorico />}
                  cursor={{ stroke: '#DDDDDD', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  yAxisId="followers"
                  type="monotone"
                  dataKey="variacao"
                  fill="url(#tseFollowersArea)"
                  stroke="none"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="followers"
                  type="monotone"
                  dataKey="variacao"
                  name="variacao"
                  stroke={COR_SEGUIDORES}
                  strokeWidth={2}
                  dot={renderFollowerDot}
                  activeDot={false}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="variacao"
                    content={(props) => {
                      const x = Number(props.x)
                      const y = Number(props.y)
                      const value = Number(props.value)
                      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(value)) return null
                      return (
                        <text
                          x={x}
                          y={y}
                          dy={value >= 0 ? -9 : 11}
                          fill={corVariacao(value)}
                          fontSize={9}
                          fontWeight={700}
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
                    stroke={COR_ENGAJAMENTO}
                    strokeWidth={1.75}
                    strokeDasharray="5 4"
                    connectNulls={false}
                    dot={false}
                    activeDot={{ r: 4, fill: COR_ENGAJAMENTO, stroke: '#FFFFFF', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-[var(--tse-muted)]">
            <span className="inline-flex items-center gap-2">
              <span className="h-0.5 w-5 rounded-full" style={{ backgroundColor: COR_SEGUIDORES }} aria-hidden />
              Variação de seguidores
            </span>
            {hasEngagementLine ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-0 w-5 border-t-2 border-dashed"
                  style={{ borderColor: COR_ENGAJAMENTO }}
                  aria-hidden
                />
                Engajamento médio
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <div className="mt-3 flex h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--tse-border)] text-center text-[13px] text-[var(--tse-muted)]">
          {(metricsHistory?.history?.length ?? 0) === 1 ? (
            <>
              <p>Ainda há apenas um registro no histórico.</p>
              <p className="mt-1 text-[12px]">A variação diária aparece a partir do segundo dia coletado.</p>
            </>
          ) : (
            <>
              <p>O histórico é coletado automaticamente a cada atualização.</p>
              <p className="mt-1 text-[12px]">Volte amanhã para ver a evolução dos seguidores.</p>
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
    </TseCard>
  )
}
