'use client'

import { GanttChart, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  carregarEventosMissao,
  labelSentidoMissao,
  type IptMissaoEvento,
} from '@/lib/ipt-missao-evolucao'
import type { IptMissaoId } from '@/lib/ipt-missoes'
import { WarRoomCardShell } from '@/components/war-room/war-room-card-shell'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { resolveGenericLoadingStatus } from '@/lib/war-room/card-status'
import { cn } from '@/lib/utils'

const FETCH_LIMIT = 120
const DIAS_GRAFICO = 14
const MAX_MOVIMENTOS_RECENTES = 4

type SerieId = 'expectativa' | 'visitas' | 'pesquisas'

const FLUXO_MISSOES: Array<{ id: IptMissaoId; label: string }> = [
  { id: 'expectativa', label: 'Exp Votos' },
  { id: 'campo', label: 'Visitas' },
  { id: 'pesquisa', label: 'Pesquisas' },
]

const SERIE_CONFIG: Array<{ id: SerieId; label: string; cor: string }> = [
  { id: 'expectativa', label: 'Expectativa', cor: '#2FD1C5' },
  { id: 'visitas', label: 'Visitas', cor: '#5AA7FF' },
  { id: 'pesquisas', label: 'Pesquisas', cor: '#B38CFF' },
]

type ChartPoint = {
  date: string
  label: string
  expectativa: number
  visitas: number
  pesquisas: number
  movimentacoes: number
}

function missaoLabel(missao: IptMissaoId): string {
  return FLUXO_MISSOES.find((m) => m.id === missao)?.label ?? missao
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

/** Últimos 14 dias corridos, com contagem de eventos por missão em cada dia. */
function buildChartData(eventos: IptMissaoEvento[]): ChartPoint[] {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const dias: ChartPoint[] = []
  for (let i = DIAS_GRAFICO - 1; i >= 0; i -= 1) {
    const d = new Date(hoje)
    d.setDate(d.getDate() - i)
    dias.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      expectativa: 0,
      visitas: 0,
      pesquisas: 0,
      movimentacoes: 0,
    })
  }

  const porData = new Map(dias.map((d) => [d.date, d]))
  for (const evento of eventos) {
    const chave = evento.createdAt.slice(0, 10)
    const bucket = porData.get(chave)
    if (!bucket) continue
    if (evento.missao === 'expectativa') bucket.expectativa += 1
    else if (evento.missao === 'campo') bucket.visitas += 1
    else if (evento.missao === 'pesquisa') bucket.pesquisas += 1
    else continue
    bucket.movimentacoes += 1
  }

  return dias
}

type Variacao3d = {
  delta: number
  pct: number | null
}

function calcularVariacao3d(chartData: ChartPoint[]): Variacao3d | null {
  if (chartData.length < DIAS_GRAFICO) return null
  const soma = (pontos: ChartPoint[]) =>
    pontos.reduce((acc, p) => acc + p.movimentacoes, 0)
  const recentes = soma(chartData.slice(-3))
  const anteriores = soma(chartData.slice(-6, -3))
  const delta = recentes - anteriores
  if (anteriores === 0) return { delta, pct: null }
  return { delta, pct: Math.round((delta / anteriores) * 100) }
}

type Props = {
  className?: string
}

/** Card secundário do bloco 1 — evolução no IPT em gráfico de linha + KPIs de fluxo. */
export function WarRoomEvolucaoCard({ className }: Props) {
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('evolucao')
  const [eventos, setEventos] = useState<IptMissaoEvento[]>([])
  const [loading, setLoading] = useState(true)
  const [seriesVisiveis, setSeriesVisiveis] = useState<Record<SerieId, boolean>>({
    expectativa: true,
    visitas: true,
    pesquisas: true,
  })

  const carregar = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) setLoading(true)
    try {
      const lista = await carregarEventosMissao({ limit: FETCH_LIMIT })
      setEventos(lista)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar({ silent: false })
  }, [carregar])

  useEffect(() => {
    return register('evolucao', async ({ silent }) => {
      await carregar({ silent })
    })
  }, [register, carregar])

  const eventosFluxo = useMemo(
    () =>
      eventos.filter((e) =>
        FLUXO_MISSOES.some((m) => m.id === e.missao),
      ),
    [eventos],
  )

  const snapshotLines = useMemo(
    () =>
      eventosFluxo.map(
        (e) => `${e.id}\t${e.municipio}\t${e.missao}\t${e.sentido}\t${e.createdAt}`,
      ),
    [eventosFluxo],
  )

  const { changedKeys } = useWarRoomSnapshot({
    cardId: 'evolucao',
    lines: loading && eventos.length === 0 ? null : snapshotLines,
    noun: 'movimento',
    ready: !loading || eventos.length > 0,
  })

  const changedSet = useMemo(() => new Set(changedKeys), [changedKeys])

  const fluxoKpis = useMemo(
    () =>
      FLUXO_MISSOES.map((missao) => ({
        id: missao.id,
        label: missao.label,
        total: eventosFluxo.filter((e) => e.missao === missao.id).length,
      })),
    [eventosFluxo],
  )

  const chartData = useMemo(() => buildChartData(eventosFluxo), [eventosFluxo])
  const variacao3d = useMemo(() => calcularVariacao3d(chartData), [chartData])

  const movimentosRecentes = useMemo(
    () => eventosFluxo.slice(0, MAX_MOVIMENTOS_RECENTES),
    [eventosFluxo],
  )

  const toggleSerie = (id: SerieId) => {
    setSeriesVisiveis((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <WarRoomCardShell
      id="wr-evolucao"
      className={cn('wr-cell--evolucao', className)}
      title="Evolução no IPT"
      subtitle="Movimentos das missões"
      status={resolveGenericLoadingStatus(loading, !loading && eventos.length === 0)}
      href="/dashboard/territorio/ipt"
      linkLabel="Ver no IPT"
      icon={GanttChart}
      badge={<WarRoomChangeBadge change={change} />}
    >
      {loading && eventos.length === 0 ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-4 text-[12px] text-[var(--wr-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
          Carregando movimentos…
        </div>
      ) : eventosFluxo.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-[var(--wr-muted)]">
          Nenhum movimento registrado nas missões acompanhadas.
        </p>
      ) : (
        <>
          <div className="mb-2 flex shrink-0 flex-wrap gap-1.5" role="group" aria-label="Séries do gráfico">
            {SERIE_CONFIG.map((serie) => {
              const ativa = seriesVisiveis[serie.id]
              return (
                <button
                  key={serie.id}
                  type="button"
                  aria-pressed={ativa}
                  onClick={() => toggleSerie(serie.id)}
                  className="wr-badge"
                  style={{
                    borderColor: serie.cor,
                    color: ativa ? '#06110f' : serie.cor,
                    background: ativa ? serie.cor : 'transparent',
                  }}
                >
                  {serie.label}
                </button>
              )
            })}
          </div>

          <div className="wr-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 6, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#263648" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#7F8C9C', fontSize: 10 }}
                  axisLine={{ stroke: '#263648' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#7F8C9C', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: '#152231',
                    border: '1px solid #263648',
                    borderRadius: 8,
                    color: '#F5F7FA',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: '#F5F7FA' }}
                  itemStyle={{ color: '#F5F7FA' }}
                />
                <Legend wrapperStyle={{ fontSize: 10, color: '#7F8C9C' }} />
                {seriesVisiveis.expectativa ? (
                  <Line
                    type="monotone"
                    dataKey="expectativa"
                    name="Expectativa"
                    stroke="#2FD1C5"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                ) : null}
                {seriesVisiveis.visitas ? (
                  <Line
                    type="monotone"
                    dataKey="visitas"
                    name="Visitas"
                    stroke="#5AA7FF"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                ) : null}
                {seriesVisiveis.pesquisas ? (
                  <Line
                    type="monotone"
                    dataKey="pesquisas"
                    name="Pesquisas"
                    stroke="#B38CFF"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="wr-metrics-grid mt-3 shrink-0">
            {fluxoKpis.map((kpi) => (
              <div key={kpi.id} className="wr-kpi-tile">
                <p className="wr-kpi-tile__label">{kpi.label}</p>
                <p className="wr-kpi-tile__value">{kpi.total}</p>
              </div>
            ))}
            <div className="wr-kpi-tile">
              <p className="wr-kpi-tile__label">Variação 3d</p>
              <p
                className="wr-kpi-tile__value"
                style={{
                  color:
                    variacao3d == null || variacao3d.delta === 0
                      ? undefined
                      : variacao3d.delta > 0
                        ? 'var(--wr-blue)'
                        : 'var(--wr-positive)',
                }}
              >
                {variacao3d == null
                  ? '—'
                  : variacao3d.pct != null
                    ? `${variacao3d.delta >= 0 ? '+' : ''}${variacao3d.pct}%`
                    : `${variacao3d.delta >= 0 ? '+' : ''}${variacao3d.delta}`}
              </p>
            </div>
          </div>

          <div className="mt-3 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto border-t border-[var(--wr-border)] pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--wr-muted)]">
              Movimentos recentes
            </p>
            {movimentosRecentes.map((evento) => {
              const entrou = evento.sentido === 'entrou'
              return (
                <div
                  key={evento.id}
                  className={cn(
                    'flex items-center justify-between gap-2 text-[12px]',
                    changedSet.has(evento.id) && 'wr-row--changed rounded-md px-1.5',
                  )}
                >
                  <span
                    className="min-w-0 flex-1 truncate font-medium text-[var(--wr-text)]"
                    title={evento.municipio}
                  >
                    {evento.municipio}
                  </span>
                  <span className="shrink-0 text-[var(--wr-muted)]">
                    {missaoLabel(evento.missao)}
                  </span>
                  <span
                    className={cn(
                      'wr-evolucao-badge shrink-0',
                      entrou ? 'wr-evolucao-badge--in' : 'wr-evolucao-badge--out',
                    )}
                  >
                    {labelSentidoMissao(evento.sentido)}
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--wr-muted)]">
                    {formatWhen(evento.createdAt)}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </WarRoomCardShell>
  )
}
