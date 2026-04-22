'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cn } from '@/lib/utils'
import bbox from '@turf/bbox'
import bboxPolygon from '@turf/bbox-polygon'
import difference from '@turf/difference'
import { featureCollection } from '@turf/helpers'
import { CORES_TERRITORIO_DESENVOLVIMENTO_PI, getCorTerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento-cores'
import {
  getResumoPorTerritorioDesenvolvimentoPI,
  getTotaisResumoTerritorioPI,
} from '@/lib/piaui-territorio-resumo'
import {
  agregarLiderancasPorTdPlanilha,
  agregarMetricasPorCidadeNormalizadoNoTd,
  filtrarLiderancasPorMunicipioNomeOficial,
  filtrarLiderancasRelevantesPlanilha,
  obterMetricasCidadeOficial,
  resolverColunasLiderancaTerritorio,
  somarAgregadosPlanilhaTd,
  valorVotosAgregadoTd,
  valorVotosCidade,
  valorVotosLinhaPlanilha,
  type AgregadoPlanilhaPorTd,
  type CenarioVotosPainelMapaTd,
  type LiderancaPlanilha,
  type MetricasCidadePlanilha,
} from '@/lib/territorio-planilha-agregado-td'
import { getEleitoradoByCity } from '@/lib/eleitores'
import {
  getTerritorioDesenvolvimentoPI,
  getMunicipiosPorTerritorioDesenvolvimentoPI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import type { MalhaMapaPIPayload } from '@/lib/geo-malha-pi'
import {
  fetchJadyelFederal2022VotosPorMunicipioPI,
  montarMapaVotos2022JadyelPorTd,
  obterVotos2022JadyelMunicipio,
} from '@/lib/jadyel-federal-2022-pi-votos'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import {
  classificarTerritoriosPorScore,
  type ClassificacaoTerritorioTd,
} from '@/lib/piaui-territorio-classificacao'
import { ClassificacaoTdBadge } from '@/components/classificacao-td-badge'
import { HistoricoPesquisasPorTdMapSection } from '@/components/historico-pesquisas-por-td-map-section'
import { useSidebar } from '@/contexts/sidebar-context'

type LoadState = 'loading' | 'ready' | 'error'

/** Mesmo branco da aplicação — mascara fora do Piauí. */
const FUNDO_MAPA_BRANCO = '#ffffff'

interface GeoProps {
  codarea: string
  nm_mun?: string
  td?: string | null
}

type GeoStyleContext = {
  classificacao: Map<TerritorioDesenvolvimentoPI, ClassificacaoTerritorioTd>
  hoverTdTabela: TerritorioDesenvolvimentoPI | null
  visualPreset: 'default' | 'futuristic'
  maiorPesoTd: TerritorioDesenvolvimentoPI | null
  piorDeltaTd: TerritorioDesenvolvimentoPI | null
  deltasDistintos: boolean
}

const GEO_STYLE_CTX_VAZIO: GeoStyleContext = {
  classificacao: new Map(),
  hoverTdTabela: null,
  visualPreset: 'default',
  maiorPesoTd: null,
  piorDeltaTd: null,
  deltasDistintos: false,
}

function classePulsoPorClassificacao(
  td: TerritorioDesenvolvimentoPI,
  ctx: GeoStyleContext
): 'td-mun-poly--pulse-estrategico' | 'td-mun-poly--pulse-atencao' | 'td-mun-poly--pulse-baixo' {
  const c = ctx.classificacao.get(td)
  if (c === 'estrategico') return 'td-mun-poly--pulse-estrategico'
  if (c === 'atencao') return 'td-mun-poly--pulse-atencao'
  return 'td-mun-poly--pulse-baixo'
}

type MapaTdController = {
  applyStyles: (focusTd: TerritorioDesenvolvimentoPI | null, focusMunicipioNome: string | null) => void
  boundsForTd: (td: TerritorioDesenvolvimentoPI) => L.LatLngBounds | null
  boundsForMunicipio: (td: TerritorioDesenvolvimentoPI, nomeOficialMunicipio: string) => L.LatLngBounds | null
  refitFull: () => void
  setRotulosMunicipiosTd: (td: TerritorioDesenvolvimentoPI | null) => void
  /** Reposiciona e aplica opacidade/z-index conforme TD em foco (lê `highlightedTdRef`). */
  sincronizarMarcadoresPesoTdComFoco: () => void
  /** Aplica/remove estilo de hover nos marcadores do mapa ao passar na linha da tabela. */
  aplicarHoverMarcadorTd: (hoverTd: TerritorioDesenvolvimentoPI | null) => void
  /** Atualiza métrica exibida nos cards de TD do mapa. */
  atualizarResumoMarcadores: (
    agregadoTdPlanilha: Map<TerritorioDesenvolvimentoPI, AgregadoPlanilhaPorTd>,
    usarExpectativaFed26: boolean
  ) => void
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '').trim()
  if (normalized.length !== 6) return `rgba(255,106,0,${alpha})`
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(255,106,0,${alpha})`
  return `rgba(${r},${g},${b},${alpha})`
}

/** Fundo sólido da linha TD selecionada no tema futurista — mesma cor `fill` do território (marcador / quadrado na tabela). */
function cssFuturistTdLinhaSelecionadaSolid(fill: string): string {
  const h = String(fill || '').trim()
  return h.startsWith('#') && h.length >= 4 ? h : hexToRgba('#ff6a00', 1)
}

function styleForMunicipioFeature(
  feature: GeoJSON.Feature | undefined,
  focusTd: TerritorioDesenvolvimentoPI | null,
  focusMunicipioNome: string | null,
  ctx: GeoStyleContext = GEO_STYLE_CTX_VAZIO
): L.PathOptions & { className?: string } {
  const p = feature?.properties as GeoProps | undefined
  const td = (p?.td ?? null) as TerritorioDesenvolvimentoPI | null
  const emFoco = focusTd !== null
  const ehDestaque = td !== null && focusTd !== null && td === focusTd
  const nomeMun = String(p?.nm_mun ?? '').trim()
  const nomeFocoMun = focusMunicipioNome?.trim() ?? ''
  const ehCidadeDestacada =
    nomeFocoMun.length > 0 &&
    focusTd !== null &&
    td === focusTd &&
    nomeMun.length > 0 &&
    normalizeMunicipioNome(nomeMun) === normalizeMunicipioNome(nomeFocoMun)
  const preset = ctx.visualPreset

  if (preset === 'futuristic' && !td) {
    return {
      fillColor: '#10161F',
      color: 'rgba(255,255,255,0.06)',
      weight: emFoco ? 0.2 : 0.28,
      opacity: 1,
      fillOpacity: emFoco ? 0.35 : 0.72,
      className: `td-mun-poly td-mun-poly--fut td-mun-poly--fut-fora${emFoco ? ' td-mun-poly--fut-fora-foco' : ''}`,
    }
  }

  if (preset === 'futuristic' && td) {
    const { fill, stroke } = getCorTerritorioDesenvolvimentoPI(td)
    const hoverMapa = ctx.hoverTdTabela === td
    const brilhoMaiorPeso = ctx.maiorPesoTd === td && focusTd === null
    const riscoDelta = ctx.deltasDistintos && ctx.piorDeltaTd === td
    if (!emFoco) {
      let extra = ''
      if (hoverMapa) extra += ' td-mun-poly--fut-hover'
      if (brilhoMaiorPeso) extra += ' td-mun-poly--fut-max'
      if (riscoDelta) extra += ' td-mun-poly--fut-risk'
      return {
        fillColor: hoverMapa ? hexToRgba(fill, 0.34) : '#26303B',
        color: hoverMapa ? stroke : 'rgba(255,255,255,0.08)',
        weight: hoverMapa ? 1.15 : 0.55,
        opacity: 1,
        fillOpacity: hoverMapa ? 0.94 : 0.92,
        className: `td-mun-poly td-mun-poly--fut${extra}`,
      }
    }
    if (ehCidadeDestacada) {
      return {
        fillColor: hexToRgba(fill, 0.48),
        color: stroke,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
        className: 'td-mun-poly td-mun-poly--fut td-mun-poly--fut-cidade',
      }
    }
    if (ehDestaque) {
      return {
        fillColor: hexToRgba(fill, 0.4),
        color: stroke,
        weight: 1.6,
        opacity: 1,
        fillOpacity: 0.95,
        className: 'td-mun-poly td-mun-poly--fut td-mun-poly--fut-selected-td',
      }
    }
    return {
      fillColor: '#1B222C',
      color: 'rgba(255,255,255,0.06)',
      weight: 0.35,
      opacity: 0.92,
      fillOpacity: 0.42,
      className: 'td-mun-poly td-mun-poly--fut td-mun-poly--fut-dim',
    }
  }

  if (!td) {
    return {
      fillColor: '#e7e5e4',
      color: emFoco ? '#d4d4d4' : '#a8a29e',
      weight: emFoco ? 0.25 : 0.5,
      opacity: 1,
      fillOpacity: emFoco ? 0.12 : 0.45,
      className: `td-mun-poly td-mun-poly--fora${emFoco ? ' td-mun-poly--fora-foco' : ''}`,
    }
  }

  const { fill, stroke } = getCorTerritorioDesenvolvimentoPI(td)
  const hoverMapa = ctx.hoverTdTabela === td
  if (!emFoco) {
    return {
      fillColor: fill,
      color: stroke,
      weight: hoverMapa ? 0.88 : 0.65,
      opacity: 1,
      fillOpacity: hoverMapa ? 0.9 : 0.78,
      className: `td-mun-poly ${classePulsoPorClassificacao(td, ctx)}`,
    }
  }
  if (ehCidadeDestacada) {
    return {
      fillColor: fill,
      color: '#b45309',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.98,
      className: 'td-mun-poly td-mun-poly--cidade-destaque',
    }
  }
  if (ehDestaque) {
    return {
      fillColor: fill,
      color: stroke,
      weight: 1.15,
      opacity: 1,
      fillOpacity: 0.93,
      className: `td-mun-poly td-mun-poly--foco-td ${classePulsoPorClassificacao(td, ctx)}`,
    }
  }
  return {
    fillColor: '#d6d3d1',
    color: '#a8a29e',
    weight: hoverMapa ? 0.85 : 0.35,
    opacity: 0.88,
    fillOpacity: hoverMapa ? 0.38 : 0.22,
    className: 'td-mun-poly td-mun-poly--dim',
  }
}

function boundsForTdInLayer(geoLayer: L.GeoJSON, td: TerritorioDesenvolvimentoPI): L.LatLngBounds | null {
  const partes: L.LatLngBounds[] = []
  geoLayer.eachLayer((layer) => {
    const lyr = layer as L.Polygon & { feature?: GeoJSON.Feature }
    const p = lyr.feature?.properties as GeoProps | undefined
    if (p?.td !== td) return
    const b = lyr.getBounds()
    if (b.isValid()) partes.push(b)
  })
  if (partes.length === 0) return null
  let acc: L.LatLngBounds = partes[0]
  for (let i = 1; i < partes.length; i += 1) {
    acc = acc.extend(partes[i])
  }
  return acc.isValid() ? acc : null
}

function boundsForMunicipioInLayer(
  geoLayer: L.GeoJSON,
  td: TerritorioDesenvolvimentoPI,
  nomeOficialMunicipio: string
): L.LatLngBounds | null {
  const alvo = normalizeMunicipioNome(nomeOficialMunicipio)
  if (!alvo) return null
  const partes: L.LatLngBounds[] = []
  geoLayer.eachLayer((layer) => {
    const lyr = layer as L.Polygon & { feature?: GeoJSON.Feature }
    const p = lyr.feature?.properties as GeoProps | undefined
    if (!p || p.td !== td) return
    const nome = String(p.nm_mun ?? '').trim()
    if (!nome || normalizeMunicipioNome(nome) !== alvo) return
    const b = lyr.getBounds()
    if (b.isValid()) partes.push(b)
  })
  if (partes.length === 0) return null
  let acc: L.LatLngBounds = partes[0]
  for (let i = 1; i < partes.length; i += 1) {
    acc = acc.extend(partes[i])
  }
  return acc.isValid() ? acc : null
}

/** Centro “de massa” dos municípios do TD (média dos centros dos polígonos) — mais estável que só o bbox. */
function latLngMediaCentrosMunicipiosTd(geoLayer: L.GeoJSON, td: TerritorioDesenvolvimentoPI): L.LatLng | null {
  let sumLat = 0
  let sumLng = 0
  let n = 0
  geoLayer.eachLayer((layer) => {
    const lyr = layer as L.Polygon & { feature?: GeoJSON.Feature }
    const p = lyr.feature?.properties as GeoProps | undefined
    if (!p || p.td !== td) return
    const b = lyr.getBounds()
    if (!b.isValid()) return
    const c = b.getCenter()
    sumLat += c.lat
    sumLng += c.lng
    n += 1
  })
  if (n === 0) return null
  return L.latLng(sumLat / n, sumLng / n)
}

function posicaoMarcadorTdNoGeoLayer(geoLayer: L.GeoJSON, td: TerritorioDesenvolvimentoPI): L.LatLng | null {
  const med = latLngMediaCentrosMunicipiosTd(geoLayer, td)
  if (med) return med
  const bb = boundsForTdInLayer(geoLayer, td)
  return bb?.isValid() ? bb.getCenter() : null
}

/** Metadados do marcador de card por TD (âncora geográfica + nudge em px na tela). */
type MarcadorPesoTdExtras = {
  __tdNaturalAnchor?: L.LatLng
  __tdLabelOffsetPx?: L.Point
}

function dimensoesIconeMarcadorPesoTd(visualPreset: 'default' | 'futuristic'): {
  iw: number
  ih: number
  ax: number
  ay: number
} {
  const isFut = visualPreset === 'futuristic'
  return isFut
    ? { iw: 126, ih: 90, ax: 63, ay: 82 }
    : { iw: 126, ih: 96, ax: 63, ay: 86 }
}

function marcadorTdLatLngComOffsetPx(
  map: L.Map,
  marker: L.Marker,
  geoLayer: L.GeoJSON,
  td: TerritorioDesenvolvimentoPI
) {
  const m = marker as L.Marker & MarcadorPesoTdExtras
  const natural = m.__tdNaturalAnchor ?? posicaoMarcadorTdNoGeoLayer(geoLayer, td)
  if (!natural) return
  if (!m.__tdLabelOffsetPx) m.__tdLabelOffsetPx = L.point(0, 0)
  try {
    const basePx = map.latLngToContainerPoint(natural)
    marker.setLatLng(map.containerPointToLatLng(basePx.add(m.__tdLabelOffsetPx)))
  } catch {
    marker.setLatLng(natural)
  }
}

/**
 * Evita sobreposição dos cards no mapa: ajusta pequenos deslocamentos em pixels
 * (recalculado a cada zoom/move) mantendo a âncora geográfica em `__tdNaturalAnchor`.
 */
function resolverSobreposicaoCartoesMarcadoresTd(
  map: L.Map,
  geoLayer: L.GeoJSON,
  markerByTd: Map<TerritorioDesenvolvimentoPI, L.Marker>,
  visualPreset: 'default' | 'futuristic'
) {
  const { iw, ih, ax, ay } = dimensoesIconeMarcadorPesoTd(visualPreset)
  const pad = 8
  const maxNudge = 168
  const iters = 36

  type Work = {
    td: TerritorioDesenvolvimentoPI
    marker: L.Marker
    natural: L.LatLng
    off: L.Point
  }

  const work: Work[] = []
  for (const [td, marker] of markerByTd) {
    const m = marker as L.Marker & MarcadorPesoTdExtras
    const natural = m.__tdNaturalAnchor ?? posicaoMarcadorTdNoGeoLayer(geoLayer, td)
    if (!natural) continue
    m.__tdNaturalAnchor = natural
    m.__tdLabelOffsetPx = L.point(0, 0)
    work.push({ td, marker, natural, off: L.point(0, 0) })
  }
  if (work.length <= 1) {
    for (const w of work) {
      const mm = w.marker as L.Marker & MarcadorPesoTdExtras
      mm.__tdLabelOffsetPx = w.off
      marcadorTdLatLngComOffsetPx(map, w.marker, geoLayer, w.td)
    }
    return
  }

  const rectFor = (natural: L.LatLng, off: L.Point) => {
    try {
      const anchorPx = map.latLngToContainerPoint(natural).add(off)
      const tl = L.point(anchorPx.x - ax - pad, anchorPx.y - ay - pad)
      const br = L.point(tl.x + iw + 2 * pad, tl.y + ih + 2 * pad)
      return { tl, br }
    } catch {
      return null
    }
  }

  const overlap = (tl1: L.Point, br1: L.Point, tl2: L.Point, br2: L.Point) =>
    !(br1.x <= tl2.x || br2.x <= tl1.x || br1.y <= tl2.y || br2.y <= tl1.y)

  const pushApart = (tl1: L.Point, br1: L.Point, tl2: L.Point, br2: L.Point): L.Point | null => {
    const overlapX = Math.min(br1.x, br2.x) - Math.max(tl1.x, tl2.x)
    const overlapY = Math.min(br1.y, br2.y) - Math.max(tl1.y, tl2.y)
    if (overlapX <= 0 || overlapY <= 0) return null
    const cx1 = (tl1.x + br1.x) / 2
    const cy1 = (tl1.y + br1.y) / 2
    const cx2 = (tl2.x + br2.x) / 2
    const cy2 = (tl2.y + br2.y) / 2
    if (overlapX < overlapY) {
      const dir = cx1 < cx2 ? -1 : 1
      return L.point(dir * (overlapX * 0.5 + 1), 0)
    }
    const dir = cy1 < cy2 ? -1 : 1
    return L.point(0, dir * (overlapY * 0.5 + 1))
  }

  const clampOff = (off: L.Point) => {
    const m = Math.hypot(off.x, off.y)
    if (m <= maxNudge || m === 0) return off
    const s = maxNudge / m
    return L.point(off.x * s, off.y * s)
  }

  for (let iter = 0; iter < iters; iter++) {
    let mudou = false
    for (let i = 0; i < work.length; i++) {
      for (let j = i + 1; j < work.length; j++) {
        const a = work[i]
        const b = work[j]
        const ra = rectFor(a.natural, a.off)
        const rb = rectFor(b.natural, b.off)
        if (!ra || !rb) continue
        if (!overlap(ra.tl, ra.br, rb.tl, rb.br)) continue
        const d = pushApart(ra.tl, ra.br, rb.tl, rb.br)
        if (!d) continue
        a.off = clampOff(a.off.add(d))
        b.off = clampOff(b.off.subtract(d))
        mudou = true
      }
    }
    if (!mudou) break
  }

  for (const w of work) {
    const mm = w.marker as L.Marker & MarcadorPesoTdExtras
    mm.__tdLabelOffsetPx = clampOff(w.off)
    marcadorTdLatLngComOffsetPx(map, w.marker, geoLayer, w.td)
  }
}

function aplicarFocoMarcadoresPesoTd(
  markerByTd: Map<TerritorioDesenvolvimentoPI, L.Marker>,
  focusTd: TerritorioDesenvolvimentoPI | null,
  geoLayer: L.GeoJSON,
  map: L.Map
) {
  for (const [td, marker] of markerByTd) {
    marcadorTdLatLngComOffsetPx(map, marker, geoLayer, td)

    const el = marker.getElement()
    if (el) {
      const outrosOcultos = focusTd !== null && td !== focusTd
      el.style.opacity = outrosOcultos ? '0.12' : '1'
      el.style.pointerEvents = 'none'
      if (focusTd !== null && td === focusTd) {
        const { fill, stroke } = getCorTerritorioDesenvolvimentoPI(td)
        el.style.setProperty('--td-focus-stroke', stroke)
        el.style.setProperty('--td-focus-ring', hexToRgba(fill, 0.24))
        el.classList.add('td-peso-eleitores-marker--focado')
      } else {
        el.style.removeProperty('--td-focus-stroke')
        el.style.removeProperty('--td-focus-ring')
        el.classList.remove('td-peso-eleitores-marker--focado')
      }
    }
    marker.setZIndexOffset(focusTd !== null && td === focusTd ? 3200 : focusTd !== null ? 0 : 200)
    const m = marker as L.Marker & { update?: () => void }
    m.update?.()
  }
}

function atualizarHoverMarcadorTd(
  markerByTd: Map<TerritorioDesenvolvimentoPI, L.Marker>,
  hoverTd: TerritorioDesenvolvimentoPI | null,
  visualPreset: 'default' | 'futuristic',
  focusTd: TerritorioDesenvolvimentoPI | null
) {
  if (visualPreset !== 'futuristic') return
  for (const [td, marker] of markerByTd) {
    const el = marker.getElement()
    if (!el) continue
    const filterAtivo = focusTd !== null
    const isHovered = !filterAtivo && hoverTd !== null && td === hoverTd
    const otherHovered = !filterAtivo && hoverTd !== null && !isHovered
    if (isHovered) {
      const { fill, stroke } = getCorTerritorioDesenvolvimentoPI(td)
      el.style.setProperty('--td-hover-bg', hexToRgba(fill, 0.2))
      el.style.setProperty('--td-hover-stroke', stroke)
      el.classList.add('td-peso-eleitores-marker--td-hover')
      el.style.opacity = '1'
    } else {
      el.classList.remove('td-peso-eleitores-marker--td-hover')
      el.style.removeProperty('--td-hover-bg')
      el.style.removeProperty('--td-hover-stroke')
      if (filterAtivo) {
        el.style.opacity = td === focusTd ? '1' : '0'
      } else {
        el.style.opacity = otherHovered ? '0' : ''
      }
    }
  }
}

const fmtPctEleitoresTd = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Texto curto para o marcador de peso (ex.: "421 mil eleit."). */
function formatarEleitoresCompactoPt(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 eleit.'
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    const decMi = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: v < 10 ? 1 : 0 })
    const s = v >= 10 ? String(Math.round(v)) : decMi.format(v).replace(/\u00a0/g, '')
    return `${s} mi eleit.`
  }
  if (n >= 10_000) {
    return `${Math.round(n / 1_000)} mil eleit.`
  }
  return `${new Intl.NumberFormat('pt-BR').format(Math.round(n))} eleit.`
}

/**
 * Marcadores flutuantes por TD: % do eleitorado do PI e total aproximado.
 * Posição = média dos centros dos municípios (fallback: centro do bbox do TD).
 * `interactive: false` para cliques passarem aos municípios.
 */
function montarMarcadoresPesoEleitoresPorTd(
  map: L.Map,
  geoLayer: L.GeoJSON,
  visualPreset: 'default' | 'futuristic'
): Map<TerritorioDesenvolvimentoPI, L.Marker> {
  const grupo = L.layerGroup()
  const markerByTd = new Map<TerritorioDesenvolvimentoPI, L.Marker>()
  const paneName = 'piTdPesoEleitores'
  const pane = map.getPane(paneName) ?? map.createPane(paneName)
  pane.style.zIndex = '460'

  const resumos = getResumoPorTerritorioDesenvolvimentoPI()
  const { eleitores: totalEstadual } = getTotaisResumoTerritorioPI(resumos)
  const maxEleitoresTd = Math.max(1, ...resumos.map((r) => r.eleitores))

  for (const r of resumos) {
    const center = posicaoMarcadorTdNoGeoLayer(geoLayer, r.territorio)
    if (!center) continue
    const pct = totalEstadual > 0 ? (r.eleitores / totalEstadual) * 100 : 0
    const pctStr = fmtPctEleitoresTd.format(pct).replace(/\u00a0/g, '')
    const { fill, stroke } = getCorTerritorioDesenvolvimentoPI(r.territorio)
    const escala = 0.88 + 0.36 * (r.eleitores / maxEleitoresTd)
    const nomeCurto = escapeHtml(r.territorio)
    const subEleit = escapeHtml(formatarEleitoresCompactoPt(r.eleitores))

    const isFut = visualPreset === 'futuristic'

    const cardInlineStyle = isFut
      ? `max-width:124px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:rgba(18,24,33,0.94);text-align:left;box-shadow:0 4px 14px rgba(0,0,0,0.45)`
      : `max-width:118px;padding:6px 8px 7px;border-radius:11px;border:2px solid ${stroke};background:linear-gradient(165deg,${fill}f2 0%,${fill} 100%);text-align:center`

    const html = isFut
      ? `<div class="td-peso-eleitores-marker-inner td-peso-eleitores-marker-inner--vivo" style="--td-marker-s:${escala.toFixed(3)}">
        <div class="td-peso-eleitores-card" style="${cardInlineStyle}">
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px">
            <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${fill};flex-shrink:0"></span>
            <div style="font-size:8px;font-weight:600;line-height:1.2;color:#E6EDF3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:86px" title="${nomeCurto}">${nomeCurto}</div>
          </div>
          <div class="td-peso-eleitores-card__value" style="font-size:17px;font-weight:700;line-height:1;color:#E6EDF3;letter-spacing:-0.02em">${pctStr}%</div>
          <div class="td-peso-eleitores-card__meta" style="margin-top:3px;font-size:8px;font-weight:400;line-height:1.15;color:#7F8A96">${subEleit}</div>
        </div>
      </div>`
      : `<div class="td-peso-eleitores-marker-inner td-peso-eleitores-marker-inner--vivo" style="--td-marker-s:${escala.toFixed(3)}">
        <div class="td-peso-eleitores-card" style="${cardInlineStyle}">
          <div style="font-size:9px;font-weight:700;line-height:1.2;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.45);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden" title="${nomeCurto}">${nomeCurto}</div>
          <div class="td-peso-eleitores-card__value" style="margin-top:3px;font-size:16px;font-weight:800;line-height:1;color:#fff;letter-spacing:-0.02em;text-shadow:0 1px 3px rgba(0,0,0,0.5)">${pctStr}%</div>
          <div class="td-peso-eleitores-card__meta" style="margin-top:1px;font-size:8px;font-weight:600;line-height:1.15;color:rgba(255,255,255,0.94);text-shadow:0 1px 2px rgba(0,0,0,0.35)">${subEleit}</div>
          <div style="margin-top:2px;font-size:7px;font-weight:500;line-height:1.1;color:rgba(255,255,255,0.78)">do eleitorado PI</div>
        </div>
      </div>`

    const icon = L.divIcon({
      className: 'td-eleitores-peso-marker',
      html,
      iconSize: isFut ? [126, 90] : [126, 96],
      iconAnchor: isFut ? [63, 82] : [63, 86],
    })

    const marker = L.marker(center, {
      icon,
      interactive: false,
      keyboard: false,
      pane: paneName,
      riseOnHover: false,
    }).addTo(grupo)
    const mm = marker as L.Marker & MarcadorPesoTdExtras
    mm.__tdNaturalAnchor = L.latLng(center.lat, center.lng)
    mm.__tdLabelOffsetPx = L.point(0, 0)
    markerByTd.set(r.territorio, marker)
  }

  grupo.addTo(map)
  resolverSobreposicaoCartoesMarcadoresTd(map, geoLayer, markerByTd, visualPreset)
  return markerByTd
}

function atualizarResumoMarcadoresPesoEleitoresPorTd(
  markerByTd: Map<TerritorioDesenvolvimentoPI, L.Marker>,
  agregadoTdPlanilha: Map<TerritorioDesenvolvimentoPI, AgregadoPlanilhaPorTd>,
  usarExpectativaFed26: boolean
) {
  const resumos = getResumoPorTerritorioDesenvolvimentoPI()
  const eleitoresPorTd = new Map(resumos.map((r) => [r.territorio, r.eleitores] as const))
  const totalEleitores = Math.max(1, getTotaisResumoTerritorioPI(resumos).eleitores)

  let totalFed26 = 0
  if (usarExpectativaFed26) {
    for (const td of markerByTd.keys()) {
      const ag = agregadoTdPlanilha.get(td) ?? AGREGADO_PLANILHA_VAZIO
      totalFed26 += Math.max(0, Math.round(valorVotosAgregadoTd(ag, 'anterior')))
    }
  }

  for (const [td, marker] of markerByTd) {
    const el = marker.getElement()
    if (!el) continue
    const valorEl = el.querySelector<HTMLElement>('.td-peso-eleitores-card__value')
    const metaEl = el.querySelector<HTMLElement>('.td-peso-eleitores-card__meta')
    if (!valorEl || !metaEl) continue

    if (usarExpectativaFed26 && totalFed26 > 0) {
      const ag = agregadoTdPlanilha.get(td) ?? AGREGADO_PLANILHA_VAZIO
      const votosFed26Td = Math.max(0, Math.round(valorVotosAgregadoTd(ag, 'anterior')))
      const pctFed26Td = (votosFed26Td / totalFed26) * 100
      const pctStr = fmtPctEleitoresTd.format(pctFed26Td).replace(/\u00a0/g, '')
      valorEl.textContent = `${pctStr}%`
      metaEl.textContent = `${fmtInt.format(votosFed26Td)} votos FED.26`
      continue
    }

    const eleitoresTd = eleitoresPorTd.get(td) ?? 0
    const pctEleitoresTd = (eleitoresTd / totalEleitores) * 100
    const pctStr = fmtPctEleitoresTd.format(pctEleitoresTd).replace(/\u00a0/g, '')
    valorEl.textContent = `${pctStr}%`
    metaEl.textContent = formatarEleitoresCompactoPt(eleitoresTd)
  }
}

function applyStylesToGeoLayer(
  geoLayer: L.GeoJSON,
  focusTd: TerritorioDesenvolvimentoPI | null,
  focusMunicipioNome: string | null,
  ctx: GeoStyleContext
) {
  geoLayer.eachLayer((layer) => {
    const lyr = layer as L.Path & { feature?: GeoJSON.Feature }
    lyr.setStyle(styleForMunicipioFeature(lyr.feature, focusTd, focusMunicipioNome, ctx))
  })
}

/**
 * Padding no `fitBounds`: o painel “Resumo por TD” fica no canto **superior direito**.
 * Padding grande em Y empurra o encaixe **para baixo** no mapa inteiro — evitamos isso.
 * O desvio do Piauí em relação ao painel vem da margem **direita** maior no `fitBounds`.
 */
function paddingFitEvitandoPainelResumoTd(
  map: L.Map,
  opts?: { painelMaxRem?: number }
): { paddingTopLeft: L.Point; paddingBottomRight: L.Point } {
  const sz = map.getSize()
  if (sz.x < 64 || sz.y < 64) {
    return { paddingTopLeft: L.point(10, 10), paddingBottomRight: L.point(10, 10) }
  }
  const vw = typeof window !== 'undefined' ? window.innerWidth : sz.x
  /** Alinhado ao painel: `right-5` … `lg:right-10` — faixa livre do mapa à esquerda do resumo. */
  const direitaRem = vw >= 1024 ? 2.5 : vw >= 640 ? 2 : 1.5
  const margemDireitaPx = Math.round(direitaRem * 16)
  /** Largura máx. do painel (rem) — maior quando a sidebar do dashboard está recolhida. */
  const painelMaxRem = opts?.painelMaxRem ?? 34
  const painelLarguraPx = Math.min(painelMaxRem * 16, Math.max(300, Math.round(sz.x * 0.42)))
  const minFitW = 168
  let reserveDireita = margemDireitaPx + painelLarguraPx + 56
  reserveDireita = Math.max(reserveDireita, Math.round(sz.x * 0.31))
  reserveDireita = Math.min(reserveDireita, Math.max(margemDireitaPx + 120, sz.x - 52 - minFitW))
  const reserveEsquerda = Math.round(Math.min(58, Math.max(46, sz.x * 0.085)))
  reserveDireita = Math.min(reserveDireita, sz.x - reserveEsquerda - minFitW)
  /** Menos reserva no topo + um pouco mais embaixo = encaixe “puxa” o PI para cima na área útil. */
  const reserveTopo = Math.round(Math.min(32, Math.max(14, sz.y * 0.028)))
  const reserveBaixo = Math.round(Math.min(72, Math.max(40, sz.y * 0.09)))
  return {
    paddingTopLeft: L.point(reserveEsquerda, reserveTopo),
    paddingBottomRight: L.point(reserveDireita, reserveBaixo),
  }
}

/** Mesmas margens em ambos os lados: o encaixe fica no centro do contain (TD / município). */
function paddingFitCentralizadoNoMapa(map: L.Map): { paddingTopLeft: L.Point; paddingBottomRight: L.Point } {
  const sz = map.getSize()
  if (sz.x < 64 || sz.y < 64) {
    return { paddingTopLeft: L.point(12, 12), paddingBottomRight: L.point(12, 12) }
  }
  const mx = Math.round(Math.min(88, Math.max(20, sz.x * 0.08)))
  const my = Math.round(Math.min(80, Math.max(18, sz.y * 0.08)))
  return {
    paddingTopLeft: L.point(mx, my),
    paddingBottomRight: L.point(mx, my),
  }
}

type FitBoundsPaddingMapaTd = 'painelResumoTd' | 'centro'

/** Após `fitBounds`, aproxima um nível (ex.: vista inicial do PI). */
function incrementarZoomAposEncaixeSePossivel(map: L.Map, niveis: number) {
  if (niveis <= 0) return
  const cap = Math.min(map.getMaxZoom(), 16)
  const z0 = map.getZoom()
  const nextZ = Math.min(z0 + niveis, cap)
  if (nextZ > z0) map.setZoom(nextZ, { animate: false })
}

function fitBoundsWithSidebarShift(
  map: L.Map,
  geoBounds: L.LatLngBounds,
  opts?: {
    padGeo?: number
    animate?: boolean
    paddingMapa?: FitBoundsPaddingMapaTd
    /** Níveis extras de zoom após o encaixe (só vista PI inteiro no carregamento / refit full). */
    incrementarZoomAposEncaixe?: number
    /** Largura máx. do painel “Resumo por TD” em rem (alinhado ao CSS do aside). */
    painelResumoMaxRem?: number
  }
) {
  const padGeo = opts?.padGeo ?? 0.05
  const animate = opts?.animate ?? false
  const paddingMapa = opts?.paddingMapa ?? 'painelResumoTd'
  const extraZoom = opts?.incrementarZoomAposEncaixe ?? 0
  const painelResumoMaxRem = opts?.painelResumoMaxRem
  map.invalidateSize({ animate: false, pan: false })
  if (!geoBounds.isValid()) return

  const { paddingTopLeft, paddingBottomRight } =
    paddingMapa === 'centro'
      ? paddingFitCentralizadoNoMapa(map)
      : paddingFitEvitandoPainelResumoTd(map, painelResumoMaxRem != null ? { painelMaxRem: painelResumoMaxRem } : undefined)
  const fitOpts: L.FitBoundsOptions = {
    animate,
    paddingTopLeft,
    paddingBottomRight,
  }
  if (animate) {
    fitOpts.duration = 0.42
  }
  map.fitBounds(geoBounds.pad(padGeo), fitOpts)

  if (extraZoom <= 0) return
  const aplicarZoomExtra = () => incrementarZoomAposEncaixeSePossivel(map, extraZoom)
  if (animate) {
    map.once('moveend', aplicarZoomExtra)
  } else {
    aplicarZoomExtra()
  }
}

function boundsFromGeoJson(geo: GeoJSON.GeoJSON | null): L.LatLngBounds | null {
  if (!geo) return null
  try {
    const layer = L.geoJSON(geo)
    const b = layer.getBounds()
    return b.isValid() ? b : null
  } catch {
    return null
  }
}

/** Largura ÷ altura do retângulo geográfico (ajuste cos(lat) p/ longitude). */
function larguraSobreAlturaEncaixeBounds(bounds: L.LatLngBounds): number {
  if (!bounds.isValid()) return 0.62
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  const latSpan = Math.abs(ne.lat - sw.lat)
  const lngSpan = Math.abs(ne.lng - sw.lng)
  if (latSpan < 1e-7) return 0.62
  const meanLat = (sw.lat + ne.lat) / 2
  const cosLat = Math.cos((meanLat * Math.PI) / 180)
  return (lngSpan * cosLat) / latSpan
}

/** Encaixa retângulo filho w×h (proporção fixa) dentro do pai (object-fit: contain). */
function dimensoesRetanguloContido(parentW: number, parentH: number, larguraSobreAltura: number): { w: number; h: number } {
  if (parentW <= 0 || parentH <= 0) return { w: 0, h: 0 }
  const r = larguraSobreAltura > 1e-6 ? larguraSobreAltura : 0.62
  const parentRatio = parentW / parentH
  if (parentRatio > r) {
    const h = Math.floor(parentH)
    const w = Math.max(1, Math.floor(h * r))
    return { w, h }
  }
  const w = Math.floor(parentW)
  const h = Math.max(1, Math.floor(w / r))
  return { w, h }
}

function ajustarCaixaMapaAoViewportPiaui(
  viewportEl: HTMLDivElement | null,
  aspectBoxEl: HTMLDivElement | null,
  larguraSobreAltura: number
) {
  if (!viewportEl || !aspectBoxEl) return

  /**
   * Modo "colar-ao-painel": o viewportFitRef tem classe `td-fut-vp-shrink`.
   * Neste modo derivamos a largura a partir da ALTURA (flex-stretch garante que
   * o elemento tem a altura do container) e depois definimos o width explicitamente,
   * para que a coluna do mapa tenha exactamente o tamanho do Piauí, sem vão.
   */
  const shrinkToMap = viewportEl.classList.contains('td-fut-vp-shrink')
  if (shrinkToMap) viewportEl.style.width = '' // reset para ler a altura correcta

  let W = viewportEl.clientWidth
  let H = viewportEl.clientHeight
  if (typeof window !== 'undefined') {
    const cs = window.getComputedStyle(viewportEl)
    const padL = Number.parseFloat(cs.paddingLeft) || 0
    const padR = Number.parseFloat(cs.paddingRight) || 0
    const padT = Number.parseFloat(cs.paddingTop) || 0
    const padB = Number.parseFloat(cs.paddingBottom) || 0
    W = Math.max(0, W - padL - padR)
    H = Math.max(0, H - padT - padB)
  }

  if (shrinkToMap) {
    if (H < 32) return
    const h = Math.floor(H)
    const w = Math.max(1, Math.floor(h * larguraSobreAltura))
    viewportEl.style.width = `${w}px`
    aspectBoxEl.style.width = `${w}px`
    aspectBoxEl.style.height = `${h}px`
    return
  }

  if (W < 32 || H < 32) return
  const { w, h } = dimensoesRetanguloContido(W, H, larguraSobreAltura)
  aspectBoxEl.style.width = `${w}px`
  aspectBoxEl.style.height = `${h}px`
}

/**
 * Polígono = retângulo amplo − contorno da UF, para cobrir vizinhos e oceano com cor sólida,
 * deixando só o interior do Piauí com o mapa-base (tiles) visível.
 */
function buildOutsidePiauiMask(geoUf: GeoJSON.GeoJSON): GeoJSON.Feature | null {
  if (geoUf.type !== 'FeatureCollection') return null
  const fc = geoUf as GeoJSON.FeatureCollection
  const ufFeat = fc.features[0]
  if (!ufFeat?.geometry) return null
  try {
    const bb = bbox(ufFeat)
    const pad = 14
    const big = bboxPolygon([bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad])
    const diffInput = featureCollection([big, ufFeat]) as GeoJSON.FeatureCollection<
      GeoJSON.Polygon | GeoJSON.MultiPolygon
    >
    const mask = difference(diffInput)
    return mask ?? null
  } catch {
    return null
  }
}

const fmtInt = new Intl.NumberFormat('pt-BR')

const fmtPctExpSobreEleit = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Expectativa de votos (planilha) ÷ eleitorado (TD ou município). */
function formatarPctVotosSobreEleitores(votos: number, eleitores: number): string | null {
  if (eleitores <= 0 || !Number.isFinite(votos)) return null
  const pct = (votos / eleitores) * 100
  if (!Number.isFinite(pct)) return null
  return `${fmtPctExpSobreEleit.format(pct).replace(/\u00a0/g, '')}%`
}

function formatarIntComSinal(n: number): string {
  const r = Math.round(n)
  const abs = fmtInt.format(Math.abs(r))
  if (r > 0) return `+${abs}`
  if (r < 0) return `-${abs}`
  return fmtInt.format(0)
}

type EstrategiaTopFed22DetalheCandidato = { nome: string; votosPi: number; votosNoTd: number }

type EstrategiaTopFed22LinhaTd = {
  mediaVotos: number
  detalheCandidatos: EstrategiaTopFed22DetalheCandidato[]
}

type Fed22TopPartidoDetalheTd = { partido: string; votosPi: number; votosNoTd: number }

function montarTooltipMedTop22Celula(
  territorio: string,
  detalhe: readonly EstrategiaTopFed22DetalheCandidato[],
  mediaTd: number,
  fmt: Intl.NumberFormat
): string {
  if (detalhe.length === 0) {
    return `Média no TD ${territorio}: ${fmt.format(Math.round(mediaTd))}.`
  }
  const cabeca = `${territorio}`
  const linhas = detalhe.map(
    (c) =>
      `${c.nome}: ${fmt.format(c.votosNoTd)} votos no TD · ${fmt.format(c.votosPi)} no PI (total estadual)`
  )
  const mediaLinha = `Média no TD: ${fmt.format(Math.round(mediaTd))} (média dos votos no território dos ${detalhe.length} federais do top local em 2022)`
  return [cabeca, ...linhas, mediaLinha].join('\n')
}

/**
 * maxBounds muito apertado no contorno da UF faz o listener `moveend` →
 * `_panInsideMaxBounds` recolocar o centro e anular o deslocamento rumo à sidebar.
 * Esta caixa (Nordeste + margem) só impede o mapa de “sumir” do continente.
 */
const MAX_BOUNDS_MAPA_TD = L.latLngBounds(L.latLng(-18, -56), L.latLng(8, -30))

const AGREGADO_PLANILHA_VAZIO: AgregadoPlanilhaPorTd = {
  liderancas: 0,
  votosAnterior: 0,
  votosAferido: 0,
  votosPromessa: 0,
}

/** Encaixa todo o Piauí deixando margem para o painel “Resumo por TD”. */
function enquadrarPiauiPertoDaSidebar(map: L.Map, piauiBounds: L.LatLngBounds, painelResumoMaxRem?: number) {
  const geo = piauiBounds.isValid() ? piauiBounds : MAX_BOUNDS_MAPA_TD
  if (!geo.isValid()) return
  fitBoundsWithSidebarShift(map, geo, {
    padGeo: 0.05,
    animate: false,
    paddingMapa: 'painelResumoTd',
    incrementarZoomAposEncaixe: 1,
    ...(painelResumoMaxRem != null ? { painelResumoMaxRem } : {}),
  })
  /** +y desloca o pano do mapa para baixo → o PI sobe na seção (mais perto do topo). */
  const h = map.getSize().y
  if (h >= 64) {
    const dy = Math.round(Math.min(120, Math.max(56, h * 0.11)))
    map.panBy(L.point(0, dy), { animate: false })
  }
}

/** Largura máx. do painel “Resumo por TD” (rem), alinhada ao CSS e ao padding do fitBounds. */
const PAINEL_RESUMO_TD_MAX_REM_EXPANDED = 34
const PAINEL_RESUMO_TD_MAX_REM_COLLAPSED = 46
/** Quando `false`, desativa zoom/enquadramento automáticos; usuário controla no +/-. */
const MAPA_AUTO_ZOOM_ENABLED = false
const STORAGE_CANDIDATO_PESQUISA = 'candidatoPadraoPesquisa'

type TdSortKey =
  | 'rank'
  | 'territorio'
  | 'municipios'
  | 'eleitores'
  | 'fed22'
  | 'estrategia'
  | 'fed26'
  | 'delta'
  | 'tend'
  | 'lid'
  | 'vis'
  | 'prioridade'
type TdSortDirection = 'asc' | 'desc'

const fmtPctVariacaoDeltaTd = new Intl.NumberFormat('pt-BR', {
  signDisplay: 'exceptZero',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const fmtIntTooltipTd = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/** % da diferença (Δ ÷ Fed.22) — apenas texto, sem barra. */
function TdPctDeltaCelula({ v22, delta }: { v22: number; delta: number }) {
  const podePct = v22 > 0
  const pctNum = podePct ? (delta / v22) * 100 : delta === 0 && v22 === 0 ? 0 : null
  const label = pctNum === null ? '—' : `${fmtPctVariacaoDeltaTd.format(pctNum)}%`
  const title = podePct
    ? `Δ ${formatarIntComSinal(delta)} votos (${fmtPctVariacaoDeltaTd.format((delta / v22) * 100)}% em relação aos ${fmtIntTooltipTd.format(v22)} votos Fed.22 no TD)`
    : v22 === 0 && delta !== 0
      ? 'Fed.22 = 0 neste TD; percentual da diferença indefinido.'
      : 'Fed.22 = 0 e diferença nula neste TD.'

  return (
    <span
      className={cn(
        'inline-block text-center tabular-nums text-[9px] font-medium leading-none sm:text-[10px]',
        pctNum !== null && delta > 0 && 'text-status-success',
        pctNum !== null && delta < 0 && 'text-status-danger',
        (pctNum === null || delta === 0) && 'text-text-secondary'
      )}
      title={title}
    >
      {label}
    </span>
  )
}

type MapaTerritoriosDesenvolvimentoLeafletProps = {
  /** `futuristic` = mapa monocromático + painel cockpit (rota mapa-tds). */
  visualPreset?: 'default' | 'futuristic'
}

export function MapaTerritoriosDesenvolvimentoLeaflet({ visualPreset = 'default' }: MapaTerritoriosDesenvolvimentoLeafletProps) {
  const { collapsed: sidebarCollapsed } = useSidebar()
  const painelResumoMaxRemRef = useRef(PAINEL_RESUMO_TD_MAX_REM_EXPANDED)

  const rootRef = useRef<HTMLDivElement>(null)
  const viewportFitRef = useRef<HTMLDivElement>(null)
  const aspectBoxRef = useRef<HTMLDivElement>(null)
  const piauiAspectRatioRef = useRef(0.62)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const mapTdControllerRef = useRef<MapaTdController | null>(null)
  const geoStyleContextRef = useRef<GeoStyleContext>({
    classificacao: new Map(),
    hoverTdTabela: null,
    visualPreset,
    maiorPesoTd: null,
    piorDeltaTd: null,
    deltasDistintos: false,
  })
  const highlightedTdRef = useRef<TerritorioDesenvolvimentoPI | null>(null)
  const municipioFocadoLiderancasRef = useRef<string | null>(null)
  const skipRefitFullOnInitialNullRef = useRef(true)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [highlightedTd, setHighlightedTd] = useState<TerritorioDesenvolvimentoPI | null>(null)
  const [tdSort, setTdSort] = useState<{ key: TdSortKey; direction: TdSortDirection }>({
    key: 'rank',
    direction: 'asc',
  })

  const [municipioFocadoLiderancas, setMunicipioFocadoLiderancas] = useState<string | null>(null)
  const [hoverTdTabela, setHoverTdTabela] = useState<TerritorioDesenvolvimentoPI | null>(null)

  const mapFilterActionsRef = useRef<{
    setHighlightedTd: (v: TerritorioDesenvolvimentoPI | null) => void
    setMunicipioFocadoLiderancas: (v: string | null) => void
  }>({
    setHighlightedTd: () => {},
    setMunicipioFocadoLiderancas: () => {},
  })
  mapFilterActionsRef.current.setHighlightedTd = setHighlightedTd
  mapFilterActionsRef.current.setMunicipioFocadoLiderancas = setMunicipioFocadoLiderancas

  highlightedTdRef.current = highlightedTd
  municipioFocadoLiderancasRef.current = municipioFocadoLiderancas

  const resumoPorTd = useMemo(() => getResumoPorTerritorioDesenvolvimentoPI(), [])
  const totaisResumo = useMemo(() => getTotaisResumoTerritorioPI(resumoPorTd), [resumoPorTd])
  const opcoesFiltroMunicipio = useMemo(() => {
    const municipiosPorNomeNormalizado = new Map<string, string>()
    for (const resumo of resumoPorTd) {
      for (const municipio of getMunicipiosPorTerritorioDesenvolvimentoPI(resumo.territorio)) {
        const nome = String(municipio ?? '').trim()
        if (!nome) continue
        const nomeNormalizado = normalizeMunicipioNome(nome)
        if (!municipiosPorNomeNormalizado.has(nomeNormalizado)) {
          municipiosPorNomeNormalizado.set(nomeNormalizado, nome)
        }
      }
    }
    return Array.from(municipiosPorNomeNormalizado.values()).sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
    )
  }, [resumoPorTd])

  const aplicarFiltroMunicipioPainel = (municipioSelecionado: string) => {
    const municipio = municipioSelecionado.trim()
    if (!municipio) {
      setMunicipioFocadoLiderancas(null)
      setHighlightedTd(null)
      return
    }
    const tdMunicipio = getTerritorioDesenvolvimentoPI(municipio)
    if (!tdMunicipio) {
      setMunicipioFocadoLiderancas(null)
      setHighlightedTd(null)
      return
    }
    setHighlightedTd(tdMunicipio)
    setMunicipioFocadoLiderancas(municipio)
  }

  type PlanilhaTerritorioEstado = 'idle' | 'loading' | 'skipped' | 'ready' | 'error'
  const [planilhaEstado, setPlanilhaEstado] = useState<PlanilhaTerritorioEstado>('idle')
  const [planilhaHeaders, setPlanilhaHeaders] = useState<string[]>([])
  const [planilhaRecords, setPlanilhaRecords] = useState<LiderancaPlanilha[]>([])
  const [planilhaErro, setPlanilhaErro] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setPlanilhaEstado('loading')
      setPlanilhaErro('')
      try {
        const cfgRes = await fetch('/api/territorio/config')
        const cfg = (await cfgRes.json()) as { configured?: boolean }
        if (cancelled) return
        if (!cfg.configured) {
          setPlanilhaEstado('skipped')
          setPlanilhaHeaders([])
          setPlanilhaRecords([])
          return
        }
        const dataRes = await fetch('/api/territorio/google-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const data = (await dataRes.json()) as { records?: LiderancaPlanilha[]; headers?: string[]; error?: string }
        if (cancelled) return
        if (!dataRes.ok) {
          setPlanilhaEstado('error')
          setPlanilhaErro(String(data.error ?? 'Erro ao carregar planilha'))
          setPlanilhaHeaders([])
          setPlanilhaRecords([])
          return
        }
        setPlanilhaEstado('ready')
        setPlanilhaHeaders(data.headers ?? [])
        setPlanilhaRecords(data.records ?? [])
      } catch (e) {
        if (!cancelled) {
          setPlanilhaEstado('error')
          setPlanilhaErro(e instanceof Error ? e.message : 'Erro ao conectar')
          setPlanilhaHeaders([])
          setPlanilhaRecords([])
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const colunasPlanilha = useMemo(
    () => resolverColunasLiderancaTerritorio(planilhaHeaders),
    [planilhaHeaders]
  )
  const cidadeColPlanilha =
    colunasPlanilha.cidadeCol ||
    (planilhaHeaders.length > 1 ? planilhaHeaders[1] : '') ||
    ''

  const liderancasFiltradasPlanilha = useMemo(() => {
    if (planilhaEstado !== 'ready' || !cidadeColPlanilha) return [] as LiderancaPlanilha[]
    return filtrarLiderancasRelevantesPlanilha(planilhaRecords, colunasPlanilha)
  }, [planilhaEstado, planilhaRecords, colunasPlanilha, cidadeColPlanilha])

  const agregadoTdPlanilha = useMemo(() => {
    if (planilhaEstado !== 'ready' || !cidadeColPlanilha) {
      return agregarLiderancasPorTdPlanilha([], '_', colunasPlanilha)
    }
    return agregarLiderancasPorTdPlanilha(liderancasFiltradasPlanilha, cidadeColPlanilha, colunasPlanilha)
  }, [planilhaEstado, cidadeColPlanilha, liderancasFiltradasPlanilha, colunasPlanilha])

  const totaisPlanilhaTd = useMemo(() => somarAgregadosPlanilhaTd(agregadoTdPlanilha), [agregadoTdPlanilha])

  type Fed22LoadState = 'idle' | 'loading' | 'ok' | 'error'
  const [fed22LoadState, setFed22LoadState] = useState<Fed22LoadState>('idle')
  const [mapaFed22Municipios, setMapaFed22Municipios] = useState<Map<string, number> | null>(null)
  const [totalFed22Pi, setTotalFed22Pi] = useState<number>(0)
  const [estrategiaTopFed22PorTd, setEstrategiaTopFed22PorTd] = useState<
    Map<TerritorioDesenvolvimentoPI, EstrategiaTopFed22LinhaTd>
  >(() => new Map())
  const [estrategiaTopFed22TopN, setEstrategiaTopFed22TopN] = useState<number>(0)
  /** Média Top5 Fed.22 por município (mesmos candidatos do top por TD que na tabela de TDs). */
  const [mediaTop22PorMunicipioNorm, setMediaTop22PorMunicipioNorm] = useState<Map<string, number>>(() => new Map())
  /** Top N partidos (soma votos federais 2022) por TD — painel de feedback. */
  const [topPartidosFed22PorTd, setTopPartidosFed22PorTd] = useState<
    Map<TerritorioDesenvolvimentoPI, Fed22TopPartidoDetalheTd[]>
  >(() => new Map())

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setFed22LoadState('loading')
      try {
        const data = await fetchJadyelFederal2022VotosPorMunicipioPI()
        if (cancelled) return
        if (!data) {
          setFed22LoadState('error')
          setMapaFed22Municipios(null)
          setTotalFed22Pi(0)
          return
        }
        setMapaFed22Municipios(data.mapaNormalizado)
        setTotalFed22Pi(data.totalVotos)
        setFed22LoadState('ok')
      } catch {
        if (!cancelled) {
          setFed22LoadState('error')
          setMapaFed22Municipios(null)
          setTotalFed22Pi(0)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const [resTd, resMun, resPart] = await Promise.all([
          fetch('/api/resumo-eleicoes?totals=federal2022TopMediaPorTd&top=5'),
          fetch('/api/resumo-eleicoes?totals=federal2022TopMediaPorMunicipio&top=5'),
          fetch('/api/resumo-eleicoes?totals=federal2022TopPartidoPorTd&top=5'),
        ])
        if (cancelled) return

        const jsonTd = (await resTd.json().catch(() => ({}))) as {
          linhas?: {
            territorio?: string
            mediaVotos?: number
            detalheCandidatos?: { nome?: string; votosPi?: number; votosNoTd?: number }[]
          }[]
          top?: number
        }
        if (!resTd.ok) {
          if (!cancelled) {
            setEstrategiaTopFed22PorTd(new Map())
            setEstrategiaTopFed22TopN(0)
            setMediaTop22PorMunicipioNorm(new Map())
            setTopPartidosFed22PorTd(new Map())
          }
          return
        }
        const mapa = new Map<TerritorioDesenvolvimentoPI, EstrategiaTopFed22LinhaTd>()
        for (const item of jsonTd.linhas ?? []) {
          const territorio = (item.territorio ?? '') as TerritorioDesenvolvimentoPI
          if (!territorio) continue
          const detalheCandidatos: EstrategiaTopFed22DetalheCandidato[] = (item.detalheCandidatos ?? [])
            .map((d) => ({
              nome: String(d.nome ?? '').trim(),
              votosPi: Number(d.votosPi ?? 0),
              votosNoTd: Number(d.votosNoTd ?? 0),
            }))
            .filter((d) => d.nome.length > 0)
          mapa.set(territorio, {
            mediaVotos: Number(item.mediaVotos || 0),
            detalheCandidatos,
          })
        }
        if (!cancelled) {
          setEstrategiaTopFed22PorTd(mapa)
          setEstrategiaTopFed22TopN(Number(jsonTd.top || 0))
        }

        if (resMun.ok) {
          const jsonMun = (await resMun.json()) as {
            linhas?: { municipio?: string; mediaVotos?: number }[]
          }
          const mm = new Map<string, number>()
          for (const row of jsonMun.linhas ?? []) {
            const mun = String(row.municipio ?? '').trim()
            if (!mun) continue
            mm.set(normalizeMunicipioNome(mun), Number(row.mediaVotos) || 0)
          }
          if (!cancelled) setMediaTop22PorMunicipioNorm(mm)
        } else if (!cancelled) {
          setMediaTop22PorMunicipioNorm(new Map())
        }

        if (resPart.ok) {
          const jsonPart = (await resPart.json().catch(() => ({}))) as {
            linhas?: {
              territorio?: string
              detalhePartidos?: { partido?: string; votosPi?: number; votosNoTd?: number }[]
            }[]
          }
          const mapPart = new Map<TerritorioDesenvolvimentoPI, Fed22TopPartidoDetalheTd[]>()
          for (const item of jsonPart.linhas ?? []) {
            const territorio = (item.territorio ?? '') as TerritorioDesenvolvimentoPI
            if (!territorio) continue
            const detalhePartidos: Fed22TopPartidoDetalheTd[] = (item.detalhePartidos ?? []).map((d) => ({
              partido: String(d.partido ?? '').trim() || '—',
              votosPi: Number(d.votosPi ?? 0),
              votosNoTd: Number(d.votosNoTd ?? 0),
            }))
            mapPart.set(territorio, detalhePartidos)
          }
          if (!cancelled) setTopPartidosFed22PorTd(mapPart)
        } else if (!cancelled) {
          setTopPartidosFed22PorTd(new Map())
        }
      } catch {
        if (!cancelled) {
          setEstrategiaTopFed22PorTd(new Map())
          setEstrategiaTopFed22TopN(0)
          setMediaTop22PorMunicipioNorm(new Map())
          setTopPartidosFed22PorTd(new Map())
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const temDadosEstrategiaTopFed22 = estrategiaTopFed22PorTd.size > 0

  const tooltipMedTop22Header = useMemo(() => {
    const n = estrategiaTopFed22TopN || 5
    return `Média dos ${n} deputados federais com mais votos em 2022 dentro de cada território (soma nominal nos municípios do TD ÷ ${n}). O ranking do top é por TD, não pelo resultado geral no Piauí. Passe o mouse na célula de um TD para ver os nomes.`
  }, [estrategiaTopFed22TopN])

  const temDadosFed22 = fed22LoadState === 'ok' && mapaFed22Municipios !== null
  const votosFed22PorTd = useMemo(() => {
    if (!mapaFed22Municipios) return new Map<TerritorioDesenvolvimentoPI, number>()
    return montarMapaVotos2022JadyelPorTd(mapaFed22Municipios)
  }, [mapaFed22Municipios])

  const painelPlanilhaAtivo =
    planilhaEstado === 'ready' && planilhaHeaders.length > 0 && Boolean(cidadeColPlanilha)

  const temColunaVotosAnterior = Boolean(colunasPlanilha.expectativaLegadoCol)
  const temColunaVotosAferido = Boolean(colunasPlanilha.expectativaJadyelCol)

  const [cenarioVotosPainelMapaTd, setCenarioVotosPainelMapaTd] = useState<CenarioVotosPainelMapaTd>('anterior')

  const cenarioVotosExibicao = useMemo((): CenarioVotosPainelMapaTd | null => {
    if (!temColunaVotosAnterior && !temColunaVotosAferido) return null
    if (temColunaVotosAnterior && !temColunaVotosAferido) return 'anterior'
    if (!temColunaVotosAnterior && temColunaVotosAferido) return 'aferido'
    return cenarioVotosPainelMapaTd
  }, [temColunaVotosAnterior, temColunaVotosAferido, cenarioVotosPainelMapaTd])

  const opcoesCenarioPainel = useMemo(() => {
    const o: { id: CenarioVotosPainelMapaTd; label: string }[] = []
    if (temColunaVotosAnterior) {
      o.push({ id: 'anterior', label: 'FED.26 (votos 2026)' })
    }
    if (temColunaVotosAferido) {
      o.push({ id: 'aferido', label: 'Aferido (Jadyel 2026)' })
    }
    return o
  }, [temColunaVotosAnterior, temColunaVotosAferido])

  const mostrarSeletorCenario =
    painelPlanilhaAtivo && temColunaVotosAnterior && temColunaVotosAferido

  useEffect(() => {
    if (!painelPlanilhaAtivo) return
    if (temColunaVotosAnterior && !temColunaVotosAferido) {
      setCenarioVotosPainelMapaTd('anterior')
      return
    }
    if (!temColunaVotosAnterior && temColunaVotosAferido) {
      setCenarioVotosPainelMapaTd('aferido')
      return
    }
    setCenarioVotosPainelMapaTd((prev) => {
      if (prev === 'anterior' && temColunaVotosAnterior) return prev
      if (prev === 'aferido' && temColunaVotosAferido) return prev
      return 'anterior'
    })
  }, [painelPlanilhaAtivo, temColunaVotosAnterior, temColunaVotosAferido])

  const mostrarColunaDeltaFed22 = temDadosFed22 && painelPlanilhaAtivo && cenarioVotosExibicao !== null

  const mostrarColunaTendenciaFuturista =
    visualPreset === 'futuristic' && mostrarColunaDeltaFed22 && cenarioVotosExibicao !== null

  /** Check-ins Campo & Agenda (PI) por TD e por município — `/api/campo/visitas-resumo-td`. */
  const [visitasPorTdCampo, setVisitasPorTdCampo] = useState<Map<TerritorioDesenvolvimentoPI, number>>(
    () => new Map()
  )
  const [visitasPorMunicipioNorm, setVisitasPorMunicipioNorm] = useState<Map<string, number>>(() => new Map())
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/campo/visitas-resumo-td')
        if (cancelled || !res.ok) return
        const data = (await res.json()) as {
          porTd?: { territorio: string; visitas: number }[]
          municipios?: { territorio: string; municipio: string; visitas: number }[]
        }
        const mTd = new Map<TerritorioDesenvolvimentoPI, number>()
        for (const row of data.porTd ?? []) {
          mTd.set(row.territorio as TerritorioDesenvolvimentoPI, Number(row.visitas) || 0)
        }
        const mMun = new Map<string, number>()
        for (const row of data.municipios ?? []) {
          mMun.set(normalizeMunicipioNome(row.municipio), Number(row.visitas) || 0)
        }
        if (!cancelled) {
          setVisitasPorTdCampo(mTd)
          setVisitasPorMunicipioNorm(mMun)
        }
      } catch {
        /* sessão ausente ou falha de rede: mantém zeros */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /** Totais estaduais (soma dos 12 TDs) — rodapé da tabela, independente de filtro/expansão na lista. */
  const totaisRodapePainelTd = useMemo(() => {
    let somaFed22 = 0
    let somaEstrategiaExibida = 0
    let visitasTd = 0
    for (const r of resumoPorTd) {
      somaFed22 += votosFed22PorTd.get(r.territorio) ?? 0
      const estrategiaTd = estrategiaTopFed22PorTd.get(r.territorio)?.mediaVotos ?? 0
      somaEstrategiaExibida += Math.round(estrategiaTd)
      visitasTd += visitasPorTdCampo.get(r.territorio) ?? 0
    }
    const votosPlanCenario =
      painelPlanilhaAtivo && cenarioVotosExibicao
        ? Math.round(valorVotosAgregadoTd(totaisPlanilhaTd, cenarioVotosExibicao))
        : 0
    const delta =
      temDadosFed22 && painelPlanilhaAtivo && cenarioVotosExibicao !== null
        ? votosPlanCenario - somaFed22
        : 0
    const liderancas = painelPlanilhaAtivo ? totaisPlanilhaTd.liderancas : 0
    return {
      municipios: totaisResumo.municipios,
      eleitores: totaisResumo.eleitores,
      somaFed22,
      somaEstrategiaExibida,
      votosPlanCenario,
      delta,
      liderancas,
      visitasTd,
    }
  }, [
    totaisResumo,
    resumoPorTd,
    votosFed22PorTd,
    estrategiaTopFed22PorTd,
    painelPlanilhaAtivo,
    cenarioVotosExibicao,
    totaisPlanilhaTd,
    temDadosFed22,
    visitasPorTdCampo,
  ])

  const [painelDadosAtualizadoEm, setPainelDadosAtualizadoEm] = useState<Date | null>(null)
  useEffect(() => {
    if (loadState !== 'ready') return
    setPainelDadosAtualizadoEm(new Date())
  }, [loadState, planilhaEstado, fed22LoadState])

  /**
   * Mesmo `grid-template-columns` no cabeçalho e em cada linha.
   * Ordem alinhada ao resumo por TD: Eleit. → Méd.Top5 22 → Fed.22 → Fed.26 → Δ → % EXP. → Lid. → Vis.
   */
  const gridTemplateListaMunicipiosPainelTd = useMemo(() => {
    const cols: string[] = ['minmax(5.5rem, 1.35fr)', 'minmax(3.75rem, max-content)']
    if (temDadosEstrategiaTopFed22) {
      cols.push('minmax(3.15rem, max-content)')
    }
    if (temDadosFed22) {
      cols.push('minmax(3.5rem, max-content)')
    }
    if (painelPlanilhaAtivo) {
      cols.push('minmax(1.75rem, max-content)')
      if (cenarioVotosExibicao) {
        cols.push('minmax(3.75rem, max-content)')
      }
    }
    if (mostrarColunaDeltaFed22) {
      cols.push('minmax(3.25rem, max-content)')
    }
    cols.push('minmax(2.75rem, max-content)', 'minmax(1.65rem, max-content)')
    return cols.join(' ')
  }, [
    painelPlanilhaAtivo,
    cenarioVotosExibicao,
    temDadosFed22,
    mostrarColunaDeltaFed22,
    temDadosEstrategiaTopFed22,
  ])

  const resumoLinhasVisiveis = useMemo(
    () =>
      highlightedTd !== null
        ? resumoPorTd.filter((r) => r.territorio === highlightedTd)
        : resumoPorTd,
    [highlightedTd, resumoPorTd]
  )

  /** Tercis só entre os 12 TDs: com planilha + expectativa, score = votos/eleitorado; senão, share do eleitorado estadual. */
  const classificacaoPorTd = useMemo(() => {
    const scores = resumoPorTd.map((r) => {
      const ag = agregadoTdPlanilha.get(r.territorio) ?? AGREGADO_PLANILHA_VAZIO
      let score = 0
      if (painelPlanilhaAtivo && cenarioVotosExibicao !== null && r.eleitores > 0) {
        score = valorVotosAgregadoTd(ag, cenarioVotosExibicao) / r.eleitores
      } else if (totaisResumo.eleitores > 0) {
        score = r.eleitores / totaisResumo.eleitores
      }
      return { territorio: r.territorio, score }
    })
    return classificarTerritoriosPorScore(scores)
  }, [
    resumoPorTd,
    agregadoTdPlanilha,
    painelPlanilhaAtivo,
    cenarioVotosExibicao,
    totaisResumo.eleitores,
  ])

  const classificacaoPrioridadePesoFed26PorTd = useMemo(() => {
    const scores = resumoPorTd.map((r) => {
      const ag = agregadoTdPlanilha.get(r.territorio) ?? AGREGADO_PLANILHA_VAZIO
      let score = 0
      if (painelPlanilhaAtivo && temColunaVotosAnterior) {
        score = Math.max(0, valorVotosAgregadoTd(ag, 'anterior'))
      } else if (totaisResumo.eleitores > 0) {
        score = r.eleitores / totaisResumo.eleitores
      }
      return { territorio: r.territorio, score }
    })
    return classificarTerritoriosPorScore(scores)
  }, [resumoPorTd, agregadoTdPlanilha, painelPlanilhaAtivo, temColunaVotosAnterior, totaisResumo.eleitores])

  const classificacaoPrioridadeEficienciaFed26PorTd = useMemo(() => {
    const scores = resumoPorTd.map((r) => {
      const ag = agregadoTdPlanilha.get(r.territorio) ?? AGREGADO_PLANILHA_VAZIO
      let score = 0
      if (painelPlanilhaAtivo && temColunaVotosAnterior && r.eleitores > 0) {
        score = Math.max(0, valorVotosAgregadoTd(ag, 'anterior')) / r.eleitores
      } else if (totaisResumo.eleitores > 0) {
        score = r.eleitores / totaisResumo.eleitores
      }
      return { territorio: r.territorio, score }
    })
    return classificarTerritoriosPorScore(scores)
  }, [resumoPorTd, agregadoTdPlanilha, painelPlanilhaAtivo, temColunaVotosAnterior, totaisResumo.eleitores])

  const detalhesPrioridadePorTd = useMemo(() => {
    const detalhes = new Map<
      TerritorioDesenvolvimentoPI,
      {
        votosFed26: number
        pesoFed26Pct: number
        rankPesoFed26: number
        eficienciaFed26Pct: number
        rankEficienciaFed26: number
      }
    >()
    if (resumoPorTd.length === 0) return detalhes

    const linhas = resumoPorTd.map((r) => {
      const ag = agregadoTdPlanilha.get(r.territorio) ?? AGREGADO_PLANILHA_VAZIO
      const votosFed26 = Math.max(0, Math.round(valorVotosAgregadoTd(ag, 'anterior')))
      const eficienciaFed26Pct = r.eleitores > 0 ? (votosFed26 / r.eleitores) * 100 : 0
      return { territorio: r.territorio, votosFed26, eficienciaFed26Pct }
    })

    const totalFed26Estado = linhas.reduce((acc, l) => acc + l.votosFed26, 0)
    const rankingPeso = [...linhas].sort(
      (a, b) => b.votosFed26 - a.votosFed26 || a.territorio.localeCompare(b.territorio, 'pt-BR')
    )
    const rankingEficiencia = [...linhas].sort(
      (a, b) => b.eficienciaFed26Pct - a.eficienciaFed26Pct || a.territorio.localeCompare(b.territorio, 'pt-BR')
    )
    const rankPesoMap = new Map<TerritorioDesenvolvimentoPI, number>()
    const rankEficMap = new Map<TerritorioDesenvolvimentoPI, number>()
    rankingPeso.forEach((l, i) => rankPesoMap.set(l.territorio, i + 1))
    rankingEficiencia.forEach((l, i) => rankEficMap.set(l.territorio, i + 1))

    for (const l of linhas) {
      detalhes.set(l.territorio, {
        votosFed26: l.votosFed26,
        pesoFed26Pct: totalFed26Estado > 0 ? (l.votosFed26 / totalFed26Estado) * 100 : 0,
        rankPesoFed26: rankPesoMap.get(l.territorio) ?? linhas.length,
        eficienciaFed26Pct: l.eficienciaFed26Pct,
        rankEficienciaFed26: rankEficMap.get(l.territorio) ?? linhas.length,
      })
    }
    return detalhes
  }, [resumoPorTd, agregadoTdPlanilha])

  const maxEleitoresTdResumo = useMemo(
    () => Math.max(1, ...resumoPorTd.map((r) => r.eleitores)),
    [resumoPorTd]
  )

  const territoriosEmAtencao = useMemo(() => {
    let n = 0
    for (const v of classificacaoPorTd.values()) {
      if (v === 'atencao') n += 1
    }
    return n
  }, [classificacaoPorTd])

  /** Ranking 1…12 pelo mesmo critério da prioridade estratégica (score decrescente). */
  const rankingPorTd = useMemo(() => {
    const scores = resumoPorTd.map((r) => {
      const ag = agregadoTdPlanilha.get(r.territorio) ?? AGREGADO_PLANILHA_VAZIO
      let score = 0
      if (painelPlanilhaAtivo && cenarioVotosExibicao !== null && r.eleitores > 0) {
        score = valorVotosAgregadoTd(ag, cenarioVotosExibicao) / r.eleitores
      } else if (totaisResumo.eleitores > 0) {
        score = r.eleitores / totaisResumo.eleitores
      }
      return { territorio: r.territorio, score }
    })
    const sorted = [...scores].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.territorio.localeCompare(b.territorio, 'pt-BR', { sensitivity: 'base' })
    })
    const m = new Map<TerritorioDesenvolvimentoPI, number>()
    sorted.forEach((s, i) => m.set(s.territorio, i + 1))
    return m
  }, [resumoPorTd, agregadoTdPlanilha, painelPlanilhaAtivo, cenarioVotosExibicao, totaisResumo.eleitores])

  const linhasResumoOrdenadas = useMemo(() => {
    const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })
    const prioridadeLabel = (tipo: ClassificacaoTerritorioTd | undefined): string => {
      if (tipo === 'estrategico') return 'Estratégico'
      if (tipo === 'atencao') return 'Atenção'
      return 'Baixo impacto'
    }
    const prioridadePesoTipo = (tipo: ClassificacaoTerritorioTd | undefined): number => {
      if (tipo === 'estrategico') return 3
      if (tipo === 'atencao') return 2
      return 1
    }
    const base = resumoLinhasVisiveis.map((r) => {
      const ag = agregadoTdPlanilha.get(r.territorio) ?? AGREGADO_PLANILHA_VAZIO
      const v22Td = votosFed22PorTd.get(r.territorio) ?? 0
      const blocoEstrategiaTopFed22 = estrategiaTopFed22PorTd.get(r.territorio)
      const estrategiaTd = blocoEstrategiaTopFed22?.mediaVotos ?? 0
      const vPlanTd = cenarioVotosExibicao ? Math.round(valorVotosAgregadoTd(ag, cenarioVotosExibicao)) : 0
      const deltaTd = mostrarColunaDeltaFed22 ? vPlanTd - v22Td : 0
      const rankTd = rankingPorTd.get(r.territorio) ?? Number.POSITIVE_INFINITY
      const classificacaoTd = classificacaoPorTd.get(r.territorio)
      const classificacaoPrioridadePeso = classificacaoPrioridadePesoFed26PorTd.get(r.territorio)
      const classificacaoPrioridadeEficiencia = classificacaoPrioridadeEficienciaFed26PorTd.get(r.territorio)
      const detalhesPrioridade = detalhesPrioridadePorTd.get(r.territorio) ?? null
      const visitasTd = visitasPorTdCampo.get(r.territorio) ?? 0
      return {
        r,
        ag,
        v22Td,
        estrategiaTd,
        vPlanTd,
        deltaTd,
        rankTd,
        classificacaoTd,
        classificacaoPrioridadePeso,
        classificacaoPrioridadeEficiencia,
        detalhesPrioridade,
        prioridadeLabel: prioridadeLabel(classificacaoTd),
        visitasTd,
      }
    })

    base.sort((a, b) => {
      let cmp = 0
      switch (tdSort.key) {
        case 'rank':
          cmp = a.rankTd - b.rankTd
          break
        case 'territorio':
          cmp = collator.compare(a.r.territorio, b.r.territorio)
          break
        case 'municipios':
          cmp = a.r.municipios - b.r.municipios
          break
        case 'eleitores':
          cmp = a.r.eleitores - b.r.eleitores
          break
        case 'fed22':
          cmp = a.v22Td - b.v22Td
          break
        case 'fed26':
          cmp = a.vPlanTd - b.vPlanTd
          break
        case 'estrategia':
          cmp = a.estrategiaTd - b.estrategiaTd
          break
        case 'delta':
        case 'tend':
          cmp = a.deltaTd - b.deltaTd
          break
        case 'lid':
          cmp = a.ag.liderancas - b.ag.liderancas
          break
        case 'vis':
          cmp = a.visitasTd - b.visitasTd
          break
        case 'prioridade':
          cmp =
            prioridadePesoTipo(a.classificacaoPrioridadePeso) -
            prioridadePesoTipo(b.classificacaoPrioridadePeso)
          if (cmp === 0) {
            cmp =
              prioridadePesoTipo(a.classificacaoPrioridadeEficiencia) -
              prioridadePesoTipo(b.classificacaoPrioridadeEficiencia)
          }
          break
      }
      if (cmp === 0) {
        cmp = collator.compare(a.r.territorio, b.r.territorio)
      }
      return tdSort.direction === 'asc' ? cmp : -cmp
    })
    return base
  }, [
    resumoLinhasVisiveis,
    agregadoTdPlanilha,
    votosFed22PorTd,
    estrategiaTopFed22PorTd,
    cenarioVotosExibicao,
    mostrarColunaDeltaFed22,
    rankingPorTd,
    classificacaoPorTd,
    classificacaoPrioridadePesoFed26PorTd,
    classificacaoPrioridadeEficienciaFed26PorTd,
    detalhesPrioridadePorTd,
    tdSort,
    visitasPorTdCampo,
  ])

  const alternarOrdenacaoTd = (key: TdSortKey) => {
    setTdSort((prev) =>
      prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
    )
  }

  const indicadorOrdenacaoTd = (key: TdSortKey): string => {
    if (tdSort.key !== key) return '↕'
    return tdSort.direction === 'asc' ? '↑' : '↓'
  }

  /** Destaques dinâmicos quando a lista mostra os 12 TDs (maior eleitorado, maior Δ, pior Δ). */
  const spotlightPorTd = useMemo(() => {
    const linhas =
      highlightedTd !== null ? resumoPorTd.filter((r) => r.territorio === highlightedTd) : resumoPorTd
    if (linhas.length <= 1) {
      return {
        maiorPesoEleitoral: null as TerritorioDesenvolvimentoPI | null,
        maiorDelta: null as TerritorioDesenvolvimentoPI | null,
        piorDelta: null as TerritorioDesenvolvimentoPI | null,
        deltasDistintos: false,
      }
    }
    let maxE = -1
    let tdPeso: TerritorioDesenvolvimentoPI | null = null
    for (const r of linhas) {
      if (r.eleitores > maxE) {
        maxE = r.eleitores
        tdPeso = r.territorio
      }
    }
    let maxDelta = -Infinity
    let minDelta = Infinity
    let tdCresc: TerritorioDesenvolvimentoPI | null = null
    let tdRisco: TerritorioDesenvolvimentoPI | null = null
    if (mostrarColunaDeltaFed22 && cenarioVotosExibicao !== null) {
      for (const r of linhas) {
        const ag = agregadoTdPlanilha.get(r.territorio) ?? AGREGADO_PLANILHA_VAZIO
        const v22Td = votosFed22PorTd.get(r.territorio) ?? 0
        const vPlanTd = Math.round(valorVotosAgregadoTd(ag, cenarioVotosExibicao))
        const d = vPlanTd - v22Td
        if (d > maxDelta) {
          maxDelta = d
          tdCresc = r.territorio
        }
        if (d < minDelta) {
          minDelta = d
          tdRisco = r.territorio
        }
      }
    }
    const deltasDistintos = maxDelta > minDelta
    return { maiorPesoEleitoral: tdPeso, maiorDelta: tdCresc, piorDelta: tdRisco, deltasDistintos }
  }, [
    highlightedTd,
    resumoPorTd,
    mostrarColunaDeltaFed22,
    cenarioVotosExibicao,
    agregadoTdPlanilha,
    votosFed22PorTd,
  ])

  /** Primeira coluna do bloco “desempenho” (marca visual de grupo na tabela). */
  const colunaInicioDesempenho = useMemo((): 'fed22' | 'plan' | 'delta' | 'lid' | null => {
    if (temDadosFed22) return 'fed22'
    if (painelPlanilhaAtivo && cenarioVotosExibicao) return 'plan'
    if (mostrarColunaDeltaFed22) return 'delta'
    if (painelPlanilhaAtivo) return 'lid'
    return null
  }, [temDadosFed22, painelPlanilhaAtivo, cenarioVotosExibicao, mostrarColunaDeltaFed22])

  const municipiosComEleitores = useMemo(() => {
    if (highlightedTd === null) return []
    return [...getMunicipiosPorTerritorioDesenvolvimentoPI(highlightedTd)]
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
      .map((nome) => ({
        nome,
        eleitores: getEleitoradoByCity(nome),
      }))
  }, [highlightedTd])

  const metricasPorCidadeNoTdMap = useMemo(() => {
    if (planilhaEstado !== 'ready' || !cidadeColPlanilha || highlightedTd === null) {
      return new Map<string, MetricasCidadePlanilha>()
    }
    return agregarMetricasPorCidadeNormalizadoNoTd(
      liderancasFiltradasPlanilha,
      highlightedTd,
      cidadeColPlanilha,
      colunasPlanilha
    )
  }, [planilhaEstado, cidadeColPlanilha, highlightedTd, liderancasFiltradasPlanilha, colunasPlanilha])

  const municipiosLinhasOrdenadas = useMemo(() => {
    const base = municipiosComEleitores
    if (!painelPlanilhaAtivo || highlightedTd === null) {
      return base
    }
    return [...base].sort((a, b) => {
      const ma = obterMetricasCidadeOficial(metricasPorCidadeNoTdMap, a.nome)
      const mb = obterMetricasCidadeOficial(metricasPorCidadeNoTdMap, b.nome)
      if (cenarioVotosExibicao) {
        const va = valorVotosCidade(ma, cenarioVotosExibicao)
        const vb = valorVotosCidade(mb, cenarioVotosExibicao)
        if (vb !== va) return vb - va
      }
      if (mb.lid !== ma.lid) return mb.lid - ma.lid
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    })
  }, [
    municipiosComEleitores,
    painelPlanilhaAtivo,
    highlightedTd,
    metricasPorCidadeNoTdMap,
    cenarioVotosExibicao,
  ])

  const municipiosLinhasPainel = useMemo(() => {
    if (!municipioFocadoLiderancas) return municipiosLinhasOrdenadas
    const alvo = normalizeMunicipioNome(municipioFocadoLiderancas)
    return municipiosLinhasOrdenadas.filter((l) => normalizeMunicipioNome(l.nome) === alvo)
  }, [municipiosLinhasOrdenadas, municipioFocadoLiderancas])

  const territorioFeedbackAtivo = highlightedTd ?? hoverTdTabela

  /** Top 5 partidos Fed. 2022 no TD ativo — terceiro card do bloco de feedback. */
  const linhasFeedbackTopPartidosFed22Td = useMemo((): string[] | null => {
    if (!territorioFeedbackAtivo) return null
    const lista = topPartidosFed22PorTd.get(territorioFeedbackAtivo)
    if (!lista || lista.length === 0) return null
    return lista.map(
      (p, idx) =>
        `${idx + 1}) ${p.partido}: ${fmtInt.format(p.votosNoTd)} votos no TD · ${fmtInt.format(p.votosPi)} no PI`
    )
  }, [territorioFeedbackAtivo, topPartidosFed22PorTd])

  const [insightPesquisaTd, setInsightPesquisaTd] = useState<string[] | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!territorioFeedbackAtivo) {
      setInsightPesquisaTd(null)
      return () => {
        cancelled = true
      }
    }

    const candidato =
      typeof window !== 'undefined' ? localStorage.getItem(STORAGE_CANDIDATO_PESQUISA)?.trim() ?? '' : ''
    if (!candidato) {
      setInsightPesquisaTd([
        'Pesquisas: defina o candidato padrão para habilitar leitura competitiva do território.',
      ])
      return () => {
        cancelled = true
      }
    }

    const run = async () => {
      try {
        const pesquisaRes = await fetch('/api/pesquisa?tipo=estimulada&cargo=dep_federal&limit=5000')
        if (!pesquisaRes.ok) throw new Error('Falha ao consultar pesquisas')

        type PollPesquisaRow = {
          candidato_nome?: string | null
          intencao?: number | string | null
          cities?: { name?: string | null } | Array<{ name?: string | null }> | null
        }
        const rows = (await pesquisaRes.json()) as PollPesquisaRow[]

        const parseIntencao = (raw: number | string | null | undefined): number | null => {
          if (raw == null) return null
          if (typeof raw === 'number' && Number.isFinite(raw)) return raw
          const s = String(raw).trim().replace(',', '.')
          const n = Number.parseFloat(s)
          return Number.isFinite(n) ? n : null
        }
        const nomeCidade = (poll: PollPesquisaRow): string => {
          const c = poll.cities
          if (!c) return ''
          if (Array.isArray(c)) return String(c[0]?.name ?? '').trim()
          return String(c.name ?? '').trim()
        }

        const acumuladoPorCandidato = new Map<string, { soma: number; n: number }>()
        const acumuladoNossoPorCidade = new Map<string, { soma: number; n: number }>()
        let totalRegistrosTd = 0
        const cidadesComRegistrosTd = new Set<string>()
        for (const poll of rows) {
          const candidatoNome = String(poll.candidato_nome ?? '').trim()
          if (!candidatoNome) continue
          const cidade = nomeCidade(poll)
          if (!cidade) continue
          const td = getTerritorioDesenvolvimentoPI(cidade)
          if (td !== territorioFeedbackAtivo) continue
          const intencao = parseIntencao(poll.intencao)
          if (intencao === null) continue
          totalRegistrosTd += 1
          cidadesComRegistrosTd.add(cidade)
          const atual = acumuladoPorCandidato.get(candidatoNome) ?? { soma: 0, n: 0 }
          atual.soma += intencao
          atual.n += 1
          acumuladoPorCandidato.set(candidatoNome, atual)
          if (candidatoNome.toUpperCase() === candidato.toUpperCase()) {
            const atualCidade = acumuladoNossoPorCidade.get(cidade) ?? { soma: 0, n: 0 }
            atualCidade.soma += intencao
            atualCidade.n += 1
            acumuladoNossoPorCidade.set(cidade, atualCidade)
          }
        }

        const rankingTd = Array.from(acumuladoPorCandidato.entries())
          .map(([nome, acc]) => ({
            nome,
            media: Math.round((acc.soma / Math.max(1, acc.n)) * 10) / 10,
            n: acc.n,
          }))
          .sort((a, b) => b.media - a.media || b.n - a.n || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

        if (rankingTd.length === 0) {
          if (!cancelled) {
            setInsightPesquisaTd([
              `Pesquisas no ${territorioFeedbackAtivo}: sem base suficiente para comparação competitiva.`,
            ])
          }
          return
        }

        const top5 = rankingTd.slice(0, 5)
        const linhaTop5 = top5
          .map((c, idx) => `${idx + 1}) ${c.nome} ${c.media.toFixed(1)}%`)
          .join(' · ')
        const posNosso = rankingTd.findIndex((c) => c.nome.toUpperCase() === candidato.toUpperCase())
        const lider = rankingTd[0]
        const nossoRanking = posNosso >= 0 ? rankingTd[posNosso] : null
        const melhorCidadeNosso = Array.from(acumuladoNossoPorCidade.entries())
          .map(([cidade, acc]) => ({ cidade, media: acc.soma / Math.max(1, acc.n), n: acc.n }))
          .sort((a, b) => b.media - a.media || b.n - a.n)[0]
        const piorCidadeNosso = Array.from(acumuladoNossoPorCidade.entries())
          .map(([cidade, acc]) => ({ cidade, media: acc.soma / Math.max(1, acc.n), n: acc.n }))
          .sort((a, b) => a.media - b.media || b.n - a.n)[0]
        const notaComparacao =
          posNosso >= 0
            ? `${candidato} no TD: ${posNosso + 1}º/${rankingTd.length} com ${rankingTd[posNosso].media.toFixed(1)}% (${(rankingTd[posNosso].media - lider.media).toFixed(1)} pp do líder).`
            : `${candidato} ainda não aparece com base consistente neste TD.`
        const notaPesquisaTop5 = `Pesquisas no ${territorioFeedbackAtivo} (Top 5): ${linhaTop5}.`
        const notaPesquisaBase = `Base da média no TD: ${totalRegistrosTd} registros em ${cidadesComRegistrosTd.size} cidades.`
        const notaPesquisaPosicao = `Nosso posicionamento: ${notaComparacao}`
        const notaPesquisaCidades =
          nossoRanking && melhorCidadeNosso && piorCidadeNosso
            ? `Melhor cidade do ${candidato}: ${melhorCidadeNosso.cidade} (${melhorCidadeNosso.media.toFixed(1)}%). Pior cidade: ${piorCidadeNosso.cidade} (${piorCidadeNosso.media.toFixed(1)}%).`
            : `Não há base municipal suficiente para identificar melhor/pior cidade do ${candidato} neste TD.`

        if (!cancelled) setInsightPesquisaTd([notaPesquisaBase, notaPesquisaTop5, notaPesquisaPosicao, notaPesquisaCidades])
      } catch {
        if (!cancelled) {
          setInsightPesquisaTd(['Pesquisas: não foi possível carregar o recorte competitivo neste momento.'])
        }
      }
    }
    void run()

    return () => {
      cancelled = true
    }
  }, [territorioFeedbackAtivo])

  const feedbackEstrategicoTd = useMemo(() => {
    if (!territorioFeedbackAtivo) return null
    const cidadesTd = getMunicipiosPorTerritorioDesenvolvimentoPI(territorioFeedbackAtivo)
    if (cidadesTd.length === 0) return null

    const metricasCidadeTd =
      planilhaEstado === 'ready' && cidadeColPlanilha
        ? agregarMetricasPorCidadeNormalizadoNoTd(
            liderancasFiltradasPlanilha,
            territorioFeedbackAtivo,
            cidadeColPlanilha,
            colunasPlanilha
          )
        : new Map<string, MetricasCidadePlanilha>()

    const linhas = cidadesTd.map((nome) => {
      const eleitores = getEleitoradoByCity(nome) ?? 0
      const metrica = obterMetricasCidadeOficial(metricasCidadeTd, nome)
      const votosPlano = cenarioVotosExibicao ? Math.round(valorVotosCidade(metrica, cenarioVotosExibicao)) : 0
      const votosFed22 = mapaFed22Municipios ? obterVotos2022JadyelMunicipio(mapaFed22Municipios, nome) : 0
      const delta = cenarioVotosExibicao && mapaFed22Municipios ? votosPlano - votosFed22 : null
      const share = eleitores > 0 && cenarioVotosExibicao ? votosPlano / eleitores : null
      return { nome, eleitores, votosPlano, votosFed22, delta, share, liderancas: metrica.lid }
    })

    const crescimento = linhas.filter((l) => (l.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0]
    const queda = linhas.filter((l) => (l.delta ?? 0) < 0).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))[0]
    const tracao = linhas
      .filter((l) => l.share !== null)
      .sort((a, b) => (b.share ?? 0) - (a.share ?? 0) || b.liderancas - a.liderancas)[0]
    const baixaParticipacao = [...linhas]
      .filter((l) => l.share !== null && l.eleitores > 0)
      .sort((a, b) => b.eleitores - a.eleitores)
      .slice(0, 5)
      .sort((a, b) => (a.share ?? 1) - (b.share ?? 1))[0]

    const notas: string[] = []
    if (crescimento && crescimento.delta) {
      notas.push(`Avanço mais forte em ${crescimento.nome} (${formatarIntComSinal(crescimento.delta)} vs Fed.22).`)
    }
    if (queda && queda.delta) {
      notas.push(`Queda concentrada em ${queda.nome} (${formatarIntComSinal(queda.delta)}); pede reação local.`)
    }
    if (tracao && tracao.share !== null) {
      const pct = fmtPctExpSobreEleit.format(tracao.share * 100).replace(/\u00a0/g, '')
      notas.push(
        `${tracao.nome} é o melhor sinal de tração (${pct}% do eleitorado municipal${tracao.liderancas > 0 ? `; ${fmtInt.format(tracao.liderancas)} lideranças` : ''}).`
      )
    }
    if (baixaParticipacao && baixaParticipacao.share !== null) {
      const pct = fmtPctExpSobreEleit.format(baixaParticipacao.share * 100).replace(/\u00a0/g, '')
      notas.push(
        `${baixaParticipacao.nome} tem baixa participação para o porte eleitoral (${pct}% sobre ${fmtInt.format(baixaParticipacao.eleitores)} eleitores).`
      )
    }
    if (notas.length === 0) {
      notas.push('Sem evidência suficiente para leitura estratégica nesta região com os dados atuais.')
    }
    return { territorio: territorioFeedbackAtivo, notas: notas.slice(0, 4) }
  }, [
    territorioFeedbackAtivo,
    planilhaEstado,
    cidadeColPlanilha,
    liderancasFiltradasPlanilha,
    colunasPlanilha,
    cenarioVotosExibicao,
    mapaFed22Municipios,
  ])

  const somaLiderancasListaTd = useMemo(() => {
    if (!painelPlanilhaAtivo || highlightedTd === null) return 0
    return municipiosLinhasPainel.reduce((acc, { nome }) => {
      const m = obterMetricasCidadeOficial(metricasPorCidadeNoTdMap, nome)
      return acc + m.lid
    }, 0)
  }, [painelPlanilhaAtivo, highlightedTd, municipiosLinhasPainel, metricasPorCidadeNoTdMap])

  const somaVotosListaTd = useMemo(() => {
    if (!painelPlanilhaAtivo || highlightedTd === null || !cenarioVotosExibicao) return 0
    return municipiosLinhasPainel.reduce((acc, { nome }) => {
      const m = obterMetricasCidadeOficial(metricasPorCidadeNoTdMap, nome)
      return acc + valorVotosCidade(m, cenarioVotosExibicao)
    }, 0)
  }, [
    painelPlanilhaAtivo,
    highlightedTd,
    municipiosLinhasPainel,
    metricasPorCidadeNoTdMap,
    cenarioVotosExibicao,
  ])

  const somaFed22ListaTd = useMemo(() => {
    if (highlightedTd === null || !mapaFed22Municipios) return 0
    return municipiosLinhasPainel.reduce(
      (acc, { nome }) => acc + obterVotos2022JadyelMunicipio(mapaFed22Municipios, nome),
      0
    )
  }, [highlightedTd, municipiosLinhasPainel, mapaFed22Municipios])

  const somaVisitasListaTd = useMemo(() => {
    if (highlightedTd === null) return 0
    return municipiosLinhasPainel.reduce(
      (acc, { nome }) => acc + (visitasPorMunicipioNorm.get(normalizeMunicipioNome(nome)) ?? 0),
      0
    )
  }, [highlightedTd, municipiosLinhasPainel, visitasPorMunicipioNorm])

  /** Média aritmética dos valores Méd.Top5 22 na lista de municípios (top federais no TD). */
  const mediaMedTop22ListaMunicipiosTd = useMemo(() => {
    if (highlightedTd === null || !temDadosEstrategiaTopFed22 || municipiosLinhasPainel.length === 0) return null
    let sum = 0
    for (const { nome } of municipiosLinhasPainel) {
      sum += mediaTop22PorMunicipioNorm.get(normalizeMunicipioNome(nome)) ?? 0
    }
    return sum / municipiosLinhasPainel.length
  }, [
    highlightedTd,
    temDadosEstrategiaTopFed22,
    municipiosLinhasPainel,
    mediaTop22PorMunicipioNorm,
  ])

  const deltaPlanilhaVsFed22Estado = useMemo(() => {
    if (!temDadosFed22 || !painelPlanilhaAtivo || !cenarioVotosExibicao) return null
    const vPlan = Math.round(valorVotosAgregadoTd(totaisPlanilhaTd, cenarioVotosExibicao))
    return vPlan - totalFed22Pi
  }, [temDadosFed22, painelPlanilhaAtivo, cenarioVotosExibicao, totaisPlanilhaTd, totalFed22Pi])

  const nomeColPlanilhaLideranca =
    (colunasPlanilha.nomeCol ?? (planilhaHeaders.length > 0 ? planilhaHeaders[0] : '')) || ''
  const cargoColPlanilhaLideranca = colunasPlanilha.cargoCol ?? ''
  const temColunaCargoDrillLiderancas = Boolean(cargoColPlanilhaLideranca)

  /** Drill de lideranças — mesmas trilhas no cabeçalho e nas linhas (sem coluna de expectativa na planilha). */
  const gridTemplateListaLiderancasDrillSemExpectativa = useMemo(() => {
    const cols: string[] = ['minmax(5.5rem, 1.45fr)']
    if (temColunaCargoDrillLiderancas) {
      cols.push('minmax(4.25rem, max-content)')
    }
    return cols.join(' ')
  }, [temColunaCargoDrillLiderancas])

  /** Drill com coluna FED.26 / Afer. alinhada ao cabeçalho. */
  const gridTemplateListaLiderancasDrillComExpectativa = useMemo(() => {
    const cols: string[] = ['minmax(5.25rem, 1.25fr)']
    if (temColunaCargoDrillLiderancas) {
      cols.push('minmax(4.25rem, max-content)')
    }
    cols.push('minmax(3.75rem, max-content)')
    return cols.join(' ')
  }, [temColunaCargoDrillLiderancas])

  const liderancasMunicipioOrdenadas = useMemo(() => {
    if (!municipioFocadoLiderancas || !painelPlanilhaAtivo || !cidadeColPlanilha) {
      return [] as LiderancaPlanilha[]
    }
    const filtradas = filtrarLiderancasPorMunicipioNomeOficial(
      liderancasFiltradasPlanilha,
      cidadeColPlanilha,
      municipioFocadoLiderancas
    )
    const nc = nomeColPlanilhaLideranca
    return [...filtradas].sort((a, b) => {
      if (cenarioVotosExibicao) {
        const va = valorVotosLinhaPlanilha(a, colunasPlanilha, cenarioVotosExibicao)
        const vb = valorVotosLinhaPlanilha(b, colunasPlanilha, cenarioVotosExibicao)
        if (vb !== va) return vb - va
      }
      return String(a[nc] ?? '').localeCompare(String(b[nc] ?? ''), 'pt-BR', { sensitivity: 'base' })
    })
  }, [
    municipioFocadoLiderancas,
    painelPlanilhaAtivo,
    cidadeColPlanilha,
    liderancasFiltradasPlanilha,
    colunasPlanilha,
    cenarioVotosExibicao,
    nomeColPlanilhaLideranca,
  ])

  const totaisDrillLiderancasMunicipio = useMemo(() => {
    const n = liderancasMunicipioOrdenadas.length
    if (!cenarioVotosExibicao || n === 0) {
      return { n, votos: 0 }
    }
    let votos = 0
    for (const linha of liderancasMunicipioOrdenadas) {
      votos += valorVotosLinhaPlanilha(linha, colunasPlanilha, cenarioVotosExibicao)
    }
    return { n, votos }
  }, [liderancasMunicipioOrdenadas, cenarioVotosExibicao, colunasPlanilha])

  /** Visão de votos da planilha no município − Fed.22 (Jadyel), igual à coluna Δ da lista de municípios. */
  const resumoFed26VsFed22MunicipioDrill = useMemo(() => {
    if (!municipioFocadoLiderancas || !mostrarColunaDeltaFed22 || !mapaFed22Municipios || !cenarioVotosExibicao) {
      return null
    }
    const m = obterMetricasCidadeOficial(metricasPorCidadeNoTdMap, municipioFocadoLiderancas)
    const vPlan = Math.round(valorVotosCidade(m, cenarioVotosExibicao))
    const v22 = obterVotos2022JadyelMunicipio(mapaFed22Municipios, municipioFocadoLiderancas)
    return { vPlan, v22, delta: vPlan - v22 }
  }, [
    municipioFocadoLiderancas,
    mostrarColunaDeltaFed22,
    mapaFed22Municipios,
    cenarioVotosExibicao,
    metricasPorCidadeNoTdMap,
  ])

  /** Altura do bloco rolável pai (área útil do mapa); fixamos o host do Leaflet nesse valor quando a lista alonga o fluxo. */
  const [alturaAreaMapaPx, setAlturaAreaMapaPx] = useState(0)

  useLayoutEffect(() => {
    const root = rootRef.current
    const scrollParent = root?.parentElement
    if (!scrollParent) return
    const measure = () => {
      const h = scrollParent.clientHeight
      if (h > 0) setAlturaAreaMapaPx(h)
    }
    measure()
    const ro = new ResizeObserver(() => {
      measure()
    })
    ro.observe(scrollParent)
    return () => {
      ro.disconnect()
    }
  }, [])

  const somaEleitoresListaTd = useMemo(
    () => municipiosLinhasPainel.reduce((acc, l) => acc + (l.eleitores ?? 0), 0),
    [municipiosLinhasPainel]
  )

  /** % expectativa agregado na lista de municípios (votos ÷ eleitores), espelhando a coluna % EXP. */
  const pctExpRodapeListaMunicipiosTd = useMemo(() => {
    if (!painelPlanilhaAtivo || !cenarioVotosExibicao || highlightedTd === null) return null
    if (somaEleitoresListaTd <= 0) return null
    return formatarPctVotosSobreEleitores(somaVotosListaTd, somaEleitoresListaTd)
  }, [
    painelPlanilhaAtivo,
    cenarioVotosExibicao,
    highlightedTd,
    somaEleitoresListaTd,
    somaVotosListaTd,
  ])

  /**
   * Antes esticávamos o fluxo da página quando o painel absoluto passava da altura do mapa.
   * O painel agora rola por dentro (`max-height` + `overflow-y-auto`), evitando sobreposição com o mapa.
   */
  const alturaExtraPainelListaPx = 0

  const mapHostAlturaFixaPx =
    alturaExtraPainelListaPx > 0 && alturaAreaMapaPx > 0 ? alturaAreaMapaPx : null

  useLayoutEffect(() => {
    ajustarCaixaMapaAoViewportPiaui(
      viewportFitRef.current,
      aspectBoxRef.current,
      piauiAspectRatioRef.current
    )
  }, [mapHostAlturaFixaPx, alturaAreaMapaPx])

  useEffect(() => {
    if (highlightedTd === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      if (municipioFocadoLiderancas) {
        setMunicipioFocadoLiderancas(null)
      } else {
        setMunicipioFocadoLiderancas(null)
        setHighlightedTd(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [highlightedTd, municipioFocadoLiderancas])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false
    let resizeObs: ResizeObserver | null = null
    let layoutTimer: number | null = null
    let onMoveEndMarcadores: (() => void) | null = null

    const run = async () => {
      setLoadState('loading')
      setErrorMessage('')
      try {
        const res = await fetch('/api/geo/malha-municipios-pi')
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `HTTP ${res.status}`)
        }
        const payload = (await res.json()) as MalhaMapaPIPayload
        if (cancelled || !containerRef.current) return

        const geoMunicipios = payload.municipios as unknown as GeoJSON.GeoJSON
        const geoUf = payload.contornoUf as unknown as GeoJSON.GeoJSON | null

        const boundsPlan = boundsFromGeoJson(geoMunicipios)
        piauiAspectRatioRef.current = boundsPlan?.isValid()
          ? larguraSobreAlturaEncaixeBounds(boundsPlan)
          : 0.62
        ajustarCaixaMapaAoViewportPiaui(
          viewportFitRef.current,
          aspectBoxRef.current,
          piauiAspectRatioRef.current
        )

        const mapEl = containerRef.current
        if (!mapEl) {
          throw new Error('Container do mapa indisponível')
        }
        const map = L.map(mapEl, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: false,
          touchZoom: false,
          boxZoom: false,
          keyboard: false,
          maxBounds: MAX_BOUNDS_MAPA_TD,
          maxBoundsViscosity: 1.0,
          minZoom: 5,
          maxZoom: 16,
          worldCopyJump: false,
        }).setView(L.latLng(-7.5, -42.5), 6.5)
        map.doubleClickZoom.disable()
        const fundoMapaBase = visualPreset === 'futuristic' ? '#10161F' : FUNDO_MAPA_BRANCO
        mapEl.style.backgroundColor = fundoMapaBase
        mapRef.current = map

        const maskPane = map.createPane('piMaskOutside')
        maskPane.style.zIndex = '390'
        maskPane.style.pointerEvents = 'none'

        const munisPane = map.createPane('piMunicipios')
        munisPane.style.zIndex = '450'

        const tileUrl =
          visualPreset === 'futuristic'
            ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
        L.tileLayer(tileUrl, {
          attribution: '&copy; OpenStreetMap &copy; CARTO · Malha IBGE',
          maxZoom: 19,
          maxNativeZoom: 19,
          subdomains: 'abcd',
          opacity: visualPreset === 'futuristic' ? 0.52 : 0.32,
        }).addTo(map)

        if (geoUf) {
          const maskFeature = buildOutsidePiauiMask(geoUf)
          if (maskFeature) {
            L.geoJSON(maskFeature as unknown as GeoJSON.GeoJSON, {
              pane: 'piMaskOutside',
              interactive: false,
              style: {
                fillColor: fundoMapaBase,
                fillOpacity: 1,
                stroke: false,
              },
            }).addTo(map)
          }
        }

        const geoCtxInicial: GeoStyleContext = { ...GEO_STYLE_CTX_VAZIO, visualPreset }
        const geoLayer = L.geoJSON(geoMunicipios, {
          pane: 'piMunicipios',
          style: (feature) =>
            styleForMunicipioFeature(feature as GeoJSON.Feature | undefined, null, null, geoCtxInicial),
          onEachFeature: (feature, layer) => {
            const p = feature.properties as GeoProps
            const nome = p.nm_mun ?? p.codarea
            const td = p.td ?? '—'
            const tipHtmlFuturista = `<div style="font-family:system-ui,sans-serif;min-width:140px">
                <div style="font-weight:700;font-size:12px;color:#e0f2fe;margin-bottom:2px">${escapeHtml(String(nome))}</div>
                <div style="font-size:10px;color:#94a3b8">${escapeHtml(String(td))}</div>
                <div style="margin-top:6px;font-size:10px;color:#7dd3fc">Duplo clique no mapa: resumo + lideranças deste município</div>
              </div>`
            const tipHtmlClassico = `<div style="font-family:system-ui,sans-serif;min-width:140px">
                <div style="font-weight:700;font-size:12px;color:#1c1c1c;margin-bottom:2px">${escapeHtml(String(nome))}</div>
                <div style="font-size:10px;color:#6b6b6b">${escapeHtml(String(td))}</div>
                <div style="margin-top:6px;font-size:10px;color:#737373">Duplo clique no mapa: resumo + lideranças deste município</div>
              </div>`
            layer.bindTooltip(visualPreset === 'futuristic' ? tipHtmlFuturista : tipHtmlClassico, {
              sticky: true,
              direction: 'top',
              opacity: visualPreset === 'futuristic' ? 0.98 : 0.95,
              className: 'td-municipio-tooltip',
            })
            const aplicarFiltroTdEMunicipioNoPainel = (e: L.LeafletMouseEvent) => {
              L.DomEvent.stopPropagation(e)
              const props = feature.properties as GeoProps
              const nomePoly = String(props.nm_mun ?? '').trim()
              const tdPoly = props.td as TerritorioDesenvolvimentoPI | undefined
              if (!nomePoly || !tdPoly) return
              const { setHighlightedTd: setTd, setMunicipioFocadoLiderancas: setMun } = mapFilterActionsRef.current
              setTd(tdPoly)
              setMun(nomePoly)
            }
            layer.on('dblclick', aplicarFiltroTdEMunicipioNoPainel)
          },
        }).addTo(map)

        const markerByTdPesoEleitores = montarMarcadoresPesoEleitoresPorTd(map, geoLayer, visualPreset)

        const labelsPane = map.createPane('piMunicipLabels')
        labelsPane.style.zIndex = '480'
        const labelsGroup = L.layerGroup().addTo(map)

        const setRotulosMunicipiosTd = (td: TerritorioDesenvolvimentoPI | null) => {
          labelsGroup.clearLayers()
          if (!td) return
          geoLayer.eachLayer((layer) => {
            const lyr = layer as L.Polygon & { feature?: GeoJSON.Feature }
            const p = lyr.feature?.properties as GeoProps | undefined
            if (!p || p.td !== td) return
            const nome = p.nm_mun ?? p.codarea
            if (!nome) return
            const center = lyr.getBounds().getCenter()
            const cm = L.circleMarker(center, {
              radius: 1,
              stroke: false,
              fillOpacity: 0,
              opacity: 0,
              interactive: false,
              pane: 'piMunicipLabels',
            })
            cm.bindTooltip(escapeHtml(String(nome)), {
              permanent: true,
              direction: 'center',
              className: 'td-municipio-rotulo',
              opacity: 1,
            })
            labelsGroup.addLayer(cm)
          })
        }

        const piauiBounds = geoLayer.getBounds()

        const refitFullPiaui = () => {
          if (cancelled || !mapRef.current) return
          if (!MAPA_AUTO_ZOOM_ENABLED) return
          try {
            enquadrarPiauiPertoDaSidebar(mapRef.current, piauiBounds, painelResumoMaxRemRef.current)
          } catch {
            mapRef.current.fitBounds(MAX_BOUNDS_MAPA_TD)
          }
        }

        mapTdControllerRef.current = {
          applyStyles: (focusTd, focusMun) =>
            applyStylesToGeoLayer(geoLayer, focusTd, focusMun, geoStyleContextRef.current),
          boundsForTd: (td) => boundsForTdInLayer(geoLayer, td),
          boundsForMunicipio: (td, nome) => boundsForMunicipioInLayer(geoLayer, td, nome),
          refitFull: refitFullPiaui,
          setRotulosMunicipiosTd,
          sincronizarMarcadoresPesoTdComFoco: () => {
            resolverSobreposicaoCartoesMarcadoresTd(map, geoLayer, markerByTdPesoEleitores, visualPreset)
            aplicarFocoMarcadoresPesoTd(markerByTdPesoEleitores, highlightedTdRef.current, geoLayer, map)
          },
          aplicarHoverMarcadorTd: (hoverTd) => {
            atualizarHoverMarcadorTd(markerByTdPesoEleitores, hoverTd, visualPreset, highlightedTdRef.current)
          },
          atualizarResumoMarcadores: (agregadoPorTd, usarExpectativaFed26) => {
            atualizarResumoMarcadoresPesoEleitoresPorTd(
              markerByTdPesoEleitores,
              agregadoPorTd,
              usarExpectativaFed26
            )
          },
        }

        onMoveEndMarcadores = () => {
          if (cancelled) return
          mapTdControllerRef.current?.sincronizarMarcadoresPesoTdComFoco()
        }
        map.on('moveend', onMoveEndMarcadores)
        map.on('zoomend', onMoveEndMarcadores)
        mapTdControllerRef.current?.sincronizarMarcadoresPesoTdComFoco()

        const refit = () => {
          if (cancelled || !mapRef.current || !mapTdControllerRef.current) return
          ajustarCaixaMapaAoViewportPiaui(
            viewportFitRef.current,
            aspectBoxRef.current,
            piauiAspectRatioRef.current
          )
          mapRef.current.invalidateSize({ animate: false })
          if (!MAPA_AUTO_ZOOM_ENABLED) return
          const c = mapTdControllerRef.current
          const td = highlightedTdRef.current
          const mun = municipioFocadoLiderancasRef.current
          if (td && mun) {
            const bbMun = c.boundsForMunicipio(td, mun)
            if (bbMun?.isValid()) {
              try {
                fitBoundsWithSidebarShift(mapRef.current, bbMun, {
                  padGeo: 0.22,
                  animate: false,
                  paddingMapa: 'centro',
                })
                return
              } catch {
                /* encaixe por TD */
              }
            }
          }
          if (td) {
            const bb = boundsForTdInLayer(geoLayer, td)
            if (bb?.isValid()) {
              try {
                fitBoundsWithSidebarShift(mapRef.current, bb, {
                  padGeo: 0.11,
                  animate: false,
                  paddingMapa: 'centro',
                })
              } catch {
                refitFullPiaui()
              }
              return
            }
          }
          refitFullPiaui()
        }

        try {
          refit()
        } catch {
          map.fitBounds(MAX_BOUNDS_MAPA_TD)
        }

        const z = map.getZoom()
        map.setMinZoom(Math.max(5, z - 2))

        if (!cancelled) {
          resizeObs = new ResizeObserver(() => {
            if (cancelled || !mapRef.current) return
            requestAnimationFrame(() => refit())
          })
          const vp = viewportFitRef.current
          if (vp) resizeObs.observe(vp)
        }

        const refitAposLayout = () => {
          if (cancelled) return
          requestAnimationFrame(() => {
            if (cancelled) return
            requestAnimationFrame(() => {
              if (!cancelled) refit()
            })
          })
        }
        refitAposLayout()
        layoutTimer = window.setTimeout(() => {
          layoutTimer = null
          if (!cancelled) refit()
        }, 80)

        setLoadState('ready')
      } catch (e) {
        if (!cancelled) {
          setLoadState('error')
          setErrorMessage(e instanceof Error ? e.message : 'Erro ao carregar malha')
        }
      }
    }

    void run()

    return () => {
      cancelled = true
      if (mapRef.current && onMoveEndMarcadores) {
        mapRef.current.off('moveend', onMoveEndMarcadores)
        mapRef.current.off('zoomend', onMoveEndMarcadores)
      }
      mapTdControllerRef.current = null
      if (layoutTimer !== null) {
        clearTimeout(layoutTimer)
        layoutTimer = null
      }
      resizeObs?.disconnect()
      resizeObs = null
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [visualPreset])

  /**
   * Depende de `mapHostAlturaFixaPx`: ao focar um TD a lista aumenta o minHeight e a altura fixa do
   * host do Leaflet muda — sem `invalidateSize` + refit após isso, o encaixe usa tamanho antigo e o mapa “pula” (ex.: desce).
   */
  useLayoutEffect(() => {
    if (loadState !== 'ready' || !mapTdControllerRef.current || !mapRef.current) return
    geoStyleContextRef.current = {
      classificacao: classificacaoPorTd,
      hoverTdTabela,
      visualPreset,
      maiorPesoTd: spotlightPorTd.maiorPesoEleitoral,
      piorDeltaTd: spotlightPorTd.piorDelta,
      deltasDistintos: spotlightPorTd.deltasDistintos,
    }
    painelResumoMaxRemRef.current = sidebarCollapsed
      ? PAINEL_RESUMO_TD_MAX_REM_COLLAPSED
      : PAINEL_RESUMO_TD_MAX_REM_EXPANDED
    const map = mapRef.current
    const c = mapTdControllerRef.current
    ajustarCaixaMapaAoViewportPiaui(
      viewportFitRef.current,
      aspectBoxRef.current,
      piauiAspectRatioRef.current
    )
    map.invalidateSize({ animate: false })
    c.applyStyles(highlightedTd, municipioFocadoLiderancas)
    c.setRotulosMunicipiosTd(highlightedTd)
    const runFit = () => {
      if (!MAPA_AUTO_ZOOM_ENABLED) return
      if (highlightedTd && municipioFocadoLiderancas) {
        const bbMun = c.boundsForMunicipio(highlightedTd, municipioFocadoLiderancas)
        if (bbMun?.isValid()) {
          try {
            fitBoundsWithSidebarShift(map, bbMun, {
              padGeo: 0.22,
              animate: false,
              paddingMapa: 'centro',
            })
            return
          } catch {
            /* encaixe por TD abaixo */
          }
        }
      }
      if (highlightedTd) {
        const bb = c.boundsForTd(highlightedTd)
        if (bb?.isValid()) {
          fitBoundsWithSidebarShift(map, bb, {
            padGeo: 0.11,
            animate: false,
            paddingMapa: 'centro',
          })
        }
      } else {
        if (skipRefitFullOnInitialNullRef.current) {
          skipRefitFullOnInitialNullRef.current = false
          return
        }
        c.refitFull()
      }
    }
    requestAnimationFrame(() => {
      ajustarCaixaMapaAoViewportPiaui(
        viewportFitRef.current,
        aspectBoxRef.current,
        piauiAspectRatioRef.current
      )
      map.invalidateSize({ animate: false })
      runFit()
      c.sincronizarMarcadoresPesoTdComFoco()
      requestAnimationFrame(() => {
        c.sincronizarMarcadoresPesoTdComFoco()
      })
    })
  }, [
    highlightedTd,
    municipioFocadoLiderancas,
    mapHostAlturaFixaPx,
    loadState,
    sidebarCollapsed,
    classificacaoPorTd,
    visualPreset,
    spotlightPorTd,
  ])

  /**
   * Só `hoverTdTabela`: evita refit do mapa a cada `mouseenter`/`mouseleave`.
   * `highlightedTd`, `classificacaoPorTd` e foco de município são reaplicados no `useLayoutEffect`.
   */
  useEffect(() => {
    if (loadState !== 'ready' || !mapTdControllerRef.current) return
    geoStyleContextRef.current = {
      ...geoStyleContextRef.current,
      classificacao: classificacaoPorTd,
      hoverTdTabela,
    }
    mapTdControllerRef.current.applyStyles(highlightedTd, municipioFocadoLiderancas)
    mapTdControllerRef.current.aplicarHoverMarcadorTd(hoverTdTabela)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional: só reagir ao hover da tabela
  }, [hoverTdTabela])

  useEffect(() => {
    if (loadState !== 'ready' || !mapTdControllerRef.current) return
    mapTdControllerRef.current.atualizarResumoMarcadores(
      agregadoTdPlanilha,
      planilhaEstado === 'ready' && painelPlanilhaAtivo
    )
  }, [loadState, agregadoTdPlanilha, planilhaEstado, painelPlanilhaAtivo])

  const rotuloVisaoPainelFuturista = useMemo((): string => {
    if (!painelPlanilhaAtivo) return 'Eleitorado'
    if (cenarioVotosExibicao === 'aferido') return 'Afer.26'
    if (cenarioVotosExibicao === 'anterior') return 'FED.26'
    return 'Planilha'
  }, [painelPlanilhaAtivo, cenarioVotosExibicao])

  /** Em modo futurista + pronto: painel ao lado do mapa (não sobreposto). */
  const futSplit = visualPreset === 'futuristic' && loadState === 'ready'

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative z-0 flex min-h-0 w-full flex-col bg-transparent',
        alturaExtraPainelListaPx > 0 ? 'h-auto min-h-0' : 'h-full min-h-0'
      )}
      style={
        alturaExtraPainelListaPx > 0 && alturaAreaMapaPx > 0
          ? { minHeight: alturaAreaMapaPx + alturaExtraPainelListaPx }
          : undefined
      }
    >
      {/* Wrapper: flex-col durante carregamento; flex-row (split) quando pronto no tema futurista */}
      <div
        className={cn(
          'min-h-0 w-full',
          futSplit
            ? 'flex flex-1 flex-row items-stretch gap-4 overflow-x-hidden px-3 pb-3 sm:gap-5 sm:px-4 sm:pb-4 md:gap-6 md:px-5 md:pb-5'
            : mapHostAlturaFixaPx !== null
              ? 'shrink-0'
              : 'flex min-h-0 flex-1 basis-0 flex-col'
        )}
      >
        {/* Viewport do mapa — em split encolhe para a largura real do Piauí via ajustarCaixaMapaAoViewportPiaui */}
        <div
          ref={viewportFitRef}
          className={cn(
            'pointer-events-none flex items-start justify-start',
            futSplit
              ? 'td-fut-vp-shrink min-h-0 flex-none self-stretch pl-1 sm:pl-2'
              : cn(
                  'w-full pl-3 sm:pl-4 md:pl-6',
                  mapHostAlturaFixaPx !== null ? 'shrink-0' : 'min-h-0 flex-1 basis-0'
                ),
            visualPreset === 'futuristic' ? 'td-mapa-fut-viewport-bg bg-transparent' : 'bg-white'
          )}
          style={
            futSplit
              ? { minHeight: 0 }
              : mapHostAlturaFixaPx !== null && mapHostAlturaFixaPx > 0
                ? { height: mapHostAlturaFixaPx, minHeight: 0 }
                : { minHeight: 0 }
          }
        >
          <div
            ref={aspectBoxRef}
            className={cn(
              'td-mapa-vp-halo pointer-events-auto relative isolate z-[1] max-h-full max-w-full overflow-hidden',
              visualPreset === 'futuristic' ? 'bg-[#10161F] sm:rounded-[18px]' : 'bg-white sm:rounded-xl'
            )}
          >
            <div
              ref={containerRef}
              className={cn(
                'leaflet-td-pi-host relative z-[1] isolate h-full min-h-0 w-full',
                visualPreset === 'futuristic' ? '!bg-[#10161F]' : '!bg-white'
              )}
              role="presentation"
            />
          </div>
        </div>
        {/* Overlays (loading/error) — absolutos em relação ao rootRef */}
        {loadState === 'loading' && (
          <div
            className={cn(
              'pointer-events-none absolute inset-0 z-[50] flex items-center justify-center backdrop-blur-[2px]',
              visualPreset === 'futuristic' ? 'td-mapa-fut-loading bg-[#10161F]/92' : 'bg-white/85'
            )}
          >
            <div className="flex flex-col items-center gap-2 text-text-secondary">
              <div className="h-8 w-8 animate-pulse rounded-full bg-accent-gold/35" aria-hidden />
              <span className="text-sm font-medium">Carregando malha municipal…</span>
            </div>
          </div>
        )}
        {loadState === 'error' && (
          <div
            className={cn(
              'absolute inset-0 z-[50] flex items-center justify-center p-4',
              visualPreset === 'futuristic' ? 'td-mapa-fut-error bg-[#10161F]/95' : 'bg-white/95'
            )}
          >
            <p className="max-w-md text-center text-sm text-status-danger">
              Não foi possível carregar os polígonos do mapa. {errorMessage}
            </p>
          </div>
        )}

        {/* Painel lateral / segundo filho do wrapper:
            - futSplit: flex-1 ao lado do mapa (sem absolute, sem vão)
            - caso contrário: absolute no canto superior direito */}
        {loadState === 'ready' && (
          <div
            className={cn(
              'pointer-events-none min-w-0',
              futSplit
                ? cn(
                    'relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto',
                    'bg-[#10161F]'
                  )
                : cn(
                    'absolute top-12 right-5 z-[1100] max-sm:top-10 max-sm:right-3 sm:right-6 md:right-8 lg:right-10',
                    sidebarCollapsed
                      ? 'w-[min(34rem,calc(100%-9rem))] max-w-[min(34rem,calc(100%-9rem))] lg:w-[min(46rem,calc(100%-6rem))] lg:max-w-[min(46rem,calc(100%-6rem))]'
                      : 'w-[min(34rem,calc(100%-9rem))] max-w-[min(34rem,calc(100%-9rem))]'
                  )
            )}
          >
          <aside
            data-resumo-td-amplo={sidebarCollapsed ? 'true' : undefined}
            className={cn(
              'pointer-events-auto relative w-full max-w-full min-w-0 p-0',
              'text-text-primary',
              futSplit
                ? 'flex-1 overflow-x-hidden overflow-y-auto'
                : 'z-[1100] max-h-[min(85dvh,calc(100dvh-7rem))] overflow-x-hidden overflow-y-auto overscroll-contain'
            )}
            aria-label="Mapa de dominância eleitoral por território de desenvolvimento"
          >
            <div className="space-y-1">
              <h2
                className={cn(
                  'm-0 text-xs font-semibold uppercase tracking-wide sm:text-sm',
                  visualPreset === 'futuristic' ? 'text-text-secondary' : 'text-text-muted'
                )}
              >
                Resumo por Território de Desenvolvimento
              </h2>
              {planilhaEstado === 'loading' ? (
                <p className="text-[10px] text-text-muted sm:text-[11px]">Carregando planilha de lideranças…</p>
              ) : null}
              {planilhaEstado === 'error' && planilhaErro ? (
                <p className="text-[10px] text-status-danger sm:text-[11px]" title={planilhaErro}>
                  Planilha: não foi possível carregar ({planilhaErro.length > 80 ? `${planilhaErro.slice(0, 80)}…` : planilhaErro})
                </p>
              ) : null}
              {fed22LoadState === 'error' ? (
                <p className="text-[10px] text-text-muted sm:text-[11px]">
                  Votos Dep. Federal 2022 (Jadyel): não foi possível carregar.
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-end gap-2">
                {mostrarSeletorCenario ? (
                  <label className="flex min-w-[12.75rem] flex-1 flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                    <span className="shrink-0 font-medium text-text-secondary">Simulação atual</span>
                    <select
                      value={cenarioVotosPainelMapaTd}
                      onChange={(e) => setCenarioVotosPainelMapaTd(e.target.value as CenarioVotosPainelMapaTd)}
                      className="min-w-0 flex-1 rounded-lg border border-card bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                    >
                      {opcoesCenarioPainel.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="flex min-w-[12.75rem] flex-1 flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                  <span className="shrink-0 font-medium text-text-secondary">Município</span>
                  <select
                    value={municipioFocadoLiderancas ?? ''}
                    onChange={(e) => aplicarFiltroMunicipioPainel(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-card bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                  >
                    <option value="">
                      Todos os municípios ({fmtInt.format(opcoesFiltroMunicipio.length)})
                    </option>
                    {opcoesFiltroMunicipio.map((nomeMunicipio) => (
                      <option key={nomeMunicipio} value={nomeMunicipio}>
                        {nomeMunicipio}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="td-resumo-map-table-wrap mt-2 w-full min-w-0 max-w-full">
              <table
                aria-label="Painel de decisão — territórios de desenvolvimento"
                className={cn(
                  'td-resumo-table td-resumo-table--premium w-full',
                  visualPreset === 'futuristic' && 'td-resumo-table--futuristic'
                )}
              >
                <thead>
                  <tr className="td-resumo-table__row td-resumo-table__row--header tracking-wide">
                    <th
                      className="td-resumo-table__cell td-resumo-table__cell--rank text-right font-medium"
                      title="Posição no ranking pelo critério atual (entre os 12 TDs)"
                    >
                      <button type="button" onClick={() => alternarOrdenacaoTd('rank')} className="inline-flex items-center gap-1">
                        # <span aria-hidden>{indicadorOrdenacaoTd('rank')}</span>
                      </button>
                    </th>
                    <th className="td-resumo-table__cell td-resumo-table__cell--territorio text-left font-medium">
                      <button type="button" onClick={() => alternarOrdenacaoTd('territorio')} className="inline-flex items-center gap-1">
                        Território <span aria-hidden>{indicadorOrdenacaoTd('territorio')}</span>
                      </button>
                    </th>
                    <th className="td-resumo-table__cell text-right font-medium" title="Quantidade de municípios no TD">
                      <button type="button" onClick={() => alternarOrdenacaoTd('municipios')} className="inline-flex items-center gap-1">
                        Mun. <span aria-hidden>{indicadorOrdenacaoTd('municipios')}</span>
                      </button>
                    </th>
                    <th className="td-resumo-table__cell text-right font-medium" title="Eleitorado total do TD">
                      <button type="button" onClick={() => alternarOrdenacaoTd('eleitores')} className="inline-flex items-center gap-1">
                        Eleit. <span aria-hidden>{indicadorOrdenacaoTd('eleitores')}</span>
                      </button>
                    </th>
                    {temDadosEstrategiaTopFed22 ? (
                      <th
                        className="td-resumo-table__cell td-resumo-table__cell--estrategia text-center font-medium"
                        title={tooltipMedTop22Header}
                      >
                        <button
                          type="button"
                          onClick={() => alternarOrdenacaoTd('estrategia')}
                          className="inline-flex items-center gap-1"
                        >
                          Méd.Top5 22 <span aria-hidden>{indicadorOrdenacaoTd('estrategia')}</span>
                        </button>
                      </th>
                    ) : null}
                    {temDadosFed22 ? (
                      <th
                        className={cn(
                          'td-resumo-table__cell text-right font-medium',
                          colunaInicioDesempenho === 'fed22' && 'td-resumo-table__grupo-desempenho-start'
                        )}
                        title="Jadyel — votos nominais Dep. Federal 2022 (TSE), somados nos municípios do TD"
                      >
                        <button type="button" onClick={() => alternarOrdenacaoTd('fed22')} className="inline-flex items-center gap-1">
                          FED.22 <span aria-hidden>{indicadorOrdenacaoTd('fed22')}</span>
                        </button>
                      </th>
                    ) : null}
                    {painelPlanilhaAtivo && cenarioVotosExibicao ? (
                      <th
                        className={cn(
                          'td-resumo-table__cell text-right font-medium',
                          colunaInicioDesempenho === 'plan' && 'td-resumo-table__grupo-desempenho-start'
                        )}
                        title={
                          cenarioVotosExibicao === 'anterior'
                            ? 'Expectativa de votos FED.26 (planilha) no TD'
                            : 'Expectativa aferida / Jadyel 2026 (planilha) no TD'
                        }
                      >
                        <button type="button" onClick={() => alternarOrdenacaoTd('fed26')} className="inline-flex items-center gap-1">
                          {cenarioVotosExibicao === 'anterior' ? 'FED.26' : 'Afer.'}{' '}
                          <span aria-hidden>{indicadorOrdenacaoTd('fed26')}</span>
                        </button>
                      </th>
                    ) : null}
                    {mostrarColunaDeltaFed22 ? (
                      <th
                        className={cn(
                          'td-resumo-table__cell text-center font-medium',
                          colunaInicioDesempenho === 'delta' && 'td-resumo-table__grupo-desempenho-start'
                        )}
                        title="Diferença de votos: visão atual da planilha menos Fed. 2022 no TD"
                      >
                        <button
                          type="button"
                          onClick={() => alternarOrdenacaoTd('delta')}
                          className="inline-flex w-full items-center justify-center gap-1"
                        >
                          Dif. <span aria-hidden>{indicadorOrdenacaoTd('delta')}</span>
                        </button>
                      </th>
                    ) : null}
                    {mostrarColunaTendenciaFuturista ? (
                      <th
                        className="td-resumo-table__cell td-resumo-table__cell--tend text-center font-medium"
                        title="Variação percentual da diferença (planilha − Fed.22) em relação aos votos Fed.22 do TD (Δ ÷ Fed.22)"
                      >
                        <button
                          type="button"
                          onClick={() => alternarOrdenacaoTd('tend')}
                          className="inline-flex w-full items-center justify-center gap-1"
                        >
                          %Δ <span aria-hidden>{indicadorOrdenacaoTd('tend')}</span>
                        </button>
                      </th>
                    ) : null}
                    {painelPlanilhaAtivo ? (
                      <th
                        className={cn(
                          'td-resumo-table__cell td-resumo-table__cell--lid text-center font-medium',
                          colunaInicioDesempenho === 'lid' && 'td-resumo-table__grupo-desempenho-start'
                        )}
                        title="Quantidade de lideranças na planilha (após filtro de relevância)"
                      >
                        <button
                          type="button"
                          onClick={() => alternarOrdenacaoTd('lid')}
                          className="inline-flex w-full items-center justify-center gap-1"
                        >
                          Lid. <span aria-hidden>{indicadorOrdenacaoTd('lid')}</span>
                        </button>
                      </th>
                    ) : null}
                    <th
                      className="td-resumo-table__cell td-resumo-table__cell--vis text-center font-medium"
                      title="Visitas com check-in (Campo & Agenda): agendas concluídas no PI, somadas por território de desenvolvimento"
                    >
                      <button
                        type="button"
                        onClick={() => alternarOrdenacaoTd('vis')}
                        className="inline-flex w-full items-center justify-center gap-1"
                      >
                        Vis. <span aria-hidden>{indicadorOrdenacaoTd('vis')}</span>
                      </button>
                    </th>
                    <th
                      className="td-resumo-table__cell td-resumo-table__grupo-status-start text-center font-medium"
                      title="Prioridade em duas análises (tercis): peso na expectativa FED.26 e eficiência FED.26/eleitorado"
                    >
                      <button
                        type="button"
                        onClick={() => alternarOrdenacaoTd('prioridade')}
                        className="inline-flex w-full items-center justify-center gap-1"
                      >
                        Prioridade <span aria-hidden>{indicadorOrdenacaoTd('prioridade')}</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhasResumoOrdenadas.map(
                    ({
                      r,
                      ag,
                      v22Td,
                      estrategiaTd,
                      vPlanTd,
                      deltaTd,
                      rankTd,
                      classificacaoPrioridadePeso,
                      classificacaoPrioridadeEficiencia,
                      detalhesPrioridade,
                      visitasTd,
                    }) => {
                    const territorioCor = CORES_TERRITORIO_DESENVOLVIMENTO_PI[r.territorio]
                    const selecionado = highlightedTd === r.territorio
                    const blocoMedTop22 = estrategiaTopFed22PorTd.get(r.territorio)
                    const tituloMedTop22 =
                      blocoMedTop22 != null
                        ? montarTooltipMedTop22Celula(
                            r.territorio,
                            blocoMedTop22.detalheCandidatos,
                            blocoMedTop22.mediaVotos,
                            fmtInt
                          )
                        : `Média dos ${estrategiaTopFed22TopN || 5} federais com mais votos em 2022 no território (top por TD)`
                    const pctPeso = fmtPctExpSobreEleit
                      .format(detalhesPrioridade?.pesoFed26Pct ?? 0)
                      .replace(/\u00a0/g, '')
                    const pctEf = fmtPctExpSobreEleit
                      .format(detalhesPrioridade?.eficienciaFed26Pct ?? 0)
                      .replace(/\u00a0/g, '')
                    const hintExp26 = detalhesPrioridade
                      ? `Exp.26 ${classificacaoPrioridadePeso === 'estrategico' ? 'Estratégico' : classificacaoPrioridadePeso === 'atencao' ? 'Atenção' : 'Baixo impacto'}: ${fmtInt.format(detalhesPrioridade.votosFed26)} votos estimados (${pctPeso}% da expectativa estadual), posição ${detalhesPrioridade.rankPesoFed26}/${resumoPorTd.length}.`
                      : 'Exp.26: sem base suficiente para calcular a prioridade.'
                    const labelEf =
                      classificacaoPrioridadeEficiencia === 'baixo-impacto'
                        ? 'Baixa Participação'
                        : classificacaoPrioridadeEficiencia === 'atencao'
                          ? 'Oportunidade'
                          : 'Estratégico'
                    const hintEf = detalhesPrioridade
                      ? `Ef. ${labelEf}: expectativa FED.26 representa ${pctEf}% do eleitorado do TD, posição ${detalhesPrioridade.rankEficienciaFed26}/${resumoPorTd.length}.`
                      : 'Ef.: sem base suficiente para calcular a participação.'
                    return (
                      <tr
                        key={r.territorio}
                        className={cn(
                          'td-resumo-table__row td-resumo-table__row--data td-resumo-table__row--premium select-none transition-[transform,box-shadow,background-color] duration-200 ease-out',
                          selecionado && 'td-resumo-table__row--selected',
                          hoverTdTabela === r.territorio && 'td-resumo-table__row--hover-map',
                          spotlightPorTd.maiorPesoEleitoral === r.territorio && 'td-resumo-table__row--spotlight-peso',
                          spotlightPorTd.maiorDelta === r.territorio &&
                            mostrarColunaDeltaFed22 &&
                            'td-resumo-table__row--spotlight-crescimento',
                          spotlightPorTd.piorDelta === r.territorio &&
                            mostrarColunaDeltaFed22 &&
                            spotlightPorTd.deltasDistintos &&
                            'td-resumo-table__row--spotlight-risco'
                        )}
                        style={
                          visualPreset === 'futuristic'
                            ? ({
                                '--fut-row-bg': selecionado
                                  ? cssFuturistTdLinhaSelecionadaSolid(territorioCor.fill)
                                  : hoverTdTabela === r.territorio
                                    ? 'rgba(255,106,0,0.12)'
                                    : 'rgba(18,24,33,0.72)',
                                '--fut-row-selected': cssFuturistTdLinhaSelecionadaSolid(territorioCor.fill),
                                '--fut-row-selected-edge': territorioCor.stroke,
                              } as React.CSSProperties)
                            : undefined
                        }
                        aria-selected={selecionado}
                        title="Passe o mouse para destacar no mapa"
                        onMouseEnter={() => setHoverTdTabela(r.territorio)}
                        onMouseLeave={() => setHoverTdTabela(null)}
                      >
                        <td
                          className={cn(
                            'td-resumo-table__cell td-resumo-table__cell--rank text-right tabular-nums text-text-secondary',
                            rankTd !== undefined && rankTd <= 3 && 'td-resumo-table__rank--top3',
                            rankTd === 1 && 'td-resumo-table__rank--first'
                          )}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setMunicipioFocadoLiderancas(null)
                                setHighlightedTd((prev) => (prev === r.territorio ? null : r.territorio))
                              }}
                              className={cn(
                                'td-resumo-table__expand-btn inline-flex h-4 w-4 items-center justify-center rounded border border-border-card/35 text-[10px] leading-none text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold-soft',
                                selecionado && 'border-accent-gold/45 text-text-primary'
                              )}
                              aria-label={selecionado ? `Recolher ${r.territorio}` : `Expandir ${r.territorio}`}
                              title={selecionado ? 'Recolher municípios' : 'Expandir municípios'}
                            >
                              {selecionado ? '▾' : '▸'}
                            </button>
                            <span>{rankTd ?? '—'}</span>
                          </div>
                        </td>
                        <td
                          className="td-resumo-table__cell td-resumo-table__cell--territorio relative overflow-hidden"
                        >
                          <>
                            <div
                              className={cn(
                                'td-resumo-table__peso-eleitoral-bar pointer-events-none',
                                visualPreset === 'futuristic' && 'td-resumo-table__peso-eleitoral-bar--fut'
                              )}
                              style={
                                {
                                  '--td-peso-a': territorioCor.fill,
                                  width: `${Math.max(8, Math.round((r.eleitores / maxEleitoresTdResumo) * 100))}%`,
                                } as CSSProperties
                              }
                              aria-hidden
                            />
                            <div className="relative z-[1] flex min-w-0 items-center gap-1.5">
                              <span
                                className="h-2 w-2 shrink-0 rounded-sm sm:h-2.5 sm:w-2.5"
                                style={{ backgroundColor: territorioCor.fill }}
                                aria-hidden
                              />
                              <span
                                className={cn(
                                  'min-w-0 break-words font-semibold text-text-primary',
                                  visualPreset === 'futuristic' && 'tracking-tight'
                                )}
                                title={r.territorio}
                              >
                                {r.territorio}
                              </span>
                            </div>
                          </>
                        </td>
                        <td className="td-resumo-table__cell text-right tabular-nums text-text-secondary">
                          {r.municipios}
                        </td>
                        <td className="td-resumo-table__cell text-right tabular-nums text-text-secondary">
                          {fmtInt.format(r.eleitores)}
                        </td>
                        {temDadosEstrategiaTopFed22 ? (
                          <td
                            className="td-resumo-table__cell td-resumo-table__cell--estrategia tabular-nums text-text-primary"
                            style={{ textAlign: 'center' }}
                            title={tituloMedTop22}
                          >
                            {fmtInt.format(Math.round(estrategiaTd))}
                          </td>
                        ) : null}
                        {temDadosFed22 ? (
                          <td
                            className={cn(
                              'td-resumo-table__cell td-resumo-table__cell--fed22 text-right tabular-nums',
                              colunaInicioDesempenho === 'fed22' && 'td-resumo-table__grupo-desempenho-start'
                            )}
                          >
                            {fmtInt.format(v22Td)}
                          </td>
                        ) : null}
                        {painelPlanilhaAtivo && cenarioVotosExibicao ? (
                          <td
                            className={cn(
                              'td-resumo-table__cell td-resumo-table__cell--fed26 text-right tabular-nums',
                              colunaInicioDesempenho === 'plan' && 'td-resumo-table__grupo-desempenho-start'
                            )}
                          >
                            {fmtInt.format(Math.round(valorVotosAgregadoTd(ag, cenarioVotosExibicao)))}
                          </td>
                        ) : null}
                        {mostrarColunaDeltaFed22 ? (
                          <td
                            className={cn(
                              'td-resumo-table__cell td-resumo-table__cell--delta text-center tabular-nums',
                              colunaInicioDesempenho === 'delta' && 'td-resumo-table__grupo-desempenho-start',
                              deltaTd > 0 && 'text-status-success',
                              deltaTd < 0 && 'text-status-danger',
                              deltaTd === 0 && 'text-text-secondary'
                            )}
                          >
                            <span className="td-resumo-table__delta-inner">
                              <span className="td-resumo-table__delta-arrow" aria-hidden>
                                {deltaTd > 0 ? '↑' : deltaTd < 0 ? '↓' : '→'}
                              </span>
                              {formatarIntComSinal(deltaTd)}
                            </span>
                          </td>
                        ) : null}
                        {mostrarColunaTendenciaFuturista && cenarioVotosExibicao ? (
                          <td className="td-resumo-table__cell td-resumo-table__cell--tend text-center align-middle tabular-nums">
                            <div className="flex justify-center py-0.5">
                              <TdPctDeltaCelula key={`${v22Td}-${deltaTd}`} v22={v22Td} delta={deltaTd} />
                            </div>
                          </td>
                        ) : null}
                        {painelPlanilhaAtivo ? (
                          <td
                            className={cn(
                              'td-resumo-table__cell td-resumo-table__cell--lid text-center tabular-nums text-text-primary',
                              colunaInicioDesempenho === 'lid' && 'td-resumo-table__grupo-desempenho-start'
                            )}
                          >
                            {fmtInt.format(ag.liderancas)}
                          </td>
                        ) : null}
                        <td
                          className="td-resumo-table__cell td-resumo-table__cell--vis text-center tabular-nums text-text-secondary"
                          title="Check-ins em agendas concluídas (PI) neste TD"
                        >
                          {visitasTd}
                        </td>
                        <td className="td-resumo-table__cell td-resumo-table__cell--classe td-resumo-table__grupo-status-start">
                          <div className="flex justify-end">
                            <div className="inline-flex items-center gap-2 whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <ClassificacaoTdBadge
                                  tipo={classificacaoPrioridadePeso}
                                  visualTone={visualPreset === 'futuristic' ? 'futuristic' : 'command'}
                                  titleOverride={hintExp26}
                                />
                              </div>
                              <div className="inline-flex items-center gap-1">
                                <ClassificacaoTdBadge
                                  tipo={classificacaoPrioridadeEficiencia}
                                  visualTone={visualPreset === 'futuristic' ? 'futuristic' : 'command'}
                                  labelOverride={
                                    classificacaoPrioridadeEficiencia === 'baixo-impacto'
                                      ? 'Baixa Participação'
                                      : classificacaoPrioridadeEficiencia === 'atencao'
                                        ? 'Oportunidade'
                                      : undefined
                                  }
                                  titleOverride={hintEf}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  )}
                </tbody>
                <tfoot>
                  <tr className="td-resumo-table__row td-resumo-table__row--totals select-none">
                    <td className="td-resumo-table__cell td-resumo-table__cell--rank text-right tabular-nums text-text-muted" aria-hidden />
                    <td
                      className="td-resumo-table__cell td-resumo-table__cell--territorio text-left font-semibold text-text-primary"
                      title="Soma dos 12 territórios de desenvolvimento (PI)"
                    >
                      Total
                    </td>
                    <td className="td-resumo-table__cell text-right tabular-nums font-semibold text-text-primary">
                      {totaisRodapePainelTd.municipios}
                    </td>
                    <td className="td-resumo-table__cell text-right tabular-nums font-semibold text-text-primary">
                      {fmtInt.format(totaisRodapePainelTd.eleitores)}
                    </td>
                    {temDadosEstrategiaTopFed22 ? (
                      <td
                        className="td-resumo-table__cell td-resumo-table__cell--estrategia tabular-nums font-semibold text-text-primary"
                        style={{ textAlign: 'center' }}
                        title="Soma dos valores exibidos (média do top por TD em cada linha, arredondada)"
                      >
                        {fmtInt.format(totaisRodapePainelTd.somaEstrategiaExibida)}
                      </td>
                    ) : null}
                    {temDadosFed22 ? (
                      <td
                        className={cn(
                          'td-resumo-table__cell td-resumo-table__cell--fed22 text-right tabular-nums font-semibold',
                          colunaInicioDesempenho === 'fed22' && 'td-resumo-table__grupo-desempenho-start'
                        )}
                      >
                        {fmtInt.format(totaisRodapePainelTd.somaFed22)}
                      </td>
                    ) : null}
                    {painelPlanilhaAtivo && cenarioVotosExibicao ? (
                      <td
                        className={cn(
                          'td-resumo-table__cell td-resumo-table__cell--fed26 text-right tabular-nums font-semibold',
                          colunaInicioDesempenho === 'plan' && 'td-resumo-table__grupo-desempenho-start'
                        )}
                      >
                        {fmtInt.format(totaisRodapePainelTd.votosPlanCenario)}
                      </td>
                    ) : null}
                    {mostrarColunaDeltaFed22 ? (
                      <td
                        className={cn(
                          'td-resumo-table__cell td-resumo-table__cell--delta text-center tabular-nums font-semibold',
                          colunaInicioDesempenho === 'delta' && 'td-resumo-table__grupo-desempenho-start',
                          totaisRodapePainelTd.delta > 0 && 'text-status-success',
                          totaisRodapePainelTd.delta < 0 && 'text-status-danger',
                          totaisRodapePainelTd.delta === 0 && 'text-text-secondary'
                        )}
                        title="Diferença entre o total da planilha (coluna atual) e a soma Fed.22 nos TDs"
                      >
                        <span className="td-resumo-table__delta-inner">
                          <span className="td-resumo-table__delta-arrow" aria-hidden>
                            {totaisRodapePainelTd.delta > 0 ? '↑' : totaisRodapePainelTd.delta < 0 ? '↓' : '→'}
                          </span>
                          {formatarIntComSinal(totaisRodapePainelTd.delta)}
                        </span>
                      </td>
                    ) : null}
                    {mostrarColunaTendenciaFuturista ? (
                      <td
                        className="td-resumo-table__cell td-resumo-table__cell--tend text-center align-middle font-semibold tabular-nums"
                        title="Variação percentual agregada (total Δ ÷ total Fed.22 nos TDs)"
                      >
                        <div className="flex justify-center py-0.5">
                          <TdPctDeltaCelula
                            key={`${totaisRodapePainelTd.somaFed22}-${totaisRodapePainelTd.delta}`}
                            v22={totaisRodapePainelTd.somaFed22}
                            delta={totaisRodapePainelTd.delta}
                          />
                        </div>
                      </td>
                    ) : null}
                    {painelPlanilhaAtivo ? (
                      <td
                        className={cn(
                          'td-resumo-table__cell td-resumo-table__cell--lid text-center tabular-nums font-semibold text-text-primary',
                          colunaInicioDesempenho === 'lid' && 'td-resumo-table__grupo-desempenho-start'
                        )}
                      >
                        {fmtInt.format(totaisRodapePainelTd.liderancas)}
                      </td>
                    ) : null}
                    <td
                      className="td-resumo-table__cell td-resumo-table__cell--vis text-center tabular-nums font-semibold text-text-primary"
                      title="Total de check-ins (PI) nos 12 TDs"
                    >
                      {totaisRodapePainelTd.visitasTd}
                    </td>
                    <td className="td-resumo-table__cell td-resumo-table__cell--classe td-resumo-table__grupo-status-start text-center text-text-muted">
                      —
                    </td>
                  </tr>
                </tfoot>
              </table>
              {highlightedTd !== null && municipiosLinhasOrdenadas.length > 0 && (
                <div className="td-fut-drill mt-3 pt-2">
                  {painelPlanilhaAtivo && municipioFocadoLiderancas ? (
                    <>
                      <div className="mb-2 flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMunicipioFocadoLiderancas(null)}
                          className={cn(
                            'self-start rounded-lg border border-border-card/40 bg-surface px-2 py-1 font-medium text-text-primary hover:bg-card/80 focus:outline-none focus:ring-2 focus:ring-accent-gold-soft',
                            sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
                          )}
                        >
                          ← Voltar aos municípios
                        </button>
                        <p
                          className={cn(
                            'td-fut-subsection-title font-semibold uppercase tracking-wide text-text-muted',
                            sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs'
                          )}
                        >
                          Lideranças · {municipioFocadoLiderancas}
                        </p>
                      </div>
                      {resumoFed26VsFed22MunicipioDrill ? (
                        <div
                          className={cn(
                            'mb-2 grid grid-cols-3 gap-2 rounded-lg border border-border-card/30 bg-card/40 px-2 py-1.5 tabular-nums text-text-secondary',
                            sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
                          )}
                        >
                          <div className="min-w-0 text-center">
                            <div className="mb-0.5 font-semibold uppercase tracking-wide text-text-muted">
                              {cenarioVotosExibicao === 'anterior' ? 'FED.26' : 'Afer.'}
                            </div>
                            <div
                              title={
                                cenarioVotosExibicao === 'anterior'
                                  ? 'Soma da expectativa FED.26 (planilha) neste município'
                                  : 'Soma da expectativa aferida (planilha) neste município'
                              }
                            >
                              {fmtInt.format(resumoFed26VsFed22MunicipioDrill.vPlan)}
                            </div>
                          </div>
                          <div className="min-w-0 border-l border-border-card/30 pl-2 text-center">
                            <div className="mb-0.5 font-semibold uppercase tracking-wide text-text-muted">Fed.22</div>
                            <div title="Jadyel — votos nominais Dep. Federal 2022 (TSE), neste município">
                              {fmtInt.format(resumoFed26VsFed22MunicipioDrill.v22)}
                            </div>
                          </div>
                          <div className="min-w-0 border-l border-border-card/30 pl-2 text-center">
                            <div className="mb-0.5 font-semibold uppercase tracking-wide text-text-muted">Δ</div>
                            <div
                              className={
                                resumoFed26VsFed22MunicipioDrill.delta > 0
                                  ? 'text-status-success'
                                  : resumoFed26VsFed22MunicipioDrill.delta < 0
                                    ? 'text-status-danger'
                                    : 'text-text-secondary'
                              }
                              title="Diferença: visão de votos da planilha menos Fed. 2022 (mesmo critério da coluna Δ na lista de municípios)"
                            >
                              {formatarIntComSinal(resumoFed26VsFed22MunicipioDrill.delta)}
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {liderancasMunicipioOrdenadas.length === 0 ? (
                        <p
                          className={cn(
                            'text-text-muted',
                            sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
                          )}
                        >
                          Nenhuma liderança da planilha (após o filtro de relevância) neste município.
                        </p>
                      ) : !cenarioVotosExibicao ? (
                        <>
                          <div
                            className={cn(
                              'td-fut-grid-header mb-1.5 grid min-h-[1.25rem] items-baseline gap-x-2 border-b border-border-card/20 pb-1 font-semibold uppercase tracking-wide text-text-muted',
                              sidebarCollapsed ? 'text-[11px] sm:text-xs' : 'text-[9px] sm:text-[10px]'
                            )}
                            style={{ gridTemplateColumns: gridTemplateListaLiderancasDrillSemExpectativa }}
                          >
                            <span className="min-w-0 text-left">Liderança</span>
                            {temColunaCargoDrillLiderancas ? (
                              <span className="min-w-0 truncate text-left" title={cargoColPlanilhaLideranca}>
                                Cargo
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {liderancasMunicipioOrdenadas.map((linha, idx) => {
                              const nomeLinha = String(linha[nomeColPlanilhaLideranca] ?? '').trim() || '—'
                              const cargoLinha = temColunaCargoDrillLiderancas
                                ? String(linha[cargoColPlanilhaLideranca] ?? '').trim()
                                : ''
                              return (
                                <div
                                  key={`${nomeLinha}|${cargoLinha}|${idx}`}
                                  className={cn(
                                    'td-fut-grid-row grid min-h-[1.55rem] items-baseline gap-x-2 pb-0.5 leading-tight text-text-secondary',
                                    sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
                                  )}
                                  style={{ gridTemplateColumns: gridTemplateListaLiderancasDrillSemExpectativa }}
                                >
                                  <span className="td-fut-grid-primary min-w-0 break-words font-medium text-text-primary">
                                    {nomeLinha}
                                  </span>
                                  {temColunaCargoDrillLiderancas ? (
                                    <span
                                      className="min-w-0 truncate text-text-secondary"
                                      title={cargoLinha ? cargoLinha : undefined}
                                    >
                                      {cargoLinha || '—'}
                                    </span>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                          <p
                            className={cn(
                              'td-fut-grid-foot mt-2 tabular-nums text-text-muted',
                              sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
                            )}
                          >
                            Listadas: {fmtInt.format(liderancasMunicipioOrdenadas.length)} · Colunas de expectativa de
                            votos não estão disponíveis na planilha.
                          </p>
                        </>
                      ) : (
                        <>
                          <div
                            className={cn(
                              'td-fut-grid-header mb-1.5 grid min-h-[1.25rem] items-baseline gap-x-2 border-b border-border-card/20 pb-1 font-semibold uppercase tracking-wide text-text-muted',
                              sidebarCollapsed ? 'text-[11px] sm:text-xs' : 'text-[9px] sm:text-[10px]'
                            )}
                            style={{ gridTemplateColumns: gridTemplateListaLiderancasDrillComExpectativa }}
                          >
                            <span className="min-w-0 text-left">Liderança</span>
                            {temColunaCargoDrillLiderancas ? (
                              <span className="min-w-0 truncate text-left" title={cargoColPlanilhaLideranca}>
                                Cargo
                              </span>
                            ) : null}
                            <span
                              className="border-l border-border-card/35 pl-2 text-right tabular-nums sm:pl-3"
                              title="Expectativa conforme a visão de votos"
                            >
                              {cenarioVotosExibicao === 'anterior' ? 'FED.26' : 'Afer.'}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            {liderancasMunicipioOrdenadas.map((linha, idx) => {
                              const nomeLinha = String(linha[nomeColPlanilhaLideranca] ?? '').trim() || '—'
                              const cargoLinha = temColunaCargoDrillLiderancas
                                ? String(linha[cargoColPlanilhaLideranca] ?? '').trim()
                                : ''
                              const votos = Math.round(
                                valorVotosLinhaPlanilha(linha, colunasPlanilha, cenarioVotosExibicao)
                              )
                              return (
                                <div
                                  key={`${nomeLinha}|${cargoLinha}|${idx}`}
                                  className={cn(
                                    'td-fut-grid-row grid min-h-[1.55rem] items-baseline gap-x-2 pb-0.5 leading-tight text-text-secondary',
                                    sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
                                  )}
                                  style={{ gridTemplateColumns: gridTemplateListaLiderancasDrillComExpectativa }}
                                >
                                  <span className="td-fut-grid-primary min-w-0 break-words font-medium text-text-primary">
                                    {nomeLinha}
                                  </span>
                                  {temColunaCargoDrillLiderancas ? (
                                    <span
                                      className="min-w-0 truncate text-text-secondary"
                                      title={cargoLinha ? cargoLinha : undefined}
                                    >
                                      {cargoLinha || '—'}
                                    </span>
                                  ) : null}
                                  <span
                                    className="border-l border-border-card/35 pl-2 text-right tabular-nums text-text-secondary sm:pl-3"
                                    title={
                                      cenarioVotosExibicao === 'anterior' ? 'Expectativa FED.26' : 'Expectativa aferida'
                                    }
                                  >
                                    {fmtInt.format(votos)}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                          <p
                            className={cn(
                              'td-fut-grid-foot mt-2 tabular-nums text-text-muted',
                              sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
                            )}
                          >
                            Listadas: {fmtInt.format(totaisDrillLiderancasMunicipio.n)} ·{' '}
                            {cenarioVotosExibicao === 'anterior' ? 'FED.26' : 'Aferido'}:{' '}
                            {fmtInt.format(Math.round(totaisDrillLiderancasMunicipio.votos))}
                          </p>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                        <p
                          className={cn(
                            'td-fut-subsection-title font-semibold uppercase tracking-wide text-text-muted',
                            sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs'
                          )}
                        >
                          Municípios ({municipiosLinhasPainel.length})
                          {municipioFocadoLiderancas &&
                          municipiosLinhasPainel.length < municipiosLinhasOrdenadas.length ? (
                            <span
                              className={cn(
                                'ml-1 font-normal normal-case text-text-muted',
                                sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px]'
                              )}
                            >
                              · filtro por cidade
                            </span>
                          ) : null}
                        </p>
                        {municipioFocadoLiderancas && !painelPlanilhaAtivo ? (
                          <button
                            type="button"
                            onClick={() => setMunicipioFocadoLiderancas(null)}
                            className={cn(
                              'shrink-0 rounded-md border border-border-card/50 bg-surface px-2 py-0.5 font-medium text-text-primary hover:bg-card/80 focus:outline-none focus:ring-2 focus:ring-accent-gold-soft',
                              sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
                            )}
                          >
                            Mostrar todos os municípios
                          </button>
                        ) : null}
                      </div>
                      <div
                        className={cn(
                          'td-fut-grid-header mb-1.5 grid min-h-[1.25rem] items-baseline gap-x-2 border-b border-border-card/20 pb-1 font-semibold uppercase tracking-wide text-text-muted',
                          sidebarCollapsed ? 'text-[11px] sm:text-xs' : 'text-[9px] sm:text-[10px]'
                        )}
                        style={{ gridTemplateColumns: gridTemplateListaMunicipiosPainelTd }}
                      >
                        <span className="min-w-0 text-left" title="Município">
                          Município
                        </span>
                        <span
                          className="border-l border-border-card/35 pl-2 text-right tabular-nums sm:pl-3"
                          title="Eleitorado do município (base interna)"
                        >
                          Eleit.
                        </span>
                        {temDadosEstrategiaTopFed22 ? (
                          <span
                            className="border-l border-border-card/35 pl-2 text-right tabular-nums sm:pl-2"
                            title={tooltipMedTop22Header}
                          >
                            Méd.Top5 22
                          </span>
                        ) : null}
                        {temDadosFed22 ? (
                          <span
                            className="border-l border-border-card/35 pl-2 text-right tabular-nums sm:pl-2"
                            title="Jadyel — Dep. Federal 2022"
                          >
                            Fed.22
                          </span>
                        ) : null}
                        {painelPlanilhaAtivo ? (
                          <>
                            <span className="border-l border-border-card/35 pl-2 text-center tabular-nums sm:pl-2">
                              Lid.
                            </span>
                            {cenarioVotosExibicao ? (
                              <span className="text-right tabular-nums">
                                {cenarioVotosExibicao === 'anterior' ? 'FED.26' : 'Afer.'}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                        {mostrarColunaDeltaFed22 ? (
                          <span
                            className="border-l border-border-card/35 pl-2 text-right tabular-nums sm:pl-2"
                            title="Visão planilha − Fed. 2022"
                          >
                            Δ
                          </span>
                        ) : null}
                        <span
                          className="border-l border-border-card/35 pl-2 text-right tabular-nums sm:pl-3"
                          title={
                            painelPlanilhaAtivo && cenarioVotosExibicao
                              ? cenarioVotosExibicao === 'anterior'
                                ? 'Expectativa FED.26 (planilha) sobre o eleitorado do município (%)'
                                : 'Expectativa aferida (planilha) sobre o eleitorado do município (%)'
                              : 'Expectativa de votos sobre o eleitorado do município (%) — requer planilha com colunas de expectativa'
                          }
                        >
                          % EXP.
                        </span>
                        <span
                          className="border-l border-border-card/35 pl-2 text-center tabular-nums sm:pl-2"
                          title="Visitas com check-in (Campo & Agenda) neste município"
                        >
                          Vis.
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col gap-0.5 overflow-x-auto">
                        {municipiosLinhasPainel.map(({ nome, eleitores }) => {
                          const muniMetrica = obterMetricasCidadeOficial(metricasPorCidadeNoTdMap, nome)
                          const v22Mun =
                            mapaFed22Municipios != null ? obterVotos2022JadyelMunicipio(mapaFed22Municipios, nome) : 0
                          const vPlanMun =
                            cenarioVotosExibicao != null
                              ? Math.round(valorVotosCidade(muniMetrica, cenarioVotosExibicao))
                              : null
                          const deltaMun =
                            mostrarColunaDeltaFed22 && vPlanMun !== null ? vPlanMun - v22Mun : null
                          const podeDrillCidade = painelPlanilhaAtivo
                          const munFocoLista = municipioFocadoLiderancas
                          const cidadeDestacadaPainel =
                            munFocoLista != null &&
                            normalizeMunicipioNome(nome) === normalizeMunicipioNome(munFocoLista)
                          return (
                            <div
                              key={nome}
                              className={cn(
                                'td-fut-grid-row grid min-h-[1.55rem] items-baseline gap-x-2 pb-0.5 leading-tight text-text-secondary',
                                sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]',
                                cidadeDestacadaPainel && 'td-fut-grid-row--selected',
                                podeDrillCidade && 'td-fut-grid-row--interactive cursor-pointer outline-none'
                              )}
                              style={{ gridTemplateColumns: gridTemplateListaMunicipiosPainelTd }}
                              role={podeDrillCidade ? 'button' : undefined}
                              tabIndex={podeDrillCidade ? 0 : undefined}
                              title={
                                podeDrillCidade
                                  ? 'Duplo clique ou Enter para ver lideranças e expectativa de votos deste município'
                                  : undefined
                              }
                              onDoubleClick={
                                podeDrillCidade
                                  ? () => {
                                      setMunicipioFocadoLiderancas(nome)
                                    }
                                  : undefined
                              }
                              onKeyDown={
                                podeDrillCidade
                                  ? (e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault()
                                        setMunicipioFocadoLiderancas(nome)
                                      }
                                    }
                                  : undefined
                              }
                            >
                              <span className="td-fut-grid-primary min-w-0 break-words font-medium text-text-primary" title={nome}>
                                {nome}
                              </span>
                              <span
                                className="border-l border-border-card/35 pl-2 text-right tabular-nums text-text-secondary sm:pl-3"
                                title="Eleitorado (base interna)"
                              >
                                {eleitores != null ? fmtInt.format(eleitores) : '—'}
                              </span>
                              {temDadosEstrategiaTopFed22 ? (
                                <span
                                  className="border-l border-border-card/35 pl-2 text-right tabular-nums text-text-secondary sm:pl-2"
                                  title={tooltipMedTop22Header}
                                >
                                  {fmtInt.format(
                                    Math.round(mediaTop22PorMunicipioNorm.get(normalizeMunicipioNome(nome)) ?? 0)
                                  )}
                                </span>
                              ) : null}
                              {temDadosFed22 ? (
                                <span
                                  className="border-l border-border-card/35 pl-2 text-right tabular-nums text-text-secondary sm:pl-2"
                                  title="Jadyel — Dep. Federal 2022"
                                >
                                  {fmtInt.format(v22Mun)}
                                </span>
                              ) : null}
                              {painelPlanilhaAtivo ? (
                                <>
                                  <span
                                    className="border-l border-border-card/35 pl-2 text-center tabular-nums font-medium text-text-primary sm:pl-2"
                                    title="Lideranças"
                                  >
                                    {fmtInt.format(muniMetrica.lid)}
                                  </span>
                                  {cenarioVotosExibicao ? (
                                    <span
                                      className="text-right tabular-nums text-text-secondary"
                                      title={cenarioVotosExibicao === 'anterior' ? 'FED.26' : 'Aferido'}
                                    >
                                      {fmtInt.format(Math.round(valorVotosCidade(muniMetrica, cenarioVotosExibicao)))}
                                    </span>
                                  ) : null}
                                </>
                              ) : null}
                              {deltaMun !== null ? (
                                <span
                                  className={`border-l border-border-card/35 pl-2 text-right tabular-nums sm:pl-2 ${
                                    deltaMun > 0
                                      ? 'text-status-success'
                                      : deltaMun < 0
                                        ? 'text-status-danger'
                                        : 'text-text-secondary'
                                  }`}
                                  title="Visão atual da planilha menos Fed. 2022"
                                >
                                  {formatarIntComSinal(deltaMun)}
                                </span>
                              ) : null}
                              <span className="border-l border-border-card/35 pl-2 text-right tabular-nums text-text-secondary sm:pl-3">
                                {painelPlanilhaAtivo && cenarioVotosExibicao
                                  ? formatarPctVotosSobreEleitores(
                                      valorVotosCidade(muniMetrica, cenarioVotosExibicao),
                                      eleitores ?? 0
                                    ) ?? '—'
                                  : '—'}
                              </span>
                              <span
                                className="border-l border-border-card/35 pl-2 text-center tabular-nums text-text-secondary sm:pl-2"
                                title="Check-ins em agendas concluídas (PI) neste município"
                              >
                                {visitasPorMunicipioNorm.get(normalizeMunicipioNome(nome)) ?? 0}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <div
                        className={cn(
                          'td-fut-grid-foot td-fut-grid-foot--totais-municipios mt-2 grid min-h-[1.35rem] items-baseline gap-x-2 border-t border-border-card/25 pt-2 tabular-nums text-text-muted',
                          sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
                        )}
                        style={{ gridTemplateColumns: gridTemplateListaMunicipiosPainelTd }}
                        title="Totais na lista de municípios visível (mesmo território)"
                      >
                        <span className="min-w-0 truncate font-semibold uppercase tracking-wide text-text-muted">
                          Total
                        </span>
                        <span
                          className="border-l border-border-card/35 pl-2 text-right text-text-secondary sm:pl-3"
                          title="Soma do eleitorado dos municípios listados"
                        >
                          {fmtInt.format(somaEleitoresListaTd)}
                        </span>
                        {temDadosEstrategiaTopFed22 ? (
                          <span
                            className="border-l border-border-card/35 pl-2 text-right text-text-secondary sm:pl-2"
                            title="Média aritmética da coluna Méd.Top5 22 nesta lista"
                          >
                            {mediaMedTop22ListaMunicipiosTd !== null
                              ? fmtInt.format(Math.round(mediaMedTop22ListaMunicipiosTd))
                              : '—'}
                          </span>
                        ) : null}
                        {temDadosFed22 ? (
                          <span
                            className="border-l border-border-card/35 pl-2 text-right text-text-secondary sm:pl-2"
                            title="Soma Fed. 2022 (Jadyel) na lista"
                          >
                            {fmtInt.format(somaFed22ListaTd)}
                          </span>
                        ) : null}
                        {painelPlanilhaAtivo ? (
                          <>
                            <span
                              className="border-l border-border-card/35 pl-2 text-center text-text-primary sm:pl-2"
                              title="Soma de lideranças (planilha) na lista"
                            >
                              {fmtInt.format(somaLiderancasListaTd)}
                            </span>
                            {cenarioVotosExibicao ? (
                              <span
                                className="text-right text-text-secondary"
                                title={
                                  cenarioVotosExibicao === 'anterior'
                                    ? 'Soma expectativa FED.26 na lista'
                                    : 'Soma expectativa aferida na lista'
                                }
                              >
                                {fmtInt.format(Math.round(somaVotosListaTd))}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                        {mostrarColunaDeltaFed22 ? (
                          <span
                            className={`border-l border-border-card/35 pl-2 text-right sm:pl-2 ${
                              somaVotosListaTd - somaFed22ListaTd > 0
                                ? 'text-status-success'
                                : somaVotosListaTd - somaFed22ListaTd < 0
                                  ? 'text-status-danger'
                                  : 'text-text-secondary'
                            }`}
                            title="Soma das diferenças (planilha − Fed.22) na lista"
                          >
                            {formatarIntComSinal(Math.round(somaVotosListaTd - somaFed22ListaTd))}
                          </span>
                        ) : null}
                        <span className="border-l border-border-card/35 pl-2 text-right text-text-secondary sm:pl-3">
                          {pctExpRodapeListaMunicipiosTd ?? '—'}
                        </span>
                        <span
                          className="border-l border-border-card/35 pl-2 text-center text-text-secondary sm:pl-2"
                          title="Soma de visitas (check-in) na lista"
                        >
                          {fmtInt.format(somaVisitasListaTd)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {highlightedTd !== null ? (
              <HistoricoPesquisasPorTdMapSection
                variant="painel"
                territorioFoco={highlightedTd}
                municipioFoco={municipioFocadoLiderancas}
              />
            ) : null}
            {(() => {
              const temFeedbackEstrategico = Boolean(feedbackEstrategicoTd)
              const temPesquisas =
                Boolean(territorioFeedbackAtivo) &&
                Boolean(insightPesquisaTd) &&
                (insightPesquisaTd?.length ?? 0) > 0
              const temTopPartidosFed22 =
                Boolean(territorioFeedbackAtivo) &&
                Boolean(linhasFeedbackTopPartidosFed22Td) &&
                (linhasFeedbackTopPartidosFed22Td?.length ?? 0) > 0
              if (!temFeedbackEstrategico && !temPesquisas && !temTopPartidosFed22) return null
              const qtdCards = [temFeedbackEstrategico, temPesquisas, temTopPartidosFed22].filter(Boolean).length
              const cardClass =
                'min-w-0 flex-1 basis-[min(100%,17.5rem)] rounded-xl border border-[rgba(255,255,255,0.07)] bg-[rgba(16,22,31,0.92)] p-3'
              return (
                <div
                  className={cn(
                    'mt-3 flex gap-3',
                    qtdCards >= 2 ? 'flex-row flex-wrap items-stretch' : 'flex-col'
                  )}
                >
                  {temFeedbackEstrategico && feedbackEstrategicoTd ? (
                    <div className={cardClass}>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                        Feedback estratégico · {feedbackEstrategicoTd.territorio}
                      </p>
                      <div className="space-y-1.5">
                        {feedbackEstrategicoTd.notas.map((nota, idx) => (
                          <p
                            key={`${feedbackEstrategicoTd.territorio}-${idx}`}
                            className="text-[11px] leading-snug text-text-primary"
                          >
                            {nota}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {temPesquisas && territorioFeedbackAtivo && insightPesquisaTd ? (
                    <div className={cardClass}>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                        Pesquisas · {territorioFeedbackAtivo}
                      </p>
                      <div className="space-y-1.5">
                        {insightPesquisaTd.map((nota, idx) => (
                          <p
                            key={`${territorioFeedbackAtivo}-pesquisa-${idx}`}
                            className="text-[11px] leading-snug text-text-primary"
                          >
                            {nota}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {temTopPartidosFed22 && territorioFeedbackAtivo && linhasFeedbackTopPartidosFed22Td ? (
                    <div className={cardClass}>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                        Fed. 2022 · Top 5 partidos · {territorioFeedbackAtivo}
                      </p>
                      <p className="mb-2 text-[10px] leading-snug text-text-muted">
                        Soma dos votos nominais de todos os deputados federais da legenda nos municípios do TD.
                      </p>
                      <div className="space-y-1.5">
                        {linhasFeedbackTopPartidosFed22Td.map((linha, idx) => (
                          <p
                            key={`${territorioFeedbackAtivo}-partido-${idx}`}
                            className="text-[11px] leading-snug text-text-primary"
                          >
                            {linha}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })()}
          </aside>
          </div>
        )}
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
