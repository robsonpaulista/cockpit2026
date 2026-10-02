'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Flame,
  Info,
  Loader2,
  MapPin,
  Maximize2,
  Minimize2,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import type { PrioridadeCampoMapaRow } from '@/components/mapa-presenca'
import { WarRoomCoberturaVisitasTdView } from '@/components/war-room/war-room-cobertura-visitas-td-view'
import { TerritoryCityDrawer } from '@/components/war-room/territorio-city-drawer'
import type { CalendarEventRow } from '@/lib/agenda/calendar-event-utils'
import { normalizeIptMunicipio, type IptMunicipio } from '@/lib/ipt'
import { IPT_VISITAS_JANELA_DIAS } from '@/lib/ipt'
import type { RegiaoPiaui } from '@/lib/piaui-regiao'
import {
  buildAgendaProximosPorMunicipio,
  formatProximaAgendaPopupLabel,
  type WarRoomAgendaProximoItem,
} from '@/lib/war-room/agenda-proximos'
import {
  buildTerritoryCityBriefs,
  buildTerritoryMapLayers,
  buildTerritorySummary,
  formatDeltaPp,
  formatPct,
  territoryModeLegend,
  territoryRecencyThresholds,
  type TerritoryMapLayers,
  type TerritoryMode,
  type TerritoryPopupInfo,
} from '@/lib/war-room/territorio-presenca'
import { cn } from '@/lib/utils'
import '@/app/dashboard/shared/cobertura-cx-chrome.css'

const MapaPresenca = dynamic(
  () => import('@/components/mapa-presenca').then((mod) => mod.MapaPresenca),
  {
    ssr: false,
    loading: () => (
      <div className="wr-cobertura__map-loading">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando mapa…
      </div>
    ),
  },
)

const MAP_CONTAINER_ID = 'wr-cobertura-fs-root'
const MAP_HOME_ID = 'wr-home-presenca-map'

type Props = {
  municipios: IptMunicipio[]
  loading?: boolean
  /** `home` = versão reduzida na Visão Geral do War Room */
  variant?: 'full' | 'home'
}

function formatNum(n: number): string {
  return n.toLocaleString('pt-BR')
}

function enrichLayersWithAgenda(
  layers: TerritoryMapLayers,
  agendaPorMunicipio: Map<string, WarRoomAgendaProximoItem[]>,
): TerritoryMapLayers {
  if (agendaPorMunicipio.size === 0) return layers
  const enrich = (list: TerritoryPopupInfo[]): TerritoryPopupInfo[] =>
    list.map((t) => {
      const label = formatProximaAgendaPopupLabel(
        agendaPorMunicipio.get(normalizeIptMunicipio(t.cidade)),
      )
      return label ? { ...t, proximaAgendaLabel: label } : t
    })
  return {
    ...layers,
    territoriosQuentes: enrich(layers.territoriosQuentes),
    territoriosMornos: enrich(layers.territoriosMornos),
    territoriosFrios: enrich(layers.territoriosFrios),
  }
}

/**
 * Copiloto · Cobertura
 * - `full` (aba Cobertura): painel de visitas por TD (45 dias)
 * - `home` (Visão Geral): mapa de presença reduzido
 */
export function WarRoomCopilotoCoberturaView({
  municipios,
  loading = false,
  variant = 'full',
}: Props) {
  if (variant !== 'home') {
    return <WarRoomCoberturaVisitasTdView municipios={municipios} loading={loading} />
  }
  return <WarRoomCoberturaHomeMap municipios={municipios} loading={loading} />
}

function WarRoomCoberturaHomeMap({
  municipios,
  loading = false,
}: Omit<Props, 'variant'>) {
  const isHome = true
  const mapDomId = MAP_HOME_ID
  const [isFullscreen, setIsFullscreen] = useState(false)
  const territoryMode: TerritoryMode = 'coverage'
  const [selectedRegionId, setSelectedRegionId] = useState<RegiaoPiaui | null>(null)
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null)
  const [agendaPorMunicipio, setAgendaPorMunicipio] = useState<
    Map<string, WarRoomAgendaProximoItem[]>
  >(() => new Map())

  useEffect(() => {
    const onFs = () => {
      const fs = document.fullscreenElement
      setIsFullscreen(!!(fs && fs.id === mapDomId))
    }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [mapDomId])

  const handleFullscreen = useCallback(() => {
    const container = document.getElementById(mapDomId)
    if (!container) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void container.requestFullscreen()
    }
  }, [mapDomId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/agenda/events', { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) setAgendaPorMunicipio(new Map())
          return
        }
        const data = (await res.json()) as { events?: CalendarEventRow[] }
        if (!cancelled) {
          setAgendaPorMunicipio(buildAgendaProximosPorMunicipio(data.events ?? []))
        }
      } catch {
        if (!cancelled) setAgendaPorMunicipio(new Map())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const briefs = useMemo(() => buildTerritoryCityBriefs(municipios), [municipios])
  const summary = useMemo(() => buildTerritorySummary(briefs), [briefs])
  const mapLayers = useMemo(() => {
    const base = buildTerritoryMapLayers(briefs, territoryMode)
    return enrichLayersWithAgenda(base, agendaPorMunicipio)
  }, [briefs, territoryMode, agendaPorMunicipio])
  const legend = useMemo(() => territoryModeLegend(territoryMode), [territoryMode])

  const prioridadeCampoLista = useMemo<PrioridadeCampoMapaRow[]>(() => {
    return briefs.map((c) => ({
      cidade: c.municipio,
      expectativaVotos: c.expectativaVotos,
      visitas: c.visitasNoPeriodo,
      agendas: 0,
      motivo:
        c.visitasNoPeriodo > 0
          ? `${c.visitasNoPeriodo} visita${c.visitasNoPeriodo === 1 ? '' : 's'} nos últimos ${IPT_VISITAS_JANELA_DIAS} dias`
          : `Sem visita nos últimos ${IPT_VISITAS_JANELA_DIAS} dias`,
      ultimaVisita: c.ultimaVisita,
      semExpectativa: !c.hasMeta,
    }))
  }, [briefs])

  const expectativaPorCidadeLista = useMemo(
    () =>
      briefs
        .filter((c) => c.hasMeta)
        .map((c) => ({ cidade: c.municipio, expectativaVotos: c.expectativaVotos })),
    [briefs],
  )

  const selectedCity = useMemo(
    () => (selectedCityId ? briefs.find((c) => c.municipio === selectedCityId) ?? null : null),
    [briefs, selectedCityId],
  )

  const regionFocus = useMemo(() => {
    if (!selectedRegionId) return null
    return summary.regional.find((r) => r.regiao === selectedRegionId) ?? null
  }, [selectedRegionId, summary.regional])

  const regionCityLists = useMemo(() => {
    if (!selectedRegionId) return null
    const inRegion = briefs.filter((c) => c.regiao === selectedRegionId && c.hasMeta)
    return {
      recentes: [...inRegion]
        .filter((c) => c.recencyBand === 'recent')
        .sort((a, b) => (a.daysSinceLastVisit ?? 999) - (b.daysSinceLastVisit ?? 999))
        .slice(0, 4),
      maiorPresenca: [...inRegion]
        .filter((c) => c.visitasNoPeriodo > 0)
        .sort((a, b) => b.visitasNoPeriodo - a.visitasNoPeriodo)
        .slice(0, 4),
      atencao: [...inRegion]
        .filter((c) => c.visitasUltimos15Dias <= 0)
        .sort((a, b) => b.expectativaVotos - a.expectativaVotos)
        .slice(0, 4),
    }
  }, [briefs, selectedRegionId])

  const coverageDeltaLabel = formatDeltaPp(summary.coverageDeltaPp)

  if (loading && municipios.length === 0) {
    return (
      <div className="wr-copiloto-view__state">
        <Loader2 className="h-5 w-5 animate-spin text-[#e8a825]" strokeWidth={1.5} />
        <span>Carregando presença territorial…</span>
      </div>
    )
  }

  if (!loading && briefs.length === 0) {
    return (
      <div className="wr-copiloto-view__state">
        <MapPin className="h-5 w-5 text-[var(--wr-aux)]" strokeWidth={1.5} aria-hidden />
        <span>Nenhuma visita registrada neste período.</span>
      </div>
    )
  }

  return (
    <section
      id={mapDomId}
      className={cn(
        'wr-cobertura wr-territorio',
        isHome && 'wr-territorio--home',
        isFullscreen && 'wr-cobertura--fs',
      )}
      aria-label="Presença no território"
    >
      {isHome ? (
        <header className="wr-territorio__head wr-territorio__head--home">
          <div>
            <h2 className="wr-territorio__title">
              <MapPin size={13} strokeWidth={2.2} className="wr-territorio__title-icon" aria-hidden />
              Presença no Território
              <Info size={13} strokeWidth={2} className="wr-territorio__title-info" aria-hidden />
            </h2>
          </div>
          <span className="wr-territorio__period">
            Últimos {territoryRecencyThresholds.periodDays} dias
          </span>
        </header>
      ) : (
        <header className="wr-territorio__head">
          <div>
            <h2 className="wr-territorio__title">Presença no Território</h2>
            <p className="wr-territorio__sub">
              Onde estivemos, onde estamos fortes e onde precisamos chegar
            </p>
          </div>
          <div className="wr-territorio__head-actions">
            <button
              type="button"
              className="wr-cobertura__fs-btn"
              onClick={handleFullscreen}
              title={isFullscreen ? 'Sair da tela cheia' : 'Ver mapa em tela cheia'}
              aria-label={isFullscreen ? 'Sair da tela cheia' : 'Ver mapa em tela cheia'}
            >
              {isFullscreen ? (
                <Minimize2 size={15} strokeWidth={2.2} aria-hidden />
              ) : (
                <Maximize2 size={15} strokeWidth={2.2} aria-hidden />
              )}
              {isFullscreen ? 'Sair' : 'Tela cheia'}
            </button>
          </div>
        </header>
      )}

      {!isHome ? (
      <div className="wr-territorio__kpis" role="list">
        <article className="wr-territorio__kpi" role="listitem">
          <p className="wr-territorio__kpi-val tabular-nums">{formatNum(summary.visitedCities)}</p>
          <p className="wr-territorio__kpi-label">Cidades visitadas</p>
        </article>
        <article className="wr-territorio__kpi" role="listitem">
          <p
            className={cn(
              'wr-territorio__kpi-val tabular-nums',
              summary.newlyVisitedCities > 0 && 'wr-territorio__kpi-val--up',
            )}
          >
            {summary.newlyVisitedCities > 0 ? `↑ ${formatNum(summary.newlyVisitedCities)}` : '—'}
          </p>
          <p className="wr-territorio__kpi-label">Novas no período</p>
        </article>
        <article className="wr-territorio__kpi" role="listitem">
          <p className="wr-territorio__kpi-val tabular-nums">
            {formatPct(summary.coveragePercentage)}
            {coverageDeltaLabel ? (
              <small
                className={cn(
                  (summary.coverageDeltaPp ?? 0) >= 0
                    ? 'wr-territorio__kpi-val--up'
                    : 'wr-territorio__kpi-val--down',
                )}
              >
                {' '}
                {coverageDeltaLabel}
              </small>
            ) : null}
          </p>
          <p className="wr-territorio__kpi-label">Meta coberta</p>
        </article>
        <article className="wr-territorio__kpi wr-territorio__kpi--alert" role="listitem">
          <p className="wr-territorio__kpi-val tabular-nums">
            {formatNum(summary.citiesWithoutRecentVisit)}
          </p>
          <p className="wr-territorio__kpi-label">
            Sem visita há +{territoryRecencyThresholds.recentDays} dias
          </p>
        </article>
      </div>
      ) : null}

      <div className={cn('wr-territorio__workspace', isHome && 'wr-territorio__workspace--home')}>
        <div className="wr-territorio__stage">

          <div className="wr-territorio__map-shell">
            <MapaPresenca
              embedded
              hideFooterLegend
              showStatsOverlay={false}
              fullscreenChrome={false}
              markerTheme="war-room"
              expectativaLabel="Meta"
              onFullscreen={isHome ? undefined : handleFullscreen}
              focusRegiao={selectedRegionId ?? 'todas'}
              cidadesComPresenca={mapLayers.cidadesComPresenca}
              cidadesVisitadas={mapLayers.cidadesVisitadas}
              expectativaPorCidadeLista={expectativaPorCidadeLista}
              prioridadeCampoLista={prioridadeCampoLista}
              territoriosQuentes={mapLayers.territoriosQuentes}
              territoriosMornos={mapLayers.territoriosMornos}
              territoriosFrios={mapLayers.territoriosFrios}
              totalCidades={Math.max(summary.citiesWithMeta, 1)}
            />

            {!isHome ? (
              <div className="wr-territorio__hud">
                <div className="wr-territorio__legend" aria-label="Legenda">
                  {legend.map((item) => (
                    <span key={item.key} className="wr-territorio__legend-item">
                      <i
                        className={cn(
                          'wr-territorio__legend-dot',
                          `wr-territorio__legend-dot--${item.kind}`,
                        )}
                        aria-hidden
                      />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {isHome ? (
            <>
              <div className="wr-territorio__legend wr-territorio__legend--home" aria-label="Legenda">
                {legend.map((item) => (
                  <span key={item.key} className="wr-territorio__legend-item">
                    <i
                      className={cn(
                        'wr-territorio__legend-dot',
                        `wr-territorio__legend-dot--${item.kind}`,
                      )}
                      aria-hidden
                    />
                    {item.label}
                  </span>
                ))}
              </div>
              <div className="wr-territorio__home-kpis" role="list">
                <span className="wr-territorio__home-kpi" role="listitem">
                  <strong className="tabular-nums">{formatNum(summary.visitedCities)}</strong>{' '}
                  cidades visitadas
                </span>
                <span className="wr-territorio__home-kpi" role="listitem">
                  <strong className="tabular-nums">{formatPct(summary.coveragePercentage)}</strong>{' '}
                  do Piauí coberto
                </span>
                <span className="wr-territorio__home-kpi wr-territorio__home-kpi--alert" role="listitem">
                  <MapPin size={11} strokeWidth={2.2} aria-hidden />
                  <strong className="tabular-nums">
                    {formatNum(summary.citiesWithoutRecentVisit)}
                  </strong>{' '}
                  sem visita há +{territoryRecencyThresholds.recentDays} dias
                </span>
              </div>
            </>
          ) : null}
        </div>

        {!isHome ? (
        <aside className="wr-territorio__panel" aria-label="Performance regional">
          <p className="wr-territorio__panel-label">Regiões</p>

          {!selectedRegionId ? (
            <div className="wr-territorio__regions" role="list">
              {summary.regional.map((r) => {
                const delta = formatDeltaPp(r.coverageDeltaPp)
                const isTopAdvance =
                  summary.regionMostAdvanced?.regiao === r.regiao &&
                  (r.coverageDeltaPp ?? 0) > 0
                const DeltaIco =
                  (r.coverageDeltaPp ?? 0) >= 0 ? TrendingUp : TrendingDown
                const barPct =
                  r.coveragePct != null ? Math.min(100, Math.max(0, r.coveragePct)) : 0

                return (
                  <button
                    key={r.regiao}
                    type="button"
                    role="listitem"
                    className={cn(
                      'wr-territorio__region',
                      `wr-territorio__region--${r.tone}`,
                    )}
                    onClick={() => setSelectedRegionId(r.regiao)}
                  >
                    <div className="wr-territorio__region-top">
                      <strong>{r.regiao}</strong>
                      <span className="wr-territorio__region-tone">{r.toneLabel}</span>
                    </div>
                    <div className="wr-territorio__region-mid">
                      <p className="wr-territorio__region-pct tabular-nums">
                        {formatPct(r.coveragePct)}
                      </p>
                      {delta ? (
                        <span
                          className={cn(
                            'wr-territorio__region-delta',
                            (r.coverageDeltaPp ?? 0) >= 0
                              ? 'wr-territorio__kpi-val--up'
                              : 'wr-territorio__kpi-val--down',
                          )}
                        >
                          <DeltaIco size={12} strokeWidth={2.4} aria-hidden />
                          {delta}
                          <em>vs. período anterior</em>
                        </span>
                      ) : null}
                    </div>
                    <p className="wr-territorio__region-meta">
                      {r.visitadas} de {r.totalComMeta} cidades visitadas
                    </p>
                    <div className="wr-territorio__region-bar" aria-hidden>
                      <span style={{ width: `${barPct}%` }} />
                    </div>
                    {isTopAdvance ? (
                      <p className="wr-territorio__region-badge wr-territorio__region-badge--hot">
                        <Flame size={11} strokeWidth={2.2} aria-hidden />
                        Região que mais avançou
                      </p>
                    ) : r.semVisitaRecente > 0 && r.tone !== 'forte' ? (
                      <p className="wr-territorio__region-badge wr-territorio__region-badge--warn">
                        <AlertTriangle size={11} strokeWidth={2.2} aria-hidden />
                        {r.semVisitaRecente} sem visita recente
                      </p>
                    ) : null}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="wr-territorio__focus">
              <div className="wr-territorio__focus-head">
                <div>
                  <strong>{regionFocus?.regiao}</strong>
                  <span>
                    {formatPct(regionFocus?.coveragePct ?? null)} coberto ·{' '}
                    {regionFocus?.visitadas} de {regionFocus?.totalComMeta}
                  </span>
                </div>
                <button
                  type="button"
                  className="wr-territorio__focus-back"
                  onClick={() => setSelectedRegionId(null)}
                >
                  ← Piauí
                </button>
              </div>
              {regionCityLists ? (
                <div className="wr-territorio__focus-lists">
                  <RegionCityGroup
                    title="Recentes"
                    cities={regionCityLists.recentes}
                    onSelect={setSelectedCityId}
                  />
                  <RegionCityGroup
                    title="Maior presença"
                    cities={regionCityLists.maiorPresenca}
                    onSelect={setSelectedCityId}
                  />
                  <RegionCityGroup
                    title="Precisam de atenção"
                    cities={regionCityLists.atencao}
                    onSelect={setSelectedCityId}
                  />
                </div>
              ) : null}
            </div>
          )}
        </aside>
        ) : null}
      </div>

      {selectedCity ? (
        <TerritoryCityDrawer city={selectedCity} onClose={() => setSelectedCityId(null)} />
      ) : null}
    </section>
  )
}

function RegionCityGroup({
  title,
  cities,
  onSelect,
}: {
  title: string
  cities: Array<{ municipio: string; visitasNoPeriodo: number }>
  onSelect: (nome: string) => void
}) {
  if (cities.length === 0) return null
  return (
    <div className="wr-territorio__mini-list">
      <p>{title}</p>
      <ul>
        {cities.map((c) => (
          <li key={c.municipio}>
            <button type="button" onClick={() => onSelect(c.municipio)}>
              {c.municipio}
              {c.visitasNoPeriodo > 0 ? (
                <span className="tabular-nums">{c.visitasNoPeriodo}×</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
