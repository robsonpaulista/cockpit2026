/**
 * Métricas derivadas de presença territorial (War Room · Cobertura).
 * Centraliza limiares e selectors — não espalhar 7/15/30 nos componentes.
 */

import {
  IPT_VISITAS_COBERTURA_DIAS,
  IPT_VISITAS_JANELA_DIAS,
  type IptMunicipio,
} from '@/lib/ipt'
import {
  REGIOES_PI_ORDER,
  getRegiaoByLat,
  type RegiaoPiaui,
} from '@/lib/piaui-regiao'

/** Limiares de recência alinhados ao IPT (15d cobertura recente · 30d janela). */
export const territoryRecencyThresholds = {
  recentDays: IPT_VISITAS_COBERTURA_DIAS,
  periodDays: IPT_VISITAS_JANELA_DIAS,
} as const

/** Faixas de intensidade de visitas no período (config isolada). */
export const territoryIntensityThresholds = {
  recorrenteMin: 2,
  forteMin: 4,
} as const

export type TerritoryMode = 'coverage' | 'recency' | 'intensity'

export type TerritoryRecencyBand = 'recent' | 'period' | 'stale' | 'none'

export type TerritoryIntensityBand = 'none' | 'basic' | 'recurring' | 'strong'

export type TerritoryCoverageTone = 'forte' | 'expansao' | 'atencao' | 'critico'

export type TerritoryCityBrief = {
  municipio: string
  lat: number
  lng: number
  regiao: RegiaoPiaui
  expectativaVotos: number
  hasMeta: boolean
  visitasNoPeriodo: number
  visitasPeriodoAnterior: number
  visitasUltimos15Dias: number
  visitasHistorico: number
  ultimaVisita: string | null
  daysSinceLastVisit: number | null
  visitedInPeriod: boolean
  newlyVisited: boolean
  recencyBand: TerritoryRecencyBand
  intensityBand: TerritoryIntensityBand
  deltaVisitas: number
  coberturaLabel: string
}

export type TerritoryRegionStats = {
  regiao: RegiaoPiaui
  totalComMeta: number
  visitadas: number
  semVisitaRecente: number
  metaTotal: number
  metaVisitada: number
  coveragePct: number | null
  coveragePctAnterior: number | null
  coverageDeltaPp: number | null
  tone: TerritoryCoverageTone
  toneLabel: string
}

export type TerritorySummary = {
  visitedCities: number
  citiesWithMeta: number
  newlyVisitedCities: number
  coveragePercentage: number | null
  citiesWithoutRecentVisit: number
  visitsLast30Days: number
  previousPeriodVisits: number
  coverageDeltaPp: number | null
  regional: TerritoryRegionStats[]
  regionMostCovered: TerritoryRegionStats | null
  regionMostAdvanced: TerritoryRegionStats | null
  opportunity: TerritoryOpportunity | null
}

export type TerritoryOpportunity = {
  regiao: RegiaoPiaui
  coveragePct: number
  citiesWithoutVisit: number
  message: string
}

export type TerritoryMapLayers = {
  cidadesVisitadas: string[]
  cidadesComPresenca: string[]
  territoriosQuentes: TerritoryPopupInfo[]
  territoriosMornos: TerritoryPopupInfo[]
  territoriosFrios: TerritoryPopupInfo[]
}

export type TerritoryPopupInfo = {
  cidade: string
  motivo: string
  expectativaVotos?: number
  visitas?: number
  ultimaVisitaRelativa?: string
  deltaVisitas?: number | null
  regiaoLabel?: string
  coberturaLabel?: string
  /** Próxima visita agendada (Copiloto · Cidades), ex.: `15 set · 14:00` */
  proximaAgendaLabel?: string
}

function daysBetween(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const ms = now.getTime() - d.getTime()
  if (ms < 0) return 0
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}

export function formatRelativeVisitDays(days: number | null): string | null {
  if (days == null) return null
  if (days <= 0) return 'hoje'
  if (days === 1) return 'há 1 dia'
  return `há ${days} dias`
}

export function formatAbsoluteVisitDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
  })
}

function recencyBandForCity(
  daysSince: number | null,
  visitasNoPeriodo: number,
  visitasUltimos15: number,
): TerritoryRecencyBand {
  const { recentDays, periodDays } = territoryRecencyThresholds
  if (visitasUltimos15 > 0 || (daysSince != null && daysSince <= recentDays)) {
    return 'recent'
  }
  if (visitasNoPeriodo > 0 || (daysSince != null && daysSince <= periodDays)) {
    return 'period'
  }
  if (daysSince != null || visitasNoPeriodo > 0) {
    return 'stale'
  }
  return 'none'
}

function intensityBandForVisits(visitas: number): TerritoryIntensityBand {
  if (visitas <= 0) return 'none'
  if (visitas >= territoryIntensityThresholds.forteMin) return 'strong'
  if (visitas >= territoryIntensityThresholds.recorrenteMin) return 'recurring'
  return 'basic'
}

function coberturaLabelForCity(band: TerritoryIntensityBand, visited: boolean): string {
  if (!visited) return 'Sem visita no período'
  if (band === 'strong') return 'Forte'
  if (band === 'recurring') return 'Recorrente'
  return 'Básica'
}

function toneFromCoverage(pct: number | null): { tone: TerritoryCoverageTone; label: string } {
  if (pct == null) return { tone: 'atencao', label: 'Sem dado' }
  if (pct >= 60) return { tone: 'forte', label: 'Forte' }
  if (pct >= 40) return { tone: 'expansao', label: 'Em expansão' }
  if (pct >= 25) return { tone: 'atencao', label: 'Atenção' }
  return { tone: 'critico', label: 'Crítico' }
}

function coveragePct(metaVisitada: number, metaTotal: number): number | null {
  if (metaTotal <= 0) return null
  return Math.round((metaVisitada / metaTotal) * 1000) / 10
}

/** Municípios com meta ou visita no período — base da Cobertura. */
export function selectTerritoryBase(municipios: IptMunicipio[]): IptMunicipio[] {
  return municipios.filter((m) => m.expectativaVotos > 0 || m.detalhes.visitasNoPeriodo > 0)
}

export function buildTerritoryCityBriefs(
  municipios: IptMunicipio[],
  now: Date = new Date(),
): TerritoryCityBrief[] {
  return selectTerritoryBase(municipios).map((m) => {
    const visitasNoPeriodo = m.detalhes.visitasNoPeriodo
    const visitasPeriodoAnterior = m.detalhes.visitasPeriodoAnterior
    const visitasUltimos15Dias = m.detalhes.visitasUltimos15Dias
    const daysSinceLastVisit = daysBetween(m.ultimaVisita ?? null, now)
    const visitedInPeriod = visitasNoPeriodo > 0
    const newlyVisited = visitedInPeriod && visitasPeriodoAnterior <= 0
    const intensityBand = intensityBandForVisits(visitasNoPeriodo)
    const recency = recencyBandForCity(
      daysSinceLastVisit,
      visitasNoPeriodo,
      visitasUltimos15Dias,
    )

    return {
      municipio: m.municipio,
      lat: m.lat,
      lng: m.lng,
      regiao: getRegiaoByLat(m.lat),
      expectativaVotos: m.expectativaVotos,
      hasMeta: m.expectativaVotos > 0,
      visitasNoPeriodo,
      visitasPeriodoAnterior,
      visitasUltimos15Dias,
      visitasHistorico: m.detalhes.visitasHistorico,
      ultimaVisita: m.ultimaVisita ?? null,
      daysSinceLastVisit,
      visitedInPeriod,
      newlyVisited,
      recencyBand: recency,
      intensityBand,
      deltaVisitas: visitasNoPeriodo - visitasPeriodoAnterior,
      coberturaLabel: coberturaLabelForCity(intensityBand, visitedInPeriod),
    }
  })
}

export function buildTerritorySummary(briefs: TerritoryCityBrief[]): TerritorySummary {
  const withMeta = briefs.filter((c) => c.hasMeta)
  const visited = withMeta.filter((c) => c.visitedInPeriod)
  const newlyVisitedCities = withMeta.filter((c) => c.newlyVisited).length
  const citiesWithoutRecentVisit = withMeta.filter(
    (c) => c.visitasUltimos15Dias <= 0,
  ).length

  const metaTotal = withMeta.reduce((s, c) => s + c.expectativaVotos, 0)
  const metaVisitada = visited.reduce((s, c) => s + c.expectativaVotos, 0)
  const metaVisitadaAnterior = withMeta
    .filter((c) => c.visitasPeriodoAnterior > 0)
    .reduce((s, c) => s + c.expectativaVotos, 0)

  const coveragePercentage = coveragePct(metaVisitada, metaTotal)
  const coveragePctAnterior = coveragePct(metaVisitadaAnterior, metaTotal)
  const coverageDeltaPp =
    coveragePercentage != null && coveragePctAnterior != null
      ? Math.round((coveragePercentage - coveragePctAnterior) * 10) / 10
      : null

  const visitsLast30Days = briefs.reduce((s, c) => s + c.visitasNoPeriodo, 0)
  const previousPeriodVisits = briefs.reduce((s, c) => s + c.visitasPeriodoAnterior, 0)

  const regional = REGIOES_PI_ORDER.map((regiao) => {
    const cities = withMeta.filter((c) => c.regiao === regiao)
    const visitadas = cities.filter((c) => c.visitedInPeriod)
    const semVisitaRecente = cities.filter((c) => c.visitasUltimos15Dias <= 0).length
    const rMeta = cities.reduce((s, c) => s + c.expectativaVotos, 0)
    const rMetaVis = visitadas.reduce((s, c) => s + c.expectativaVotos, 0)
    const rMetaAnt = cities
      .filter((c) => c.visitasPeriodoAnterior > 0)
      .reduce((s, c) => s + c.expectativaVotos, 0)
    const pct = coveragePct(rMetaVis, rMeta)
    const pctAnt = coveragePct(rMetaAnt, rMeta)
    const delta =
      pct != null && pctAnt != null ? Math.round((pct - pctAnt) * 10) / 10 : null
    const { tone, label } = toneFromCoverage(pct)

    return {
      regiao,
      totalComMeta: cities.length,
      visitadas: visitadas.length,
      semVisitaRecente,
      metaTotal: rMeta,
      metaVisitada: rMetaVis,
      coveragePct: pct,
      coveragePctAnterior: pctAnt,
      coverageDeltaPp: delta,
      tone,
      toneLabel: label,
    }
  })

  const withPct = regional.filter((r) => r.coveragePct != null && r.totalComMeta > 0)
  const regionMostCovered =
    withPct.length > 0
      ? withPct.reduce((a, b) => ((a.coveragePct ?? 0) >= (b.coveragePct ?? 0) ? a : b))
      : null

  const withDelta = regional.filter((r) => r.coverageDeltaPp != null && r.totalComMeta > 0)
  const regionMostAdvanced =
    withDelta.length > 0
      ? withDelta.reduce((a, b) =>
          (a.coverageDeltaPp ?? -Infinity) >= (b.coverageDeltaPp ?? -Infinity) ? a : b,
        )
      : null

  const opportunity = deriveOpportunity(regional)

  return {
    visitedCities: visited.length,
    citiesWithMeta: withMeta.length,
    newlyVisitedCities,
    coveragePercentage,
    citiesWithoutRecentVisit,
    visitsLast30Days,
    previousPeriodVisits,
    coverageDeltaPp,
    regional,
    regionMostCovered,
    regionMostAdvanced,
    opportunity,
  }
}

/**
 * Oportunidade objetiva: região com menor cobertura de meta
 * e volume relevante de cidades com meta sem visita no período.
 * Sem meta inventada — só compara cobertura real.
 */
function deriveOpportunity(regional: TerritoryRegionStats[]): TerritoryOpportunity | null {
  const candidatos = regional.filter(
    (r) =>
      r.totalComMeta >= 5 &&
      r.coveragePct != null &&
      r.visitadas < r.totalComMeta,
  )
  if (candidatos.length < 2) return null

  const sorted = [...candidatos].sort(
    (a, b) => (a.coveragePct ?? 100) - (b.coveragePct ?? 100),
  )
  const weakest = sorted[0]
  const strongest = sorted[sorted.length - 1]
  if (!weakest || !strongest) return null
  if ((weakest.coveragePct ?? 0) >= (strongest.coveragePct ?? 0) - 5) return null

  const semVisita = weakest.totalComMeta - weakest.visitadas
  if (semVisita < 3) return null

  return {
    regiao: weakest.regiao,
    coveragePct: weakest.coveragePct ?? 0,
    citiesWithoutVisit: semVisita,
    message: `Aumentar presença no ${weakest.regiao} pode equilibrar a cobertura territorial (${formatPct(weakest.coveragePct)} · ${semVisita} cidades com meta ainda sem visita no período).`,
  }
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value}%`
}

export function formatDeltaPp(delta: number | null | undefined): string | null {
  if (delta == null || !Number.isFinite(delta)) return null
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta} p.p.`
}

export function formatDeltaVisitas(delta: number): string | null {
  if (delta === 0) return null
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta} visita${Math.abs(delta) === 1 ? '' : 's'}`
}

function popupMotivo(city: TerritoryCityBrief): string {
  const rel = formatRelativeVisitDays(city.daysSinceLastVisit)
  const parts: string[] = []
  if (rel) parts.push(`Última visita ${rel}`)
  if (city.visitasNoPeriodo > 0) {
    parts.push(
      `${city.visitasNoPeriodo} visita${city.visitasNoPeriodo === 1 ? '' : 's'} nos últimos ${territoryRecencyThresholds.periodDays} dias`,
    )
  } else {
    parts.push(`Sem visita nos últimos ${territoryRecencyThresholds.periodDays} dias`)
  }
  const d = formatDeltaVisitas(city.deltaVisitas)
  if (d) parts.push(`${d} vs. período anterior`)
  return parts.join(' · ')
}

function toPopupInfo(city: TerritoryCityBrief): TerritoryPopupInfo {
  return {
    cidade: city.municipio,
    motivo: popupMotivo(city),
    expectativaVotos: city.expectativaVotos > 0 ? city.expectativaVotos : undefined,
    visitas: city.visitasNoPeriodo > 0 ? city.visitasNoPeriodo : undefined,
    ultimaVisitaRelativa: formatRelativeVisitDays(city.daysSinceLastVisit) ?? undefined,
    deltaVisitas: city.deltaVisitas !== 0 ? city.deltaVisitas : null,
    regiaoLabel: city.regiao,
    coberturaLabel: city.coberturaLabel,
  }
}

/**
 * Camadas do mapa por modo de leitura — reutiliza tipos visitada / com-presença
 * sem alterar coordenadas nem fonte geográfica.
 */
export function buildTerritoryMapLayers(
  briefs: TerritoryCityBrief[],
  mode: TerritoryMode,
): TerritoryMapLayers {
  const withMeta = briefs.filter((c) => c.hasMeta)
  const visited = briefs.filter((c) => c.visitedInPeriod)

  if (mode === 'recency') {
    const recent = visited.filter((c) => c.recencyBand === 'recent')
    const period = visited.filter((c) => c.recencyBand === 'period')
    const staleOrNone = withMeta.filter(
      (c) => !c.visitedInPeriod || c.recencyBand === 'stale',
    )

    return {
      cidadesVisitadas: recent.map((c) => c.municipio),
      // Mid-period: aparecem como presença (anel), não check forte
      cidadesComPresenca: [
        ...period.map((c) => c.municipio),
        ...withMeta.filter((c) => !c.visitedInPeriod).map((c) => c.municipio),
      ],
      territoriosQuentes: recent.map(toPopupInfo),
      territoriosMornos: period.map(toPopupInfo),
      territoriosFrios: staleOrNone.map(toPopupInfo),
    }
  }

  if (mode === 'intensity') {
    const strong = visited.filter((c) => c.intensityBand === 'strong')
    const mid = visited.filter(
      (c) => c.intensityBand === 'recurring' || c.intensityBand === 'basic',
    )

    return {
      cidadesVisitadas: strong.map((c) => c.municipio),
      // Só cidades com visita no período (1–3) — evita poluir com meta sem visita
      cidadesComPresenca: mid.map((c) => c.municipio),
      territoriosQuentes: strong.map(toPopupInfo),
      territoriosMornos: mid.map(toPopupInfo),
      territoriosFrios: withMeta.filter((c) => !c.visitedInPeriod).map(toPopupInfo),
    }
  }

  // coverage (padrão = comportamento atual)
  return {
    cidadesVisitadas: visited.map((c) => c.municipio),
    cidadesComPresenca: withMeta.map((c) => c.municipio),
    territoriosQuentes: visited
      .filter((c) => c.intensityBand === 'strong' || c.recencyBand === 'recent')
      .map(toPopupInfo),
    territoriosMornos: visited
      .filter((c) => c.intensityBand !== 'strong' && c.recencyBand !== 'recent')
      .map(toPopupInfo),
    territoriosFrios: withMeta.filter((c) => !c.visitedInPeriod).map(toPopupInfo),
  }
}

export function territoryModeLegend(mode: TerritoryMode): Array<{ key: string; label: string; kind: 'strong' | 'mid' | 'soft' | 'alert' }> {
  const { recentDays, periodDays } = territoryRecencyThresholds
  const { recorrenteMin, forteMin } = territoryIntensityThresholds

  if (mode === 'recency') {
    return [
      { key: 'r1', label: `Até ${recentDays} dias`, kind: 'strong' },
      { key: 'r2', label: `${recentDays + 1}–${periodDays} dias`, kind: 'mid' },
      { key: 'r3', label: `+${periodDays} dias / sem visita`, kind: 'soft' },
    ]
  }
  if (mode === 'intensity') {
    return [
      { key: 'i1', label: `${forteMin}+ visitas · alta`, kind: 'strong' },
      { key: 'i2', label: `${recorrenteMin}–${forteMin - 1} · recorrente`, kind: 'mid' },
      { key: 'i3', label: `1 visita · básica`, kind: 'soft' },
    ]
  }
  return [
    { key: 'c1', label: 'Visitada no período', kind: 'strong' },
    { key: 'c2', label: 'Com meta', kind: 'mid' },
  ]
}
