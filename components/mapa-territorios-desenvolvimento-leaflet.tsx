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
}

const GEO_STYLE_CTX_VAZIO: GeoStyleContext = {
  classificacao: new Map(),
  hoverTdTabela: null,
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

function aplicarFocoMarcadoresPesoTd(
  markerByTd: Map<TerritorioDesenvolvimentoPI, L.Marker>,
  focusTd: TerritorioDesenvolvimentoPI | null,
  geoLayer: L.GeoJSON
) {
  for (const [td, marker] of markerByTd) {
    const pos = posicaoMarcadorTdNoGeoLayer(geoLayer, td)
    if (pos) marker.setLatLng(pos)

    const el = marker.getElement()
    if (el) {
      const outrosOcultos = focusTd !== null && td !== focusTd
      el.style.opacity = outrosOcultos ? '0.12' : '1'
      el.style.pointerEvents = 'none'
    }
    marker.setZIndexOffset(focusTd !== null && td === focusTd ? 3200 : focusTd !== null ? 0 : 200)
    const m = marker as L.Marker & { update?: () => void }
    m.update?.()
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
  geoLayer: L.GeoJSON
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

    const html = `<div class="td-peso-eleitores-marker-inner td-peso-eleitores-marker-inner--vivo" style="--td-marker-s:${escala.toFixed(3)}">
      <div class="td-peso-eleitores-card" style="max-width:118px;padding:6px 8px 7px;border-radius:11px;border:2px solid ${stroke};background:linear-gradient(165deg,${fill}f2 0%,${fill} 100%);text-align:center">
        <div style="font-size:9px;font-weight:700;line-height:1.2;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.45);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden" title="${nomeCurto}">${nomeCurto}</div>
        <div style="margin-top:3px;font-size:16px;font-weight:800;line-height:1;color:#fff;letter-spacing:-0.02em;text-shadow:0 1px 3px rgba(0,0,0,0.5)">${pctStr}%</div>
        <div style="margin-top:1px;font-size:8px;font-weight:600;line-height:1.15;color:rgba(255,255,255,0.94);text-shadow:0 1px 2px rgba(0,0,0,0.35)">${subEleit}</div>
        <div style="margin-top:2px;font-size:7px;font-weight:500;line-height:1.1;color:rgba(255,255,255,0.78)">do eleitorado PI</div>
      </div>
    </div>`

    const icon = L.divIcon({
      className: 'td-eleitores-peso-marker',
      html,
      iconSize: [126, 96],
      iconAnchor: [63, 86],
    })

    const marker = L.marker(center, {
      icon,
      interactive: false,
      keyboard: false,
      pane: paneName,
      riseOnHover: false,
    }).addTo(grupo)
    markerByTd.set(r.territorio, marker)
  }

  grupo.addTo(map)
  return markerByTd
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

function formatarPctExpectativaSobreEleitoresTd(
  ag: AgregadoPlanilhaPorTd,
  cenario: CenarioVotosPainelMapaTd,
  eleitoresTd: number
): string | null {
  return formatarPctVotosSobreEleitores(valorVotosAgregadoTd(ag, cenario), eleitoresTd)
}

function formatarIntComSinal(n: number): string {
  const r = Math.round(n)
  const abs = fmtInt.format(Math.abs(r))
  if (r > 0) return `+${abs}`
  if (r < 0) return `-${abs}`
  return fmtInt.format(0)
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
    incrementarZoomAposEncaixe: 2,
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

export function MapaTerritoriosDesenvolvimentoLeaflet() {
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
  })
  const highlightedTdRef = useRef<TerritorioDesenvolvimentoPI | null>(null)
  const municipioFocadoLiderancasRef = useRef<string | null>(null)
  const skipRefitFullOnInitialNullRef = useRef(true)

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [highlightedTd, setHighlightedTd] = useState<TerritorioDesenvolvimentoPI | null>(null)

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

  /** Mesmo `grid-template-columns` no cabeçalho e em cada linha — alinha Mun., % EXP., FED.26, etc. */
  const gridTemplateListaMunicipiosPainelTd = useMemo(() => {
    const cols: string[] = [
      'minmax(5.5rem, 1.35fr)',
      'minmax(3.75rem, max-content)',
      'minmax(2.75rem, max-content)',
    ]
    if (painelPlanilhaAtivo) {
      cols.push('minmax(1.75rem, max-content)')
      if (cenarioVotosExibicao) {
        cols.push('minmax(3.75rem, max-content)')
      }
    }
    if (temDadosFed22) {
      cols.push('minmax(3.5rem, max-content)')
    }
    if (mostrarColunaDeltaFed22) {
      cols.push('minmax(3.25rem, max-content)')
    }
    return cols.join(' ')
  }, [painelPlanilhaAtivo, cenarioVotosExibicao, temDadosFed22, mostrarColunaDeltaFed22])

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
          maxBounds: MAX_BOUNDS_MAPA_TD,
          maxBoundsViscosity: 1.0,
          minZoom: 5,
          maxZoom: 16,
          worldCopyJump: false,
        }).setView(L.latLng(-7.5, -42.5), 7.5)
        map.doubleClickZoom.disable()
        mapEl.style.backgroundColor = FUNDO_MAPA_BRANCO
        mapRef.current = map

        const maskPane = map.createPane('piMaskOutside')
        maskPane.style.zIndex = '390'
        maskPane.style.pointerEvents = 'none'

        const munisPane = map.createPane('piMunicipios')
        munisPane.style.zIndex = '450'

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap &copy; CARTO · Malha IBGE',
          maxZoom: 19,
          maxNativeZoom: 19,
          subdomains: 'abcd',
          opacity: 0.32,
        }).addTo(map)

        if (geoUf) {
          const maskFeature = buildOutsidePiauiMask(geoUf)
          if (maskFeature) {
            L.geoJSON(maskFeature as unknown as GeoJSON.GeoJSON, {
              pane: 'piMaskOutside',
              interactive: false,
              style: {
                fillColor: FUNDO_MAPA_BRANCO,
                fillOpacity: 1,
                stroke: false,
              },
            }).addTo(map)
          }
        }

        const geoLayer = L.geoJSON(geoMunicipios, {
          pane: 'piMunicipios',
          style: (feature) =>
            styleForMunicipioFeature(feature as GeoJSON.Feature | undefined, null, null, GEO_STYLE_CTX_VAZIO),
          onEachFeature: (feature, layer) => {
            const p = feature.properties as GeoProps
            const nome = p.nm_mun ?? p.codarea
            const td = p.td ?? '—'
            layer.bindTooltip(
              `<div style="font-family:system-ui,sans-serif;min-width:140px">
                <div style="font-weight:700;font-size:12px;color:#1c1c1c;margin-bottom:2px">${escapeHtml(String(nome))}</div>
                <div style="font-size:10px;color:#6b6b6b">${escapeHtml(String(td))}</div>
                <div style="margin-top:6px;font-size:10px;color:#737373">Duplo clique no mapa: resumo + lideranças deste município</div>
              </div>`,
              { sticky: true, direction: 'top', opacity: 0.95, className: 'td-municipio-tooltip' }
            )
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

        const markerByTdPesoEleitores = montarMarcadoresPesoEleitoresPorTd(map, geoLayer)

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
            aplicarFocoMarcadoresPesoTd(markerByTdPesoEleitores, highlightedTdRef.current, geoLayer)
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
  }, [])

  /**
   * Depende de `mapHostAlturaFixaPx`: ao focar um TD a lista aumenta o minHeight e a altura fixa do
   * host do Leaflet muda — sem `invalidateSize` + refit após isso, o encaixe usa tamanho antigo e o mapa “pula” (ex.: desce).
   */
  useLayoutEffect(() => {
    if (loadState !== 'ready' || !mapTdControllerRef.current || !mapRef.current) return
    geoStyleContextRef.current = { classificacao: classificacaoPorTd, hoverTdTabela }
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
  }, [highlightedTd, municipioFocadoLiderancas, mapHostAlturaFixaPx, loadState, sidebarCollapsed, classificacaoPorTd])

  /**
   * Só `hoverTdTabela`: evita refit do mapa a cada `mouseenter`/`mouseleave`.
   * `highlightedTd`, `classificacaoPorTd` e foco de município são reaplicados no `useLayoutEffect`.
   */
  useEffect(() => {
    if (loadState !== 'ready' || !mapTdControllerRef.current) return
    geoStyleContextRef.current = { classificacao: classificacaoPorTd, hoverTdTabela }
    mapTdControllerRef.current.applyStyles(highlightedTd, municipioFocadoLiderancas)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional: só reagir ao hover da tabela
  }, [hoverTdTabela])

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
      {loadState === 'ready' ? (
        <div className="td-mapa-statusbar" aria-live="polite">
          <div className="td-mapa-statusbar__row">
            <span className="td-mapa-statusbar__lead">
              <span className="td-mapa-statusbar__dot" aria-hidden />
              Sistema ativo
            </span>
            <span className="td-mapa-statusbar__meta">
              <strong>{fmtInt.format(totaisResumo.municipios)}</strong> municípios monitorados
            </span>
            {deltaPlanilhaVsFed22Estado != null ? (
              <span
                className={cn(
                  'td-mapa-statusbar__delta',
                  deltaPlanilhaVsFed22Estado > 0 && 'td-mapa-statusbar__delta--up',
                  deltaPlanilhaVsFed22Estado < 0 && 'td-mapa-statusbar__delta--down'
                )}
              >
                {deltaPlanilhaVsFed22Estado > 0 ? '↗' : deltaPlanilhaVsFed22Estado < 0 ? '↘' : '→'} Crescimento (sim. vs
                Fed.22): {formatarIntComSinal(deltaPlanilhaVsFed22Estado)} votos
              </span>
            ) : null}
            {territoriosEmAtencao > 0 ? (
              <span className="td-mapa-statusbar__warn">
                ⚠ {territoriosEmAtencao}{' '}
                {territoriosEmAtencao === 1 ? 'território em atenção' : 'territórios em atenção'}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        ref={viewportFitRef}
        className={cn(
          'pointer-events-none flex w-full items-start justify-start bg-white pl-3 sm:pl-4 md:pl-6',
          mapHostAlturaFixaPx !== null ? 'shrink-0' : 'min-h-0 flex-1 basis-0'
        )}
        style={
          mapHostAlturaFixaPx !== null && mapHostAlturaFixaPx > 0
            ? { height: mapHostAlturaFixaPx, minHeight: 0 }
            : { minHeight: 0 }
        }
      >
        <div
          ref={aspectBoxRef}
          className="td-mapa-vp-halo pointer-events-auto relative isolate z-[1] max-h-full max-w-full overflow-hidden bg-white sm:rounded-xl"
        >
          <div
            ref={containerRef}
            className="leaflet-td-pi-host relative z-[1] isolate h-full min-h-0 w-full !bg-white"
            role="presentation"
          />
        </div>
      </div>
      {loadState === 'loading' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/85 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2 text-text-secondary">
            <div className="h-8 w-8 animate-pulse rounded-full bg-accent-gold/35" aria-hidden />
            <span className="text-sm font-medium">Carregando malha municipal…</span>
          </div>
        </div>
      )}
      {loadState === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/95 p-4">
          <p className="max-w-md text-center text-sm text-status-danger">
            Não foi possível carregar os polígonos do mapa. {errorMessage}
          </p>
        </div>
      )}

      {loadState === 'ready' && (
        <div
          className={cn(
            'pointer-events-none absolute top-12 right-5 z-[1100] max-sm:top-10 max-sm:right-3 sm:right-6 md:right-8 lg:right-10 min-w-0',
            sidebarCollapsed
              ? 'w-[min(34rem,calc(100%-9rem))] max-w-[min(34rem,calc(100%-9rem))] lg:w-[min(46rem,calc(100%-6rem))] lg:max-w-[min(46rem,calc(100%-6rem))]'
              : 'w-[min(34rem,calc(100%-9rem))] max-w-[min(34rem,calc(100%-9rem))]'
          )}
        >
          <aside
            data-resumo-td-amplo={sidebarCollapsed ? 'true' : undefined}
            className="pointer-events-auto relative z-[1100] max-h-[min(85dvh,calc(100dvh-7rem))] w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain p-0 text-text-primary"
            aria-label="Mapa de dominância eleitoral por território de desenvolvimento"
          >
            <div className="space-y-1">
              <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-text-muted sm:text-sm">
                Mapa de dominância eleitoral
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
              {mostrarSeletorCenario ? (
                <label className="mt-2 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
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
              <p className="text-[10px] leading-snug text-text-muted sm:text-[11px]">
                {highlightedTd ? (
                  painelPlanilhaAtivo ? (
                    <>
                      Com um TD focado, duplo clique (ou Enter) em um município na lista abaixo para ver lideranças e
                      expectativa de votos. No mapa, duplo clique num município abre já as lideranças (TD + cidade) e
                      destaca o polígono. Esc volta da lista de lideranças para os municípios; na lista de municípios,
                      Esc volta ao resumo dos 12 TDs. Role este painel à direita se a lista ou o gráfico forem longos.
                    </>
                  ) : (
                    <>
                      Duplo clique na linha (ou Enter) ou Esc para voltar ao resumo dos 12 TDs. No mapa, duplo clique num
                      município foca o TD, abre as lideranças dessa cidade e destaca o polígono. Role este painel à
                      direita se a lista for longa.
                    </>
                  )
                ) : (
                  'Duplo clique na linha (ou Enter) para focar o TD no mapa e ver a lista de municípios. Duplo clique num município no mapa abre o TD e já a lista de lideranças dessa cidade.'
                )}
              </p>
              <p className="mt-1.5 text-[9px] leading-snug text-text-muted sm:text-[10px]">
                <span className="font-semibold text-text-secondary">Prioridade estratégica</span> (tercis, só entre os 12):{' '}
                {painelPlanilhaAtivo && cenarioVotosExibicao !== null
                  ? 'ordena pela expectativa de votos da planilha ÷ eleitorado do TD (visão de votos atual).'
                  : 'ordena pela fatia do eleitorado do TD no estado.'}
              </p>
            </div>
            <div className="td-resumo-map-table-wrap mt-2 w-full min-w-0 max-w-full">
              <table
                aria-label="Painel de decisão — territórios de desenvolvimento"
                className="td-resumo-table td-resumo-table--premium w-full"
              >
                <thead>
                  <tr className="td-resumo-table__row td-resumo-table__row--header tracking-wide">
                    <th
                      className="td-resumo-table__cell td-resumo-table__cell--rank text-right font-medium"
                      title="Posição no ranking pelo critério atual (entre os 12 TDs)"
                    >
                      #
                    </th>
                    <th className="td-resumo-table__cell td-resumo-table__cell--territorio text-left font-medium">
                      Território
                    </th>
                    <th className="td-resumo-table__cell text-right font-medium" title="Quantidade de municípios no TD">
                      Mun.
                    </th>
                    {temDadosFed22 ? (
                      <th
                        className={cn(
                          'td-resumo-table__cell text-right font-medium',
                          colunaInicioDesempenho === 'fed22' && 'td-resumo-table__grupo-desempenho-start'
                        )}
                        title="Jadyel — votos nominais Dep. Federal 2022 (TSE), somados nos municípios do TD"
                      >
                        FED.22
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
                        {cenarioVotosExibicao === 'anterior' ? 'FED.26' : 'Afer.'}
                      </th>
                    ) : null}
                    {mostrarColunaDeltaFed22 ? (
                      <th
                        className={cn(
                          'td-resumo-table__cell text-right font-medium',
                          colunaInicioDesempenho === 'delta' && 'td-resumo-table__grupo-desempenho-start'
                        )}
                        title="Diferença de votos: visão atual da planilha menos Fed. 2022 no TD"
                      >
                        Dif.
                      </th>
                    ) : null}
                    {painelPlanilhaAtivo ? (
                      <th
                        className={cn(
                          'td-resumo-table__cell text-right font-medium',
                          colunaInicioDesempenho === 'lid' && 'td-resumo-table__grupo-desempenho-start'
                        )}
                        title="Quantidade de lideranças na planilha (após filtro de relevância)"
                      >
                        Lid.
                      </th>
                    ) : null}
                    <th
                      className="td-resumo-table__cell text-right font-medium"
                      title={
                        painelPlanilhaAtivo && cenarioVotosExibicao
                          ? cenarioVotosExibicao === 'anterior'
                            ? 'Expectativa de votos FED.26 (planilha) sobre o eleitorado do TD (%)'
                            : 'Expectativa aferida / Jadyel 2026 (planilha) sobre o eleitorado do TD (%)'
                          : 'Expectativa de votos sobre o eleitorado do TD (%) — requer planilha com colunas de expectativa'
                      }
                    >
                      % EXP.
                    </th>
                    <th
                      className="td-resumo-table__cell td-resumo-table__grupo-status-start text-right font-medium"
                      title="Prioridade estratégica relativa aos 12 TDs (tercis): estratégico, atenção ou baixo impacto"
                    >
                      Prioridade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resumoLinhasVisiveis.map((r) => {
                    const cor = CORES_TERRITORIO_DESENVOLVIMENTO_PI[r.territorio]
                    const selecionado = highlightedTd === r.territorio
                    const ag = agregadoTdPlanilha.get(r.territorio) ?? AGREGADO_PLANILHA_VAZIO
                    const v22Td = votosFed22PorTd.get(r.territorio) ?? 0
                    const vPlanTd = cenarioVotosExibicao
                      ? Math.round(valorVotosAgregadoTd(ag, cenarioVotosExibicao))
                      : 0
                    const deltaTd = mostrarColunaDeltaFed22 ? vPlanTd - v22Td : 0
                    const rankTd = rankingPorTd.get(r.territorio)
                    return (
                      <tr
                        key={r.territorio}
                        className={cn(
                          'td-resumo-table__row td-resumo-table__row--data td-resumo-table__row--premium cursor-pointer select-none transition-[transform,box-shadow,background-color] duration-200 ease-out',
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
                        aria-selected={selecionado}
                        tabIndex={0}
                        title="Duplo clique para destacar este território no mapa"
                        onMouseEnter={() => setHoverTdTabela(r.territorio)}
                        onMouseLeave={() => setHoverTdTabela(null)}
                        onDoubleClick={() => {
                          setMunicipioFocadoLiderancas(null)
                          setHighlightedTd((prev) => (prev === r.territorio ? null : r.territorio))
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            setMunicipioFocadoLiderancas(null)
                            setHighlightedTd((prev) => (prev === r.territorio ? null : r.territorio))
                          }
                        }}
                      >
                        <td
                          className={cn(
                            'td-resumo-table__cell td-resumo-table__cell--rank text-right tabular-nums text-text-secondary',
                            rankTd !== undefined && rankTd <= 3 && 'td-resumo-table__rank--top3',
                            rankTd === 1 && 'td-resumo-table__rank--first'
                          )}
                        >
                          {rankTd ?? '—'}
                        </td>
                        <td className="td-resumo-table__cell td-resumo-table__cell--territorio relative overflow-hidden">
                          <div
                            className="td-resumo-table__peso-eleitoral-bar pointer-events-none"
                            style={
                              {
                                '--td-peso-a': cor.fill,
                                width: `${Math.max(8, Math.round((r.eleitores / maxEleitoresTdResumo) * 100))}%`,
                              } as CSSProperties
                            }
                            aria-hidden
                          />
                          <div className="relative z-[1] flex min-w-0 items-center gap-1.5">
                            <span
                              className="h-2 w-2 shrink-0 rounded-sm sm:h-2.5 sm:w-2.5"
                              style={{ backgroundColor: cor.fill }}
                              aria-hidden
                            />
                            <span className="min-w-0 break-words font-medium text-text-primary" title={r.territorio}>
                              {r.territorio}
                            </span>
                          </div>
                        </td>
                        <td className="td-resumo-table__cell text-right tabular-nums text-text-secondary">
                          {r.municipios}
                        </td>
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
                              'td-resumo-table__cell td-resumo-table__cell--delta text-right tabular-nums',
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
                        {painelPlanilhaAtivo ? (
                          <td
                            className={cn(
                              'td-resumo-table__cell text-right tabular-nums text-text-secondary',
                              colunaInicioDesempenho === 'lid' && 'td-resumo-table__grupo-desempenho-start'
                            )}
                          >
                            {fmtInt.format(ag.liderancas)}
                          </td>
                        ) : null}
                        <td className="td-resumo-table__cell text-right tabular-nums text-text-secondary">
                          {painelPlanilhaAtivo && cenarioVotosExibicao
                            ? formatarPctExpectativaSobreEleitoresTd(ag, cenarioVotosExibicao, r.eleitores) ?? '—'
                            : '—'}
                        </td>
                        <td className="td-resumo-table__cell td-resumo-table__cell--classe td-resumo-table__grupo-status-start">
                          <div className="flex justify-end">
                            <ClassificacaoTdBadge tipo={classificacaoPorTd.get(r.territorio)} visualTone="command" />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {highlightedTd !== null && municipiosLinhasOrdenadas.length > 0 && (
                <div className="mt-3 pt-2">
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
                            'font-semibold uppercase tracking-wide text-text-muted',
                            sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs'
                          )}
                        >
                          Lideranças · {municipioFocadoLiderancas}
                        </p>
                      </div>
                      {resumoFed26VsFed22MunicipioDrill ? (
                        <p
                          className={cn(
                            'mb-2 flex flex-wrap items-baseline gap-x-1.5 tabular-nums leading-snug text-text-secondary',
                            sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
                          )}
                        >
                          <span
                            title={
                              cenarioVotosExibicao === 'anterior'
                                ? 'Soma da expectativa FED.26 (planilha) neste município'
                                : 'Soma da expectativa aferida (planilha) neste município'
                            }
                          >
                            {cenarioVotosExibicao === 'anterior' ? 'FED.26' : 'Afer.'}:{' '}
                            {fmtInt.format(resumoFed26VsFed22MunicipioDrill.vPlan)}
                          </span>
                          <span className="text-text-muted">·</span>
                          <span title="Jadyel — votos nominais Dep. Federal 2022 (TSE), neste município">
                            Fed.22: {fmtInt.format(resumoFed26VsFed22MunicipioDrill.v22)}
                          </span>
                          <span className="text-text-muted">·</span>
                          <span
                            className={
                              resumoFed26VsFed22MunicipioDrill.delta > 0
                                ? 'text-status-success'
                                : resumoFed26VsFed22MunicipioDrill.delta < 0
                                  ? 'text-status-danger'
                                  : 'text-text-secondary'
                            }
                            title="Diferença: visão de votos da planilha menos Fed. 2022 (mesmo critério da coluna Δ na lista de municípios)"
                          >
                            Δ: {formatarIntComSinal(resumoFed26VsFed22MunicipioDrill.delta)}
                          </span>
                        </p>
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
                              'mb-1.5 grid min-h-[1.25rem] items-baseline gap-x-2 border-b border-border-card/20 pb-1 font-semibold uppercase tracking-wide text-text-muted',
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
                                    'grid min-h-[1.55rem] items-baseline gap-x-2 pb-0.5 leading-tight text-text-secondary',
                                    sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
                                  )}
                                  style={{ gridTemplateColumns: gridTemplateListaLiderancasDrillSemExpectativa }}
                                >
                                  <span className="min-w-0 break-words font-medium text-text-primary">
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
                              'mt-2 tabular-nums text-text-muted',
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
                              'mb-1.5 grid min-h-[1.25rem] items-baseline gap-x-2 border-b border-border-card/20 pb-1 font-semibold uppercase tracking-wide text-text-muted',
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
                                    'grid min-h-[1.55rem] items-baseline gap-x-2 pb-0.5 leading-tight text-text-secondary',
                                    sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
                                  )}
                                  style={{ gridTemplateColumns: gridTemplateListaLiderancasDrillComExpectativa }}
                                >
                                  <span className="min-w-0 break-words font-medium text-text-primary">
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
                              'mt-2 tabular-nums text-text-muted',
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
                            'font-semibold uppercase tracking-wide text-text-muted',
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
                          'mb-1.5 grid min-h-[1.25rem] items-baseline gap-x-2 border-b border-border-card/20 pb-1 font-semibold uppercase tracking-wide text-text-muted',
                          sidebarCollapsed ? 'text-[11px] sm:text-xs' : 'text-[9px] sm:text-[10px]'
                        )}
                        style={{ gridTemplateColumns: gridTemplateListaMunicipiosPainelTd }}
                      >
                        <span className="min-w-0 text-left" title="Município">
                          Município
                        </span>
                        <span className="text-right tabular-nums" title="Eleitorado do município (base interna)">
                          Eleit.
                        </span>
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
                        {painelPlanilhaAtivo ? (
                          <>
                            <span className="text-right tabular-nums">Lid.</span>
                            {cenarioVotosExibicao ? (
                              <span className="text-right tabular-nums">
                                {cenarioVotosExibicao === 'anterior' ? 'FED.26' : 'Afer.'}
                              </span>
                            ) : null}
                          </>
                        ) : null}
                        {temDadosFed22 ? (
                          <span className="text-right tabular-nums" title="Jadyel — Dep. Federal 2022">
                            Fed.22
                          </span>
                        ) : null}
                        {mostrarColunaDeltaFed22 ? (
                          <span className="text-right tabular-nums" title="Visão planilha − Fed. 2022">
                            Δ
                          </span>
                        ) : null}
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
                                'grid min-h-[1.55rem] items-baseline gap-x-2 pb-0.5 leading-tight text-text-secondary',
                                sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]',
                                cidadeDestacadaPainel && 'rounded-sm bg-accent-gold-soft/25 ring-1 ring-accent-gold/50',
                                podeDrillCidade &&
                                  'cursor-pointer outline-none hover:bg-card/40 focus-visible:ring-2 focus-visible:ring-accent-gold-soft'
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
                              <span className="min-w-0 break-words font-medium text-text-primary" title={nome}>
                                {nome}
                              </span>
                              <span
                                className="text-right tabular-nums text-text-secondary"
                                title="Eleitorado (base interna)"
                              >
                                {eleitores != null ? fmtInt.format(eleitores) : '—'}
                              </span>
                              <span className="border-l border-border-card/35 pl-2 text-right tabular-nums text-text-secondary sm:pl-3">
                                {painelPlanilhaAtivo && cenarioVotosExibicao
                                  ? formatarPctVotosSobreEleitores(
                                      valorVotosCidade(muniMetrica, cenarioVotosExibicao),
                                      eleitores ?? 0
                                    ) ?? '—'
                                  : '—'}
                              </span>
                              {painelPlanilhaAtivo ? (
                                <>
                                  <span
                                    className="text-right tabular-nums font-medium text-text-primary"
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
                              {temDadosFed22 ? (
                                <span
                                  className="text-right tabular-nums text-text-secondary"
                                  title="Jadyel — Dep. Federal 2022"
                                >
                                  {fmtInt.format(v22Mun)}
                                </span>
                              ) : null}
                              {deltaMun !== null ? (
                                <span
                                  className={`text-right tabular-nums ${
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
                            </div>
                          )
                        })}
                      </div>
                      <p
                        className={cn(
                          'mt-2 tabular-nums text-text-muted',
                          sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
                        )}
                      >
                        {painelPlanilhaAtivo
                          ? `Lideranças no TD: ${fmtInt.format(somaLiderancasListaTd)}${
                              cenarioVotosExibicao
                                ? ` · ${cenarioVotosExibicao === 'anterior' ? 'FED.26' : 'Aferido'}: ${fmtInt.format(Math.round(somaVotosListaTd))}`
                                : ''
                            }`
                          : `Soma eleitores (lista): ${fmtInt.format(somaEleitoresListaTd)}`}
                        {temDadosFed22 && highlightedTd !== null
                          ? ` · Fed.22 (TD): ${fmtInt.format(somaFed22ListaTd)}`
                          : ''}
                        {mostrarColunaDeltaFed22
                          ? ` · Δ: ${formatarIntComSinal(Math.round(somaVotosListaTd - somaFed22ListaTd))}`
                          : ''}
                      </p>
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
            {!highlightedTd && (
              <div
                className={cn(
                  'mt-2 space-y-1 leading-snug',
                  sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-xs'
                )}
              >
                <div>
                  <span className="font-semibold text-text-primary">Total estadual</span>
                  <span className="ml-1 tabular-nums text-text-secondary">
                    {fmtInt.format(totaisResumo.municipios)} mun. · {fmtInt.format(totaisResumo.eleitores)} eleitores
                  </span>
                </div>
                {painelPlanilhaAtivo ? (
                  <div className="tabular-nums text-text-secondary">
                    <span className="font-semibold text-text-primary">Planilha (PI)</span>
                    <span className="ml-1">
                      Lideranças: {fmtInt.format(totaisPlanilhaTd.liderancas)}
                      {cenarioVotosExibicao ? (
                        <>
                          {' '}
                          · {cenarioVotosExibicao === 'anterior' ? 'FED.26' : 'Aferido'}:{' '}
                          {fmtInt.format(Math.round(valorVotosAgregadoTd(totaisPlanilhaTd, cenarioVotosExibicao)))}
                        </>
                      ) : null}
                      {deltaPlanilhaVsFed22Estado != null ? (
                        <>
                          {' '}
                          · Δ vs Fed.22: {formatarIntComSinal(deltaPlanilhaVsFed22Estado)}
                        </>
                      ) : null}
                    </span>
                  </div>
                ) : null}
                {temDadosFed22 ? (
                  <div className="tabular-nums text-text-secondary">
                    <span className="font-semibold text-text-primary">Fed. 2022 (Jadyel, PI)</span>
                    <span className="ml-1">{fmtInt.format(totalFed22Pi)} votos nominais</span>
                  </div>
                ) : null}
              </div>
            )}
          </aside>
        </div>
      )}
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
