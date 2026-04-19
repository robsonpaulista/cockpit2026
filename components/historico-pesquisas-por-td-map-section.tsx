'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Props as RechartsLabelProps } from 'recharts/types/component/Label'
import { CORES_TERRITORIO_DESENVOLVIMENTO_PI } from '@/lib/piaui-territorio-desenvolvimento-cores'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import type { HistoricoIntencaoPontoGrafico } from '@/lib/piaui-regiao'
import {
  historicoIntencaoPorTdVazio,
  type HistoricoIntencaoPorTdMap,
  type MediaIntencaoPorTd,
} from '@/lib/pesquisa-historico-por-td'
import { cn } from '@/lib/utils'

const STORAGE_CANDIDATO = 'candidatoPadraoPesquisa'

type ApiHistoricoTd = {
  mediasPorTd?: MediaIntencaoPorTd[]
  historicoPorTd?: HistoricoIntencaoPorTdMap
  historicoMunicipioFiltro?: HistoricoIntencaoPontoGrafico[]
  mediaMunicipioFiltro?: number | null
  registrosMunicipioFiltro?: number
  message?: string
}

type HistoricoPesquisasPorTdMapSectionProps = {
  territorioFoco: TerritorioDesenvolvimentoPI
  /** Município em foco na tabela (drill) — filtra o gráfico só para essa cidade. */
  municipioFoco?: string | null
  variant?: 'pagina' | 'painel'
}

/** Rótulos em cada ponto: % e cidades (compacto no modo TD agregado). */
function coordenadaNumero(v: RechartsLabelProps['x']): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v)
    return Number.isNaN(n) ? undefined : n
  }
  return undefined
}

function RotulosPontoHistorico(props: {
  x?: number
  y?: number
  /** Intenção % (Recharts passa em `value` do Label; `payload` do ponto é filtrado pelo Recharts). */
  intencao: number
  cidade?: string
  /** Só % (vários pontos com o mesmo município no filtro). */
  somentePercentual?: boolean
  variant?: 'pagina' | 'painel'
}) {
  const { x, y, intencao, cidade, somentePercentual, variant = 'pagina' } = props
  if (x == null || y == null || typeof intencao !== 'number' || Number.isNaN(intencao)) return null
  const noPainel = variant === 'painel'
  const fsPct = noPainel ? 13 : 15
  const fsCidade = noPainel ? 11 : 13
  const offsetAcima = noPainel ? 8 : 10
  const offsetAbaixo = noPainel ? 16 : 18
  const maxCidade = noPainel ? 18 : 24
  const pct = `${intencao}%`
  const cid = String(cidade ?? '').trim()
  const short = cid.length > maxCidade ? `${cid.slice(0, maxCidade - 1)}…` : cid
  return (
    <text textAnchor="middle" className="recharts-text" fill="rgb(var(--text-primary))">
      <tspan x={x} y={y - offsetAcima} style={{ fontSize: fsPct, fontWeight: 700 }}>
        {pct}
      </tspan>
      {!somentePercentual && short ? (
        <tspan x={x} y={y + offsetAbaixo} fill="rgb(var(--text-muted))" style={{ fontSize: fsCidade }}>
          {short}
        </tspan>
      ) : null}
    </text>
  )
}

function intencaoDoValorLabel(value: RechartsLabelProps['value']): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number.parseFloat(value.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function HistoricoPesquisasPorTdMapSection({
  territorioFoco,
  municipioFoco = null,
  variant = 'pagina',
}: HistoricoPesquisasPorTdMapSectionProps) {
  const noPainel = variant === 'painel'
  const [candidato, setCandidato] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [mediasPorTd, setMediasPorTd] = useState<MediaIntencaoPorTd[]>([])
  const [historicoPorTd, setHistoricoPorTd] = useState<HistoricoIntencaoPorTdMap>(() => historicoIntencaoPorTdVazio())
  const [historicoMunicipio, setHistoricoMunicipio] = useState<HistoricoIntencaoPontoGrafico[]>([])
  const [mediaMunicipio, setMediaMunicipio] = useState<number | null>(null)
  const [registrosMunicipio, setRegistrosMunicipio] = useState<number>(0)

  const readCandidato = (): string =>
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_CANDIDATO)?.trim() ?? '' : ''

  const load = useCallback(async (nome: string, mun: string | null) => {
    if (!nome) {
      setMediasPorTd([])
      setHistoricoPorTd(historicoIntencaoPorTdVazio())
      setHistoricoMunicipio([])
      setMediaMunicipio(null)
      setRegistrosMunicipio(0)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('candidato', nome)
      const m = mun?.trim()
      if (m) qs.set('municipio', m)
      const res = await fetch(`/api/pesquisa/historico-intencao?${qs.toString()}`)
      const body = (await res.json()) as ApiHistoricoTd
      if (!res.ok) {
        setMediasPorTd([])
        setHistoricoPorTd(historicoIntencaoPorTdVazio())
        setHistoricoMunicipio([])
        setMediaMunicipio(null)
        setRegistrosMunicipio(0)
        return
      }
      setMediasPorTd(body.mediasPorTd ?? [])
      setHistoricoPorTd(body.historicoPorTd ?? historicoIntencaoPorTdVazio())
      setHistoricoMunicipio(body.historicoMunicipioFiltro ?? [])
      setMediaMunicipio(body.mediaMunicipioFiltro ?? null)
      setRegistrosMunicipio(Number(body.registrosMunicipioFiltro ?? 0))
    } catch {
      setMediasPorTd([])
      setHistoricoPorTd(historicoIntencaoPorTdVazio())
      setHistoricoMunicipio([])
      setMediaMunicipio(null)
      setRegistrosMunicipio(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const nome = readCandidato()
    setCandidato(nome)
    void load(nome, municipioFoco ?? null)
  }, [load, municipioFoco])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_CANDIDATO) return
      const nome = e.newValue?.trim() ?? ''
      setCandidato(nome)
      void load(nome, municipioFoco ?? null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [load, municipioFoco])

  useEffect(() => {
    const onFocus = () => {
      const nome = readCandidato()
      setCandidato(nome)
      void load(nome, municipioFoco ?? null)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load, municipioFoco])

  const filtroMunicipioAtivo = Boolean(municipioFoco?.trim())

  const series = useMemo((): HistoricoIntencaoPontoGrafico[] => {
    if (filtroMunicipioAtivo) return historicoMunicipio
    return historicoPorTd[territorioFoco] ?? []
  }, [filtroMunicipioAtivo, historicoMunicipio, historicoPorTd, territorioFoco])

  const mediaRow = useMemo(
    () => mediasPorTd.find((m) => m.territorio === territorioFoco),
    [mediasPorTd, territorioFoco]
  )

  const temDadoGrafico = series.length > 0
  const temDadoTdAgregado = (mediaRow != null && mediaRow.n > 0) || (historicoPorTd[territorioFoco]?.length ?? 0) > 0

  const temDadoExibir =
    candidato && (filtroMunicipioAtivo ? temDadoGrafico || registrosMunicipio > 0 : temDadoTdAgregado)

  const { fill, stroke } = CORES_TERRITORIO_DESENVOLVIMENTO_PI[territorioFoco]
  const gradId = 'histTdGrad-foco'

  return (
    <section
      className={cn(
        'pointer-events-auto w-full min-w-0',
        noPainel
          ? 'mt-3 border-t border-border-card/50 pt-3'
          : 'border-t border-border-card/60 bg-surface px-3 py-4 sm:px-4 sm:py-5'
      )}
      aria-label={`Histórico de pesquisas — ${territorioFoco}`}
    >
      <div className={cn('w-full min-w-0', !noPainel && 'mx-auto max-w-4xl')}>
        <div className={cn('mb-3 flex flex-col gap-1', !noPainel && 'sm:flex-row sm:items-baseline sm:justify-between')}>
          <div>
            <h2
              className={cn(
                'font-semibold text-text-primary',
                noPainel ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
              )}
            >
              Histórico de pesquisas
            </h2>
            <p
              className={cn(
                'text-text-muted',
                noPainel ? 'text-[10px] leading-snug sm:text-[11px]' : 'text-[11px] sm:text-xs'
              )}
            >
              <span className="font-medium text-text-secondary">{territorioFoco}</span>
              {filtroMunicipioAtivo ? (
                <>
                  {' '}
                  — intenção por data apenas em{' '}
                  <span className="font-semibold text-text-secondary">{municipioFoco?.trim()}</span>.
                </>
              ) : (
                <> — média por data neste TD (todas as pesquisas naquela data nos municípios do território).</>
              )}
            </p>
          </div>
          {candidato ? (
            <span
              className="shrink-0 rounded-full border border-accent-gold/25 bg-accent-gold-soft px-2.5 py-0.5 text-[11px] font-medium text-text-primary"
              title="Candidato padrão (Gestão de pesquisas)"
            >
              {candidato}
            </span>
          ) : null}
        </div>

        {!candidato && !loading ? (
          <p className="rounded-lg border border-border-card bg-card/40 px-3 py-3 text-sm text-text-secondary">
            Defina o <strong className="font-medium text-text-primary">candidato padrão</strong> em{' '}
            <Link
              href="/dashboard/gestao-pesquisas"
              className="font-medium text-accent-gold underline-offset-2 hover:underline"
            >
              Gestão de pesquisas
            </Link>{' '}
            para carregar o histórico.
          </p>
        ) : null}

        {candidato && !loading && filtroMunicipioAtivo && !temDadoGrafico && temDadoTdAgregado ? (
          <p className="rounded-lg border border-border-card bg-card/40 px-3 py-3 text-sm text-text-secondary">
            Nenhuma pesquisa encontrada para <strong className="font-medium text-text-primary">{municipioFoco?.trim()}</strong>{' '}
            neste candidato (confira o nome do município na planilha de pesquisas).
          </p>
        ) : null}

        {candidato && !loading && !filtroMunicipioAtivo && !temDadoTdAgregado ? (
          <p className="rounded-lg border border-border-card bg-card/40 px-3 py-3 text-sm text-text-secondary">
            Nenhuma pesquisa com município deste território para o candidato atual.
          </p>
        ) : null}

        {loading ? (
          <div
            className={cn(
              'animate-pulse rounded-xl border border-border-card/50 bg-card/30',
              noPainel ? 'h-40' : 'h-44'
            )}
            aria-hidden
          />
        ) : candidato && temDadoExibir ? (
          <div
            className={cn(
              'flex flex-col rounded-xl border border-border-card/60 bg-card/50 p-3 shadow-sm sm:p-4',
              noPainel ? 'min-h-[15rem]' : 'min-h-[14rem] sm:min-h-[17rem]'
            )}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-text-primary">
                {filtroMunicipioAtivo ? municipioFoco?.trim() : territorioFoco}
              </span>
              {filtroMunicipioAtivo ? (
                mediaMunicipio != null ? (
                  <span
                    className="shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums"
                    style={{ borderColor: stroke, color: stroke, backgroundColor: `${fill}18` }}
                    title={`Média ${mediaMunicipio}% · ${registrosMunicipio} registro(s) neste município`}
                  >
                    Média {mediaMunicipio}%
                  </span>
                ) : (
                  <span className="text-xs font-semibold tabular-nums text-text-muted">—</span>
                )
              ) : mediaRow != null ? (
                <span
                  className="shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums"
                  style={{ borderColor: stroke, color: stroke, backgroundColor: `${fill}18` }}
                  title={`Média ${mediaRow.media}% · ${mediaRow.n} registro(s)`}
                >
                  Média {mediaRow.media}%
                </span>
              ) : (
                <span className="text-xs font-semibold tabular-nums text-text-muted">—</span>
              )}
            </div>
            <div
              className="min-h-0 w-full min-w-0 flex-1"
              style={{ minHeight: noPainel ? 220 : 260 }}
            >
              {series.length === 0 ? (
                <div className="flex h-full min-h-[8rem] items-center justify-center rounded-lg border border-dashed border-border-card/70 bg-background/40 text-sm text-text-muted">
                  Sem série temporal{filtroMunicipioAtivo ? ' para este município.' : ' para este TD.'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%" minHeight={noPainel ? 220 : 260}>
                  <AreaChart
                    data={series}
                    margin={{ top: noPainel ? 54 : 62, right: 12, left: -6, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={fill} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={fill} stopOpacity={0.06} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border-card))" opacity={0.35} />
                    <XAxis
                      dataKey="date"
                      stroke="rgb(var(--text-muted))"
                      tick={{ fontSize: noPainel ? 12 : 13 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 100]}
                      stroke="rgb(var(--text-muted))"
                      tick={{ fontSize: noPainel ? 12 : 13 }}
                      width={noPainel ? 40 : 42}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const p = payload[0].payload as HistoricoIntencaoPontoGrafico
                        return (
                          <div
                            style={{
                              backgroundColor: 'rgb(var(--bg-surface))',
                              border: '1px solid rgb(var(--border-card))',
                              borderRadius: 8,
                              fontSize: 12,
                              padding: '8px 10px',
                            }}
                          >
                            <div className="font-medium text-text-primary">Data {String(label)}</div>
                            <div className="mt-0.5 font-semibold tabular-nums text-text-primary">{p.intencao}%</div>
                            {p.cidade ? (
                              <div className="mt-1 max-w-[14rem] text-[11px] leading-snug text-text-secondary">
                                {p.cidade}
                              </div>
                            ) : null}
                            {p.instituto ? (
                              <div className="mt-0.5 text-[10px] text-text-muted">{p.instituto}</div>
                            ) : null}
                          </div>
                        )
                      }}
                    />
                    <Area type="monotone" dataKey="intencao" stroke={stroke} strokeWidth={2} fill={`url(#${gradId})`}>
                      <LabelList
                        dataKey="intencao"
                        position="top"
                        content={(p: RechartsLabelProps & { index?: number }) => {
                          const idx = typeof p.index === 'number' ? p.index : -1
                          const row = idx >= 0 && idx < series.length ? series[idx] : undefined
                          const intencao =
                            intencaoDoValorLabel(p.value) ??
                            (row != null && typeof row.intencao === 'number' ? row.intencao : null)
                          if (intencao == null) return null
                          return (
                            <RotulosPontoHistorico
                              x={coordenadaNumero(p.x)}
                              y={coordenadaNumero(p.y)}
                              intencao={intencao}
                              cidade={row?.cidade}
                              somentePercentual={filtroMunicipioAtivo}
                              variant={variant}
                            />
                          )
                        }}
                      />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
