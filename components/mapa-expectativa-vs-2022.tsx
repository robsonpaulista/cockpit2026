'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Maximize2,
  Minimize2,
  TrendingDown,
  TrendingUp,
  Minus,
  Search,
  ListOrdered,
  Users,
  BarChart3,
} from 'lucide-react'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import demografiaMunicipiosPiaui from '@/data/demografia-municipios-piaui.json'
import { getRegiaoByLat, normalizeMunicipioNome } from '@/lib/piaui-regiao'
import {
  labelTendenciaExpectativa2022,
  type ComparativoExpectativa2022Row,
  type TendenciaExpectativa2022,
} from '@/lib/comparativo-expectativa-2022'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import type { ComparativoMapStats } from './mapa-expectativa-vs-2022-wrapper-leaflet'

const MapaExpectativaVs2022WrapperLeaflet = dynamic(
  () =>
    import('./mapa-expectativa-vs-2022-wrapper-leaflet').then(
      (mod) => mod.MapaExpectativaVs2022WrapperLeaflet
    ),
  { ssr: false }
)

const REGIOES = [
  { id: 'todas', label: 'Todas as regiões' },
  { id: 'Norte', label: 'Norte' },
  { id: 'Centro-Norte', label: 'Centro-Norte' },
  { id: 'Centro-Sul', label: 'Centro-Sul' },
  { id: 'Sul', label: 'Sul' },
] as const

const FILTROS_TENDENCIA: Array<{ id: TendenciaExpectativa2022 | 'todos'; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'cresceu', label: 'Cresceu' },
  { id: 'manteve', label: 'Estável' },
  { id: 'caiu', label: 'Caiu' },
  { id: 'sem-dados', label: 'Sem dados' },
]

interface DemografiaMunicipioRow {
  municipio: string
  microrregiao: string | null
  mesorregiao: string | null
  populacao_censo_2022: number | null
  populacao_estimada_ultimo_ano: number | null
  ano_estimativa: number | null
  sexo: { masculino: number | null; feminino: number | null }
  faixas_etarias: { de_0_a_14: number | null; de_15_a_59: number | null; de_60_ou_mais: number | null }
}

export interface MapaExpectativaVs2022Props {
  comparativoLista: ComparativoExpectativa2022Row[]
  onFullscreen?: () => void
}

function formatNumberPtBr(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) return '—'
  return Number(value).toLocaleString('pt-BR')
}

function TendenciaIcon({ tendencia }: { tendencia: TendenciaExpectativa2022 }) {
  if (tendencia === 'cresceu') return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
  if (tendencia === 'caiu') return <TrendingDown className="h-3.5 w-3.5 text-red-600" aria-hidden />
  if (tendencia === 'manteve') return <Minus className="h-3.5 w-3.5 text-amber-600" aria-hidden />
  return <BarChart3 className="h-3.5 w-3.5 text-text-muted" aria-hidden />
}

export function MapaExpectativaVs2022({ comparativoLista, onFullscreen }: MapaExpectativaVs2022Props) {
  const { appearance } = useTheme()
  const isDarkAppearance = appearance === 'dark'
  const [clientReady, setClientReady] = useState(false)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)
  const [filtroRegiao, setFiltroRegiao] = useState<string>('todas')
  const [filtroTendencia, setFiltroTendencia] = useState<TendenciaExpectativa2022 | 'todos'>('todos')
  const [buscaMunicipio, setBuscaMunicipio] = useState('')
  const [cidadeSelecionada, setCidadeSelecionada] = useState('')
  const [mapStats, setMapStats] = useState<ComparativoMapStats | null>(null)

  useEffect(() => {
    setClientReady(true)
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (!isNativeFullscreen) {
      setBuscaMunicipio('')
      setCidadeSelecionada('')
    }
  }, [isNativeFullscreen])

  const handleExitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    }
  }, [])

  const handleStatsCalculated = useCallback((stats: ComparativoMapStats) => {
    setMapStats(stats)
  }, [])

  const listaFiltrada = useMemo(() => {
    let lista = comparativoLista
    if (filtroTendencia !== 'todos') {
      lista = lista.filter((row) => row.tendencia === filtroTendencia)
    }
    if (filtroRegiao !== 'todas') {
      const nomesSet = new Set(
        municipiosPiaui
          .filter((m) => getRegiaoByLat(m.lat) === filtroRegiao)
          .map((m) => normalizeMunicipioNome(m.nome))
      )
      lista = lista.filter((row) => nomesSet.has(normalizeMunicipioNome(row.cidade)))
    }
    return lista
  }, [comparativoLista, filtroTendencia, filtroRegiao])

  const listaExibicao = useMemo(() => {
    const q = normalizeMunicipioNome(buscaMunicipio.trim())
    const comRank = listaFiltrada.map((row, i) => ({ row, rankGlobal: i + 1 }))
    if (!q) return comRank
    return comRank.filter(({ row }) => normalizeMunicipioNome(row.cidade).includes(q))
  }, [listaFiltrada, buscaMunicipio])

  useEffect(() => {
    if (listaExibicao.length === 0) {
      setCidadeSelecionada('')
      return
    }
    if (!cidadeSelecionada) {
      setCidadeSelecionada(listaExibicao[0].row.cidade)
      return
    }
    const exists = listaExibicao.some(
      ({ row }) => normalizeMunicipioNome(row.cidade) === normalizeMunicipioNome(cidadeSelecionada)
    )
    if (!exists) setCidadeSelecionada(listaExibicao[0].row.cidade)
  }, [listaExibicao, cidadeSelecionada])

  const demografiaPorCidade = useMemo(() => {
    const mapa = new Map<string, DemografiaMunicipioRow>()
    ;(demografiaMunicipiosPiaui as DemografiaMunicipioRow[]).forEach((item) => {
      mapa.set(normalizeMunicipioNome(item.municipio), item)
    })
    return mapa
  }, [])

  const cidadeDetalhe = useMemo(
    () => comparativoLista.find((r) => normalizeMunicipioNome(r.cidade) === normalizeMunicipioNome(cidadeSelecionada)) ?? null,
    [comparativoLista, cidadeSelecionada]
  )

  const demografiaSelecionada = useMemo(() => {
    if (!cidadeSelecionada) return null
    return demografiaPorCidade.get(normalizeMunicipioNome(cidadeSelecionada)) || null
  }, [cidadeSelecionada, demografiaPorCidade])

  if (!clientReady) {
    return (
      <div className="flex h-96 items-center justify-center rounded-2xl border border-card bg-surface">
        <p className="text-sm text-text-secondary">Carregando mapa comparativo…</p>
      </div>
    )
  }

  const mapaComOverlays = (
    <>
      <MapaExpectativaVs2022WrapperLeaflet
        comparativoLista={comparativoLista}
        filtroTendencia={filtroTendencia}
        appearance={appearance}
        onStatsCalculated={handleStatsCalculated}
      />
      {mapStats && !isNativeFullscreen && (
        <div
          className={cn(
            'pointer-events-none absolute right-3 top-3 z-[1000] min-w-[190px] space-y-1.5 rounded-xl border p-3 shadow-lg backdrop-blur-md',
            isDarkAppearance ? 'border-white/10 bg-[rgba(22,34,44,0.92)]' : 'border-gray-200/50 bg-white/90'
          )}
        >
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="text-[11px] font-bold text-text-primary">{mapStats.cresceu}</span>
            <span className="text-[11px] text-text-muted">cresceram</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
            <span className="text-[11px] font-bold text-text-primary">{mapStats.manteve}</span>
            <span className="text-[11px] text-text-muted">estáveis</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
            <span className="text-[11px] font-bold text-text-primary">{mapStats.caiu}</span>
            <span className="text-[11px] text-text-muted">caíram</span>
          </div>
        </div>
      )}
    </>
  )

  return (
    <div
      className={cn(
        'w-full min-h-0',
        isNativeFullscreen
          ? 'flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden bg-background'
          : 'space-y-3'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between',
          isNativeFullscreen ? 'shrink-0 border-b border-card bg-surface px-4 py-3' : ''
        )}
      >
        <div className="flex flex-col gap-1">
          <h3 className={cn('font-semibold text-text-primary', isNativeFullscreen ? 'text-lg' : 'text-sm')}>
            Mapa comparativo — Expectativa 2026 × Federal 2022 (Jadyel)
          </h3>
          {mapStats?.insightPrincipal ? (
            <p className="text-xs font-medium text-accent-gold">{mapStats.insightPrincipal}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {onFullscreen && !isNativeFullscreen ? (
            <button
              type="button"
              onClick={onFullscreen}
              className="rounded-lg p-2 text-secondary transition-colors hover:bg-background hover:text-text-primary"
              title="Expandir mapa em tela cheia"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          ) : null}
          {isNativeFullscreen ? (
            <button
              type="button"
              onClick={handleExitFullscreen}
              className="rounded-lg p-2 text-secondary transition-colors hover:bg-background hover:text-text-primary"
              title="Sair da tela cheia"
            >
              <Minimize2 className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5',
          isNativeFullscreen ? 'shrink-0 border-b border-card bg-surface px-4 py-2' : ''
        )}
      >
        {FILTROS_TENDENCIA.map((filtro) => {
          const active = filtroTendencia === filtro.id
          return (
            <button
              key={filtro.id}
              type="button"
              onClick={() => setFiltroTendencia(filtro.id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                active
                  ? 'bg-accent-gold text-white shadow-sm'
                  : 'border border-card bg-background text-text-secondary hover:bg-card hover:text-text-primary'
              )}
            >
              {filtro.label}
            </button>
          )
        })}
        <div className="mx-1 h-5 w-px bg-card" />
        <select
          value={filtroRegiao}
          onChange={(e) => setFiltroRegiao(e.target.value)}
          className="cursor-pointer appearance-none rounded-full border border-card bg-background px-3 py-1.5 pr-6 text-xs font-medium text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
        >
          {REGIOES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      {isNativeFullscreen ? (
        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-surface">{mapaComOverlays}</div>
          <aside
            className={cn(
              'flex w-[min(480px,34vw)] shrink-0 flex-col overflow-hidden border-l border-card bg-surface',
              isDarkAppearance ? 'border-white/10' : undefined
            )}
          >
            <div className="grid min-h-0 flex-1 grid-cols-1 divide-y border-card lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:divide-x lg:divide-y-0">
              <div className="flex min-h-0 flex-col overflow-hidden">
                <div
                  className={cn(
                    'shrink-0 border-b px-3 py-2.5',
                    isDarkAppearance ? 'border-white/10 bg-black/20' : 'border-card bg-background/40'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ListOrdered className="h-4 w-4 shrink-0 text-accent-gold" aria-hidden />
                    <p className="text-sm font-semibold text-text-primary">Comparativo por município</p>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-text-muted">
                    Expectativa Jadyel 2026 vs. Federal 2022 (TSE).
                  </p>
                  <label
                    className={cn(
                      'mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-2',
                      isDarkAppearance ? 'border-white/10 bg-black/15' : 'border-card bg-background/50'
                    )}
                  >
                    <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                    <input
                      type="search"
                      value={buscaMunicipio}
                      onChange={(e) => setBuscaMunicipio(e.target.value)}
                      placeholder="Buscar município…"
                      className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
                  {listaExibicao.length === 0 ? (
                    <p className="px-1 py-3 text-sm text-text-secondary">Nenhum município neste filtro.</p>
                  ) : (
                    <ol className="list-none space-y-2">
                      {listaExibicao.map(({ row, rankGlobal }) => {
                        const isSelected =
                          normalizeMunicipioNome(cidadeSelecionada) === normalizeMunicipioNome(row.cidade)
                        const pct =
                          row.deltaPercentual != null
                            ? `${row.deltaPercentual >= 0 ? '+' : ''}${row.deltaPercentual.toFixed(1)}%`
                            : '—'
                        return (
                          <li key={`${rankGlobal}-${row.cidade}`}>
                            <button
                              type="button"
                              onClick={() => setCidadeSelecionada(row.cidade)}
                              className={cn(
                                'flex w-full gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                                isSelected
                                  ? isDarkAppearance
                                    ? 'border-amber-300/60 bg-amber-500/15'
                                    : 'border-amber-300 bg-amber-50'
                                  : isDarkAppearance
                                    ? 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                                    : 'border-card bg-background/60 hover:bg-background/90'
                              )}
                            >
                              <span className="flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded bg-border-card/80 text-xs font-bold tabular-nums text-text-muted">
                                {rankGlobal}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start gap-2">
                                  <p className="min-w-0 flex-1 text-sm font-semibold leading-tight text-text-primary">
                                    {row.cidade}
                                  </p>
                                  <TendenciaIcon tendencia={row.tendencia} />
                                </div>
                                <p className="mt-1 text-xs leading-snug text-text-secondary">
                                  2026: {row.expectativa2026.toLocaleString('pt-BR')}
                                  <span className="text-text-muted"> · </span>
                                  2022: {row.votos2022.toLocaleString('pt-BR')}
                                  <span className="text-text-muted"> · </span>
                                  Δ {row.delta >= 0 ? '+' : ''}
                                  {row.delta.toLocaleString('pt-BR')} ({pct})
                                </p>
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              </div>
              <div className="flex min-h-0 flex-col overflow-hidden">
                <div
                  className={cn(
                    'shrink-0 border-b px-3 py-2.5',
                    isDarkAppearance ? 'border-white/10 bg-black/20' : 'border-card bg-background/40'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0 text-cyan-500" aria-hidden />
                    <p className="text-sm font-semibold text-text-primary">Detalhe e perfil</p>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
                  {!cidadeDetalhe ? (
                    <p className="text-sm text-text-secondary">Selecione um município na lista.</p>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{cidadeDetalhe.cidade}</p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          {labelTendenciaExpectativa2022(cidadeDetalhe.tendencia)}
                          {cidadeDetalhe.liderancas > 0
                            ? ` · ${cidadeDetalhe.liderancas} liderança(s) na planilha`
                            : ''}
                        </p>
                      </div>
                      <div
                        className={cn(
                          'grid grid-cols-2 gap-2 rounded-lg border p-2.5',
                          isDarkAppearance ? 'border-white/10 bg-white/[0.03]' : 'border-card bg-background/60'
                        )}
                      >
                        <div>
                          <p className="text-[11px] text-text-muted">Expectativa 2026</p>
                          <p className="text-sm font-semibold text-text-primary">
                            {cidadeDetalhe.expectativa2026.toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-text-muted">Federal 2022 (Jadyel)</p>
                          <p className="text-sm font-semibold text-text-primary">
                            {cidadeDetalhe.votos2022.toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-text-muted">Variação</p>
                          <p
                            className={cn(
                              'text-sm font-semibold',
                              cidadeDetalhe.delta > 0
                                ? 'text-emerald-600'
                                : cidadeDetalhe.delta < 0
                                  ? 'text-red-600'
                                  : 'text-text-primary'
                            )}
                          >
                            {cidadeDetalhe.delta >= 0 ? '+' : ''}
                            {cidadeDetalhe.delta.toLocaleString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-text-muted">Variação %</p>
                          <p className="text-sm font-semibold text-text-primary">
                            {cidadeDetalhe.deltaPercentual != null
                              ? `${cidadeDetalhe.deltaPercentual >= 0 ? '+' : ''}${cidadeDetalhe.deltaPercentual.toFixed(1)}%`
                              : '—'}
                          </p>
                        </div>
                      </div>
                      {demografiaSelecionada ? (
                        <div
                          className={cn(
                            'rounded-lg border p-2.5',
                            isDarkAppearance ? 'border-white/10 bg-white/[0.03]' : 'border-card bg-background/60'
                          )}
                        >
                          <p className="mb-1 text-xs font-semibold text-text-primary">Perfil da população (IBGE)</p>
                          <p className="text-xs text-text-secondary">
                            População 2022: {formatNumberPtBr(demografiaSelecionada.populacao_censo_2022)}
                          </p>
                          <p className="text-xs text-text-secondary">
                            Estimativa {demografiaSelecionada.ano_estimativa || '—'}:{' '}
                            {formatNumberPtBr(demografiaSelecionada.populacao_estimada_ultimo_ano)}
                          </p>
                          <p className="mt-1 text-xs text-text-muted">
                            {demografiaSelecionada.microrregiao || '—'} · {demografiaSelecionada.mesorregiao || '—'}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="relative h-96 min-h-0 w-full overflow-hidden rounded-2xl border border-card bg-surface">
          {mapaComOverlays}
        </div>
      )}
    </div>
  )
}
