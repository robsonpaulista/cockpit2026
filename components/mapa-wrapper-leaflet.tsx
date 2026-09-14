'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { APP_FONT_STACK_CSS } from '@/lib/app-font-stack'
import type { IptIndicador, IptMunicipio } from '@/lib/ipt'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { buildIptMunicipiosComTooltipAutomatico, iptMarkerSize } from '@/lib/ipt'
import { iptZoomLevel } from '@/lib/ipt-chip'
import { IPT_MAP_VIEW_PI, iptLatLngPointsFromMunicipios } from '@/lib/ipt-td'
import { createIptMarkerHtml, createIptPopupHtml, createIptTooltipBasicoHtml } from '@/lib/ipt-popup'
import { createIptPesquisaFullscreenChipHtml } from '@/lib/ipt-chip'
import { hydrateIptPopupInsights } from '@/lib/ipt-popup-insights'
import { getLeafletBasemapLayerOptions } from '@/lib/leaflet-basemap'

// ========== Types ==========
interface Municipio {
  nome: string
  lat: number
  lng: number
}

interface TerritorioInfo {
  cidade: string
  motivo: string
  expectativaVotos?: number
  visitas?: number
  /** Briefing territorial (War Room) */
  ultimaVisitaRelativa?: string
  deltaVisitas?: number | null
  regiaoLabel?: string
  coberturaLabel?: string
  /** Próxima visita agendada (War Room) */
  proximaAgendaLabel?: string
}

export interface MapStats {
  totalCidades: number
  cidadesComPresenca: number
  cidadesVisitadas: number
  cidadesSemPresenca: number
  oportunidades: number
  eleitoradoTotal: number
  eleitoradoCoberto: number
  percentualCobertura: number
  regioes: Array<{
    nome: string
    centroLat: number
    centroLng: number
    totalCidades: number
    cidadesComPresenca: number
    percentual: number
    classificacao: 'forte' | 'medio' | 'fraco' | 'critico'
    eleitoradoSemCobertura: number
  }>
  insightPrincipal: string
}

type MapAppearance = 'light' | 'dark'

/** Paleta institucional War Room (amarelo / preto / cinza). */
export type MapMarkerTheme = 'default' | 'war-room'

interface MapWrapperProps {
  cidadesComPresenca: string[]
  cidadesVisitadas?: string[]
  municipiosPiaui: Municipio[]
  eleitoresPorCidade?: Record<string, number>
  territoriosQuentes?: TerritorioInfo[]
  territoriosMornos?: TerritorioInfo[]
  territoriosFrios?: TerritorioInfo[]
  filtroAtivo?: string
  onStatsCalculated?: (stats: MapStats) => void
  /** Alinha tiles, popups e marcadores ao tema claro/escuro do app */
  appearance?: MapAppearance
  /** Rótulos de região (Norte, Centro-Norte…) no mapa */
  showRegionLabels?: boolean
  /** Marcadores menores para cards embutidos */
  compactMarkers?: boolean
  /** Cores dos pins: default (azul/vermelho) ou war-room (amarelo/preto/cinza) */
  markerTheme?: MapMarkerTheme
  /** Rótulo da expectativa no popup (ex.: Meta) */
  expectativaLabel?: string
  /** Modo IPT: um marcador por município com score 0–100 */
  iptMunicipios?: IptMunicipio[]
  /** Lente do mapa IPT: recolore pins pelo sinal do indicador escolhido */
  iptIndicadorFiltro?: IptIndicador | null
  /** Filtro de evolução IPT — quando ≠ todos, pins/chips usam cor da evolução */
  iptEvolucaoFiltro?: import('@/lib/ipt-evolucao').IptEvolucaoFiltro
  /** TD ativo — dispara zoom automático no mapa IPT */
  iptFiltroTd?: TerritorioDesenvolvimentoPI | null
  /** Municípios do TD (sem filtro de prioridade) — base do enquadramento */
  iptMunicipiosBounds?: IptMunicipio[]
  /** Modo missões do Diagnóstico Operacional — pins na cor da missão + multi-missão */
  iptMissaoFiltro?: import('@/lib/ipt-missoes').IptMissaoFiltro | null
  /** Tela cheia do Mapa Estratégico — habilita labels extras (ex.: Missão Pesquisa) */
  iptFullscreen?: boolean
  /** Recarrega IPT após salvar insight no popup */
  onIptInsightSaved?: () => void
  /** Município selecionado no mapa IPT (abre perfil demográfico) */
  onIptMunicipioSelect?: (municipio: string) => void
  /** Duplo clique no mapa IPT: aplica/limpa filtro de município na página */
  onIptMunicipioToggleFiltro?: (municipio: string) => void
}

// ========== Constants ==========
const OPPORTUNITY_THRESHOLD = 15000
const EMPTY_STRING_ARRAY: string[] = []
const EMPTY_TERRITORIO_ARRAY: TerritorioInfo[] = []
const EMPTY_ELEITORES: Record<string, number> = {}
const EMPTY_IPT_BOUNDS: IptMunicipio[] = []

/** War Room clean — amarelo logo / preto / cinza. */
const WR_MARKER = {
  yellow: '#f2d06b',
  yellowBorder: '#d4b45a',
  black: '#2b2d31',
  blackBorder: '#20201f',
  gray: '#686865',
  grayMid: '#969692',
  graySoft: 'rgba(104,104,101,0.55)',
  graySoftBorder: 'rgba(104,104,101,0.75)',
  grayMidSoft: 'rgba(150,150,146,0.7)',
  grayMidBorder: 'rgba(104,104,101,0.85)',
  grayStrong: 'rgba(43,45,49,0.85)',
  grayStrongBorder: 'rgba(32,32,31,0.9)',
} as const

// ========== Helper Functions ==========
function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

/** Evita crash Leaflet `_leaflet_pos` / `classList` ao remover mapa no meio de pan/zoom. */
function safeRemoveLeafletMap(map: L.Map | null | undefined): void {
  if (!map) return
  try {
    map.stop()
  } catch {
    // ignore
  }
  try {
    // Cancela viscosidade/limites que ainda podem disparar pan residual
    map.setMaxBounds(null as unknown as L.LatLngBounds)
  } catch {
    // ignore
  }
  try {
    map.off()
  } catch {
    // ignore
  }
  try {
    map.remove()
  } catch {
    // ignore
  }
}

function isLeafletMapUsable(map: L.Map | null | undefined): map is L.Map {
  if (!map) return false
  try {
    const container = map.getContainer()
    return Boolean(container?.isConnected && (map as L.Map & { _loaded?: boolean })._loaded)
  } catch {
    return false
  }
}

/** War Room: mantém o popup dentro da área visível (HUD + maxBounds do PI). */
function attachWarRoomPopupKeepInView(map: L.Map, marker: L.Marker): void {
  let restoreTimer: number | null = null
  let savedBounds: L.LatLngBounds | null = null
  let savedViscosity: number | undefined

  const clearRestoreTimer = () => {
    if (restoreTimer != null) {
      window.clearTimeout(restoreTimer)
      restoreTimer = null
    }
  }

  const restoreBounds = () => {
    clearRestoreTimer()
    if (!isLeafletMapUsable(map)) return
    try {
      if (savedBounds) map.setMaxBounds(savedBounds)
      if (savedViscosity != null) map.options.maxBoundsViscosity = savedViscosity
    } catch {
      // ignore
    }
    savedBounds = null
    savedViscosity = undefined
  }

  marker.on('popupopen', () => {
    clearRestoreTimer()
    const popup = marker.getPopup()
    if (!popup || !isLeafletMapUsable(map)) return

    popup.options.offset = L.point(0, 7)
    popup.getElement()?.classList.remove('mapa-wr-popup--below')

    try {
      const mb = map.options.maxBounds
      if (mb instanceof L.LatLngBounds) {
        savedBounds = L.latLngBounds(mb.getSouthWest(), mb.getNorthEast())
      } else if (mb) {
        savedBounds = L.latLngBounds(mb as [L.LatLngExpression, L.LatLngExpression])
      } else {
        savedBounds = null
      }
      savedViscosity = map.options.maxBoundsViscosity
      // Afrouxa só o suficiente para o auto-pan / panInside caber o card
      if (savedBounds) map.setMaxBounds(savedBounds.pad(0.35))
      map.options.maxBoundsViscosity = 0.2
    } catch {
      // ignore
    }

    const fit = () => {
      if (!isLeafletMapUsable(map)) return
      const el = popup.getElement()
      if (!el) return

      const h = Math.max(el.offsetHeight, 120)
      const w = Math.max(el.offsetWidth, 196)
      try {
        map.panInside(marker.getLatLng(), {
          paddingTopLeft: L.point(Math.round(w / 2) + 20, h + 64),
          paddingBottomRight: L.point(Math.round(w / 2) + 20, 28),
          animate: true,
          duration: 0.22,
        })
      } catch {
        // ignore
      }

      window.setTimeout(() => {
        if (!isLeafletMapUsable(map)) return
        const popupEl = popup.getElement()
        if (!popupEl) return
        const mapRect = map.getContainer().getBoundingClientRect()
        const popupRect = popupEl.getBoundingClientRect()
        const padTop = 56
        const pad = 10

        // Ainda cortado no topo (canto extremo) → abre abaixo do pin
        if (popupRect.top < mapRect.top + padTop - 2) {
          const height = popupEl.offsetHeight
          popup.options.offset = L.point(0, height + 20)
          popupEl.classList.add('mapa-wr-popup--below')
          try {
            popup.update()
          } catch {
            // ignore
          }
          window.setTimeout(() => {
            if (!isLeafletMapUsable(map)) return
            try {
              map.panInside(marker.getLatLng(), {
                paddingTopLeft: L.point(24, 56),
                paddingBottomRight: L.point(24, height + 28),
                animate: true,
                duration: 0.18,
              })
            } catch {
              // ignore
            }
          }, 30)
          return
        }

        let panX = 0
        let panY = 0
        if (popupRect.left < mapRect.left + pad) panX = popupRect.left - (mapRect.left + pad)
        if (popupRect.right > mapRect.right - pad) panX = popupRect.right - (mapRect.right - pad)
        if (popupRect.bottom > mapRect.bottom - pad) panY = popupRect.bottom - (mapRect.bottom - pad)
        if (panX !== 0 || panY !== 0) {
          try {
            map.panBy([panX, panY], { animate: true, duration: 0.15 })
          } catch {
            // ignore
          }
        }
      }, 240)
    }

    requestAnimationFrame(() => requestAnimationFrame(fit))
  })

  marker.on('popupclose', () => {
    const popup = marker.getPopup()
    popup?.getElement()?.classList.remove('mapa-wr-popup--below')
    if (popup) popup.options.offset = L.point(0, 7)
    restoreTimer = window.setTimeout(restoreBounds, 280)
  })
}

function safeIptFitView(map: L.Map, pts: Array<[number, number]>): void {
  if (!isLeafletMapUsable(map)) return
  try {
    map.stop()
    if (pts.length === 0) {
      map.setView(IPT_MAP_VIEW_PI.center, IPT_MAP_VIEW_PI.zoom, { animate: false })
      return
    }
    if (pts.length === 1) {
      map.setView(pts[0], 10, { animate: false })
      return
    }
    map.fitBounds(L.latLngBounds(pts), {
      padding: [48, 48],
      maxZoom: 10,
      animate: false,
    })
  } catch {
    // mapa destruído / transição inválida
  }
}

function getMarkerSize(eleitorado: number, compact = false): number {
  if (compact) {
    if (eleitorado >= 100000) return 11
    if (eleitorado >= 50000) return 9
    if (eleitorado >= 20000) return 8
    if (eleitorado >= 10000) return 7
    if (eleitorado >= 5000) return 6
    return 4
  }
  if (eleitorado >= 100000) return 18
  if (eleitorado >= 50000) return 15
  if (eleitorado >= 20000) return 12
  if (eleitorado >= 10000) return 10
  if (eleitorado >= 5000) return 8
  return 5
}

function getRegionName(lat: number): string {
  if (lat > -4.8) return 'Norte'
  if (lat > -6.5) return 'Centro-Norte'
  if (lat > -8.5) return 'Centro-Sul'
  return 'Sul'
}

function findEleitorado(nomeCidade: string, eleitoresPorCidade: Record<string, number>): number {
  const normalized = normalizeName(nomeCidade)
  for (const [key, value] of Object.entries(eleitoresPorCidade)) {
    if (normalizeName(key) === normalized) return value
  }
  for (const [key, value] of Object.entries(eleitoresPorCidade)) {
    const keyNorm = normalizeName(key)
    if (keyNorm.includes(normalized) || normalized.includes(keyNorm)) return value
  }
  return 0
}

/** Ícones SVG premium (traço fino) para popups Leaflet — sem emoji. */
function popupSvgIcon(
  paths: string,
  color: string,
  size = 14,
): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
}

const POPUP_ICON = {
  mapPin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  spark: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
} as const

function popupIconWell(svg: string, bg: string): string {
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:${bg};flex-shrink:0;">${svg}</span>`
}

function popupMetricRow(opts: {
  icon: string
  iconBg: string
  label: string
  value: string
  valueColor: string
  labelColor: string
  border: string
  last?: boolean
  compact?: boolean
}): string {
  const border = opts.last ? 'none' : `1px solid ${opts.border}`
  if (opts.compact) {
    return `<div style="display:flex;align-items:center;gap:7px;padding:4px 0;border-bottom:${border};">
    <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:${opts.iconBg};flex-shrink:0;">${opts.icon}</span>
    <span style="flex:1;min-width:0;font-size:10px;font-weight:500;letter-spacing:0.01em;color:${opts.labelColor};">${opts.label}</span>
    <span style="font-size:11px;font-weight:650;letter-spacing:-0.01em;color:${opts.valueColor};font-variant-numeric:tabular-nums;text-align:right;max-width:48%;">${opts.value}</span>
  </div>`
  }
  return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:${border};">
    ${popupIconWell(opts.icon, opts.iconBg)}
    <span style="flex:1;min-width:0;font-size:11px;font-weight:500;letter-spacing:0.02em;color:${opts.labelColor};">${opts.label}</span>
    <span style="font-size:13px;font-weight:650;letter-spacing:-0.01em;color:${opts.valueColor};font-variant-numeric:tabular-nums;">${opts.value}</span>
  </div>`
}

// ========== Tooltip HTML Generator ==========
function createTooltipHTML(
  appearance: MapAppearance,
  config: {
    nome: string
    tipo: 'visitada' | 'com-presenca' | 'sem-presenca' | 'oportunidade'
    eleitorado: number
    classificacao?: string | null
    motivo?: string | null
    expectativaVotos?: number
    visitas?: number
    ultimaVisitaRelativa?: string | null
    deltaVisitas?: number | null
    regiaoLabel?: string | null
    coberturaLabel?: string | null
    proximaAgendaLabel?: string | null
  },
  options?: { markerTheme?: MapMarkerTheme; expectativaLabel?: string },
): string {
  const { nome, tipo, eleitorado, classificacao, motivo, expectativaVotos, visitas } = config
  const isDark = appearance === 'dark'
  const isWarRoom = options?.markerTheme === 'war-room'
  const metaLabel = options?.expectativaLabel ?? (isWarRoom ? 'Meta' : 'Exp. Votos')

  if (isWarRoom) {
    return createWarRoomTooltipHTML({
      nome,
      tipo,
      eleitorado,
      motivo,
      expectativaVotos,
      visitas,
      metaLabel,
      ultimaVisitaRelativa: config.ultimaVisitaRelativa,
      deltaVisitas: config.deltaVisitas,
      regiaoLabel: config.regiaoLabel,
      coberturaLabel: config.coberturaLabel,
      proximaAgendaLabel: config.proximaAgendaLabel,
    })
  }

  const statusMap: Record<string, { text: string; color: string; headerBg: string }> = isDark
    ? {
        visitada: { text: 'Visitada', color: '#5eead4', headerBg: '#0f766e' },
        'com-presenca': { text: 'Com liderança', color: '#99f6e4', headerBg: '#115e59' },
        'sem-presenca': { text: 'Sem liderança', color: '#fca5a5', headerBg: '#991b1b' },
        oportunidade: { text: 'Oportunidade', color: '#fcd34d', headerBg: '#92400e' },
      }
    : {
        visitada: { text: 'Visitada', color: '#2563EB', headerBg: '#1D4ED8' },
        'com-presenca': { text: 'Com liderança', color: '#2563EB', headerBg: '#2563EB' },
        'sem-presenca': { text: 'Sem liderança', color: '#DC2626', headerBg: '#DC2626' },
        oportunidade: { text: 'Oportunidade', color: '#D97706', headerBg: '#B45309' },
      }
  const s = statusMap[tipo]
  const ink = '#ffffff'
  const rowBorder = isDark ? '#334155' : '#F3F4F6'
  const muted = isDark ? '#94a3b8' : '#6B7280'
  const strong = isDark ? '#f1f5f9' : '#1F2937'
  const bodyBg = isDark ? '#0f172a' : 'white'
  const motivoBoxBg = isDark ? 'rgba(30,41,59,0.95)' : '#F9FAFB'
  const motivoBoxFg = isDark ? '#cbd5e1' : '#4B5563'
  const oportBoxBg = isDark ? 'rgba(120,53,15,0.45)' : '#FEF3C7'
  const oportBoxFg = isDark ? '#fde68a' : '#92400E'
  const iconTone = isDark ? '#e2e8f0' : '#374151'
  const wellBg = isDark ? 'rgba(148,163,184,0.12)' : '#F3F4F6'

  let classificacaoBadge = ''
  if (classificacao) {
    const badges: Record<string, { bg: string; label: string }> = {
      quente: { bg: '#059669', label: 'Quente' },
      morno: { bg: '#D97706', label: 'Morno' },
      frio: { bg: '#DC2626', label: 'Frio' },
    }
    const b = badges[classificacao]
    if (b) {
      classificacaoBadge = `<span style="display:inline-block;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:600;color:white;background:${b.bg};letter-spacing:0.02em;">${b.label}</span>`
    }
  }

  const statusIcon =
    tipo === 'visitada'
      ? POPUP_ICON.check
      : tipo === 'oportunidade'
        ? POPUP_ICON.spark
        : tipo === 'sem-presenca'
          ? POPUP_ICON.alert
          : POPUP_ICON.mapPin

  let rows = ''
  rows += popupMetricRow({
    icon: popupSvgIcon(statusIcon, iconTone),
    iconBg: wellBg,
    label: 'Status',
    value: s.text,
    valueColor: s.color,
    labelColor: muted,
    border: rowBorder,
  })
  rows += popupMetricRow({
    icon: popupSvgIcon(POPUP_ICON.users, iconTone),
    iconBg: wellBg,
    label: 'Eleitores',
    value: eleitorado > 0 ? eleitorado.toLocaleString('pt-BR') : 'N/D',
    valueColor: strong,
    labelColor: muted,
    border: rowBorder,
    last: !(visitas && visitas > 0) && !(expectativaVotos && expectativaVotos > 0),
  })
  if (visitas && visitas > 0) {
    rows += popupMetricRow({
      icon: popupSvgIcon(POPUP_ICON.navigation, iconTone),
      iconBg: wellBg,
      label: 'Visitas',
      value: String(visitas),
      valueColor: strong,
      labelColor: muted,
      border: rowBorder,
      last: !(expectativaVotos && expectativaVotos > 0),
    })
  }
  if (expectativaVotos && expectativaVotos > 0) {
    rows += popupMetricRow({
      icon: popupSvgIcon(POPUP_ICON.target, iconTone),
      iconBg: wellBg,
      label: metaLabel,
      value: expectativaVotos.toLocaleString('pt-BR'),
      valueColor: strong,
      labelColor: muted,
      border: rowBorder,
      last: true,
    })
  }

  let extras = ''
  if (motivo) {
    extras += `<div style="margin-top:8px;padding:8px 10px;background:${motivoBoxBg};border-radius:8px;font-size:11px;color:${motivoBoxFg};line-height:1.45;display:flex;gap:8px;align-items:flex-start;">
      <span style="flex-shrink:0;margin-top:1px;">${popupSvgIcon(POPUP_ICON.info, motivoBoxFg, 13)}</span>
      <span>${motivo}</span>
    </div>`
  }
  if (tipo === 'oportunidade') {
    extras += `<div style="margin-top:8px;padding:8px 10px;background:${oportBoxBg};border-radius:8px;font-size:11px;color:${oportBoxFg};font-weight:600;text-align:center;letter-spacing:0.01em;">Alto potencial de crescimento</div>`
  }

  return `<div style="font-family:${APP_FONT_STACK_CSS};min-width:232px;max-width:288px;">
    <div style="background:${s.headerBg};padding:12px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <strong style="color:${ink};font-size:14px;font-weight:650;letter-spacing:-0.01em;">${nome}</strong>
      ${classificacaoBadge}
    </div>
    <div style="padding:4px 14px 12px;background:${bodyBg};">
      ${rows}
      ${extras}
    </div>
  </div>`
}

/** Popup War Room — compacto (amarelo / preto / cinza). */
function createWarRoomTooltipHTML(config: {
  nome: string
  tipo: 'visitada' | 'com-presenca' | 'sem-presenca' | 'oportunidade'
  eleitorado: number
  motivo?: string | null
  expectativaVotos?: number
  visitas?: number
  metaLabel: string
  ultimaVisitaRelativa?: string | null
  deltaVisitas?: number | null
  regiaoLabel?: string | null
  coberturaLabel?: string | null
  proximaAgendaLabel?: string | null
}): string {
  const {
    nome,
    tipo,
    eleitorado,
    motivo,
    expectativaVotos,
    visitas,
    metaLabel,
    ultimaVisitaRelativa,
    deltaVisitas,
    regiaoLabel,
    coberturaLabel,
    proximaAgendaLabel,
  } = config
  const ink = WR_MARKER.black
  const muted = WR_MARKER.gray
  const soft = '#f3f3f1'
  const border = 'rgba(43,45,49,0.08)'
  const yellow = WR_MARKER.yellow
  const yellowSoft = 'rgba(242,208,107,0.35)'

  const statusMeta: Record<
    string,
    { label: string; pillBg: string; pillFg: string; icon: string }
  > = {
    visitada: {
      label: coberturaLabel || 'Visitada',
      pillBg: yellow,
      pillFg: ink,
      icon: POPUP_ICON.check,
    },
    'com-presenca': {
      label: coberturaLabel || 'Com meta',
      pillBg: yellow,
      pillFg: ink,
      icon: POPUP_ICON.target,
    },
    'sem-presenca': {
      label: 'Sem meta',
      pillBg: WR_MARKER.gray,
      pillFg: '#fff',
      icon: POPUP_ICON.alert,
    },
    oportunidade: {
      label: 'Oportunidade',
      pillBg: ink,
      pillFg: yellow,
      icon: POPUP_ICON.spark,
    },
  }
  const st = statusMeta[tipo]

  const hasVisitas = !!(visitas && visitas > 0)
  const hasMeta = !!(expectativaVotos && expectativaVotos > 0)
  const hasUltima = !!(ultimaVisitaRelativa && ultimaVisitaRelativa.trim())
  const hasDelta = deltaVisitas != null && deltaVisitas !== 0
  const hasAgenda = !!(proximaAgendaLabel && proximaAgendaLabel.trim())

  const row = (opts: Omit<Parameters<typeof popupMetricRow>[0], 'compact' | 'border'> & { last?: boolean }) =>
    popupMetricRow({ ...opts, border, compact: true })

  let rows = ''
  if (hasAgenda) {
    rows += row({
      icon: popupSvgIcon(POPUP_ICON.calendar, ink, 11),
      iconBg: yellowSoft,
      label: 'Próxima visita',
      value: proximaAgendaLabel!,
      valueColor: ink,
      labelColor: muted,
    })
  }
  if (hasUltima) {
    rows += row({
      icon: popupSvgIcon(POPUP_ICON.navigation, ink, 11),
      iconBg: yellowSoft,
      label: 'Última visita',
      value: ultimaVisitaRelativa!,
      valueColor: ink,
      labelColor: muted,
    })
  }
  if (hasVisitas) {
    rows += row({
      icon: popupSvgIcon(POPUP_ICON.check, ink, 11),
      iconBg: soft,
      label: 'Visitas',
      value: String(visitas),
      valueColor: ink,
      labelColor: muted,
    })
  }
  if (hasDelta) {
    const sign = deltaVisitas! > 0 ? '↑ +' : '↓ '
    rows += row({
      icon: popupSvgIcon(POPUP_ICON.spark, ink, 11),
      iconBg: soft,
      label: 'vs. anterior',
      value: `${sign}${Math.abs(deltaVisitas!)}`,
      valueColor: ink,
      labelColor: muted,
    })
  }
  if (hasMeta) {
    rows += row({
      icon: popupSvgIcon(POPUP_ICON.target, ink, 11),
      iconBg: yellowSoft,
      label: metaLabel,
      value: expectativaVotos!.toLocaleString('pt-BR'),
      valueColor: ink,
      labelColor: muted,
    })
  }
  rows += row({
    icon: popupSvgIcon(POPUP_ICON.users, ink, 11),
    iconBg: soft,
    label: 'Eleitores',
    value: eleitorado > 0 ? eleitorado.toLocaleString('pt-BR') : 'N/D',
    valueColor: ink,
    labelColor: muted,
    last: true,
  })

  let extras = ''
  if (motivo && !hasUltima && !hasVisitas) {
    extras += `<div style="margin-top:6px;padding:6px 8px;background:${soft};border-radius:7px;border:1px solid ${border};font-size:10px;color:${muted};line-height:1.35;display:flex;gap:6px;align-items:flex-start;">
      <span style="flex-shrink:0;margin-top:1px;">${popupSvgIcon(POPUP_ICON.info, muted, 11)}</span>
      <span style="color:${ink};">${motivo}</span>
    </div>`
  }
  if (tipo === 'oportunidade') {
    extras += `<div style="margin-top:6px;padding:6px 8px;background:${ink};border-radius:7px;font-size:10px;font-weight:650;color:${yellow};text-align:center;">Alto potencial</div>`
  }

  return `<div class="mapa-wr-popup" style="font-family:${APP_FONT_STACK_CSS};min-width:196px;max-width:232px;background:#fff;">
    <div style="height:2px;background:${yellow};"></div>
    <div style="padding:8px 28px 6px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
      <div style="min-width:0;">
        <p style="margin:0;font-size:9px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${muted};line-height:1.2;">${regiaoLabel || 'Município'}</p>
        <strong style="display:block;margin-top:1px;color:${ink};font-size:13px;font-weight:700;letter-spacing:-0.02em;line-height:1.15;">${nome}</strong>
      </div>
      <span style="flex-shrink:0;display:inline-flex;align-items:center;gap:3px;padding:3px 7px;border-radius:999px;background:${st.pillBg};color:${st.pillFg};font-size:9px;font-weight:700;letter-spacing:0.01em;max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${popupSvgIcon(st.icon, st.pillFg, 10)}
        ${st.label}
      </span>
    </div>
    <div style="padding:0 10px 8px;">
      ${rows}
      ${extras}
    </div>
  </div>`
}

// ========== CSS Styles ==========
function getMapLeafletStyles(appearance: MapAppearance): string {
  const darkChrome = `
  .mapa-leaflet-host--dark .leaflet-container {
    background: #0f1419 !important;
  }
  .mapa-leaflet-host--dark .leaflet-popup-content-wrapper {
    background: #0f172a !important;
    box-shadow: 0 12px 40px rgba(0,0,0,0.55) !important;
    border: 1px solid rgba(148,163,184,0.25) !important;
  }
  .mapa-leaflet-host--dark .leaflet-popup-tip {
    background: #0f172a !important;
    box-shadow: 0 3px 14px rgba(0,0,0,0.45) !important;
  }
  .mapa-leaflet-host--dark .leaflet-control-zoom a {
    background: #1e293b !important;
    color: #e2e8f0 !important;
    border-color: #334155 !important;
  }
  .mapa-leaflet-host--dark .leaflet-control-zoom a:hover {
    background: #334155 !important;
    color: #f8fafc !important;
  }
  .mapa-leaflet-host--dark .mapa-zone-label {
    background: rgba(22, 34, 44, 0.92) !important;
    border: 1px solid rgba(45, 212, 191, 0.22) !important;
    box-shadow: 0 4px 20px rgba(0,0,0,0.35) !important;
  }
  .mapa-leaflet-host--dark .mapa-zone-name {
    color: #e2e8f0 !important;
  }
  .mapa-leaflet-host--dark .mapa-zone-forte { color: #34d399 !important; }
  .mapa-leaflet-host--dark .mapa-zone-medio { color: #fbbf24 !important; }
  .mapa-leaflet-host--dark .mapa-zone-fraco { color: #fb923c !important; }
  .mapa-leaflet-host--dark .mapa-zone-critico { color: #f87171 !important; }
`

  const base = `
  .leaflet-popup-content-wrapper {
    border-radius: 14px !important;
    padding: 0 !important;
    overflow: hidden;
    box-shadow: 0 14px 40px rgba(43,45,49,0.16), 0 2px 8px rgba(43,45,49,0.06) !important;
    border: 1px solid rgba(43,45,49,0.06);
  }
  .leaflet-popup-content {
    margin: 0 !important;
    line-height: 1.4 !important;
  }
  .leaflet-popup-tip {
    box-shadow: 0 3px 10px rgba(0,0,0,0.1) !important;
  }
  .mapa-leaflet-host--wr .leaflet-container {
    background: #ffffff !important;
  }
  .mapa-leaflet-host--wr .leaflet-popup-content-wrapper {
    border-radius: 10px !important;
    border: 1px solid rgba(43,45,49,0.08) !important;
    box-shadow: 0 10px 28px rgba(43,45,49,0.14), 0 1px 4px rgba(43,45,49,0.05) !important;
  }
  .mapa-leaflet-host--wr .leaflet-popup-content {
    margin: 0 !important;
    line-height: 1.25 !important;
  }
  .mapa-leaflet-host--wr .leaflet-popup-tip {
    background: #fff !important;
  }
  .mapa-leaflet-host--wr .leaflet-popup-close-button {
    top: 6px !important;
    right: 6px !important;
    width: 18px !important;
    height: 18px !important;
    padding: 0 !important;
    border-radius: 5px !important;
    color: #686865 !important;
    font-size: 14px !important;
    font-weight: 400 !important;
    line-height: 16px !important;
    background: #f3f3f1 !important;
  }
  .mapa-leaflet-host--wr .leaflet-popup-close-button:hover {
    color: #2b2d31 !important;
    background: #f2d06b !important;
  }
  /* Popup abaixo do pin (cidades no topo do mapa) */
  .mapa-leaflet-host--wr .leaflet-popup.mapa-wr-popup--below .leaflet-popup-tip-container {
    top: 0;
    bottom: auto;
    margin-top: -10px;
    transform: scaleY(-1);
  }
  .mapa-leaflet-host--wr .leaflet-popup.mapa-wr-popup--below .leaflet-popup-content-wrapper {
    margin-top: 10px;
  }
  /* Chip permanente de próxima visita agendada */
  .mapa-leaflet-host--wr .mapa-wr-agenda-tooltip {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .mapa-leaflet-host--wr .mapa-wr-agenda-tooltip::before {
    display: none !important;
  }
  .mapa-wr-agenda-chip {
    display: inline-flex;
    align-items: center;
    max-width: 32px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: ${APP_FONT_STACK_CSS};
    font-size: 6px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
    color: #2b2d31;
    background: #f2d06b;
    border: 0;
    border-radius: 2px;
    padding: 0 1.5px;
    box-shadow: 0 1px 1px rgba(43,45,49,0.08);
    pointer-events: none;
    transform: scale(0.92);
    transform-origin: center bottom;
  }

  @keyframes mapa-marker-enter {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  @keyframes mapa-pulse-ring {
    0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
    100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
  }

  @keyframes mapa-pulse-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); }
    50% { box-shadow: 0 0 14px 5px rgba(245, 158, 11, 0.3); }
  }

  .mapa-marker-dot {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    z-index: 2;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
    animation: mapa-marker-enter 0.6s ease-out forwards;
    opacity: 0;
  }

  .mapa-marker-dot:hover {
    transform: translate(-50%, -50%) scale(1.5) !important;
    z-index: 100 !important;
    box-shadow: 0 0 12px rgba(0,0,0,0.3) !important;
  }

  .mapa-opportunity-dot {
    animation: mapa-marker-enter 0.6s ease-out forwards, mapa-pulse-glow 2s ease-in-out 0.8s infinite;
  }

  .mapa-pulse-ring {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: rgba(245, 158, 11, 0.25);
    animation: mapa-pulse-ring 2s ease-out 0.8s infinite;
    z-index: 1;
    pointer-events: none;
  }

  .mapa-zone-label {
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 10px;
    padding: 8px 12px;
    font-family: ${APP_FONT_STACK_CSS};
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    border: 1px solid rgba(0,0,0,0.06);
    text-align: center;
    pointer-events: none;
    white-space: nowrap;
  }
  .mapa-zone-name {
    font-size: 11px;
    font-weight: 700;
    color: #374151;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .mapa-zone-status {
    font-size: 10px;
    font-weight: 600;
    margin-top: 2px;
  }
  .mapa-zone-forte { color: #059669; }
  .mapa-zone-medio { color: #D97706; }
  .mapa-zone-fraco { color: #DC2626; }
  .mapa-zone-critico { color: #7C2D12; }
`
  return appearance === 'dark' ? base + darkChrome : base
}

// ========== Component ==========
export function MapWrapperLeaflet({
  cidadesComPresenca,
  cidadesVisitadas = EMPTY_STRING_ARRAY,
  municipiosPiaui,
  eleitoresPorCidade = EMPTY_ELEITORES,
  territoriosQuentes = EMPTY_TERRITORIO_ARRAY,
  territoriosMornos = EMPTY_TERRITORIO_ARRAY,
  territoriosFrios = EMPTY_TERRITORIO_ARRAY,
  filtroAtivo = 'todas',
  onStatsCalculated,
  appearance = 'light',
  showRegionLabels = true,
  compactMarkers = false,
  markerTheme = 'default',
  expectativaLabel,
  iptMunicipios,
  iptIndicadorFiltro = null,
  iptEvolucaoFiltro = 'todos',
  iptFiltroTd = null,
  iptMunicipiosBounds = EMPTY_IPT_BOUNDS,
  iptMissaoFiltro = null,
  iptFullscreen = false,
  onIptInsightSaved,
  onIptMunicipioSelect,
  onIptMunicipioToggleFiltro,
}: MapWrapperProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const layersRef = useRef<Record<string, L.LayerGroup>>({})
  const statsCalculatedRef = useRef(false)
  const onIptMunicipioSelectRef = useRef(onIptMunicipioSelect)
  const onIptMunicipioToggleFiltroRef = useRef(onIptMunicipioToggleFiltro)
  const onIptInsightSavedRef = useRef(onIptInsightSaved)
  onIptMunicipioSelectRef.current = onIptMunicipioSelect
  onIptMunicipioToggleFiltroRef.current = onIptMunicipioToggleFiltro
  onIptInsightSavedRef.current = onIptInsightSaved

  type ClassifEntry = {
    tipo: string
    motivo: string
    expectativaVotos?: number
    visitas?: number
    ultimaVisitaRelativa?: string
    deltaVisitas?: number | null
    regiaoLabel?: string
    coberturaLabel?: string
    proximaAgendaLabel?: string
  }

  // Build territory classification lookup
  const classificacaoMapRef = useRef(new Map<string, ClassifEntry>())

  useEffect(() => {
    const classMap = new Map<string, ClassifEntry>()
    const put = (t: TerritorioInfo, tipo: string) => {
      classMap.set(normalizeName(t.cidade), {
        tipo,
        motivo: t.motivo,
        expectativaVotos: t.expectativaVotos,
        visitas: t.visitas,
        ultimaVisitaRelativa: t.ultimaVisitaRelativa,
        deltaVisitas: t.deltaVisitas,
        regiaoLabel: t.regiaoLabel,
        coberturaLabel: t.coberturaLabel,
        proximaAgendaLabel: t.proximaAgendaLabel,
      })
    }
    territoriosQuentes.forEach((t) => put(t, 'quente'))
    territoriosMornos.forEach((t) => put(t, 'morno'))
    territoriosFrios.forEach((t) => put(t, 'frio'))
    classificacaoMapRef.current = classMap
  }, [territoriosQuentes, territoriosMornos, territoriosFrios])

  // ========== Map initialization ==========
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const isDark = appearance === 'dark'

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
      zoomSnap: markerTheme === 'war-room' ? 0.25 : 1,
    }).setView([-6.5, -43.0], 7)
    mapInstanceRef.current = map

    // Custom panes for z-ordering
    map.createPane('heatmapPane')
    const heatPane = map.getPane('heatmapPane')
    if (heatPane) { heatPane.style.zIndex = '250'; heatPane.style.pointerEvents = 'none' }

    // Máscara fora do PI (War Room): acima do heat, abaixo dos marcadores
    map.createPane('piMaskOutside')
    const maskPane = map.getPane('piMaskOutside')
    if (maskPane) {
      maskPane.style.zIndex = '350'
      maskPane.style.pointerEvents = 'none'
    }

    map.createPane('markersPane')
    const markersPane = map.getPane('markersPane')
    if (markersPane) markersPane.style.zIndex = '400'

    map.createPane('labelsPane')
    const labelsPane = map.getPane('labelsPane')
    if (labelsPane) { labelsPane.style.zIndex = '500'; labelsPane.style.pointerEvents = 'none' }

    const basemap = getLeafletBasemapLayerOptions(isDark ? 'dark' : 'light')
    L.tileLayer(basemap.url, basemap.options).addTo(map)

    // Normalize city name sets
    const cidadesPresencaNorm = new Set(cidadesComPresenca.map(c => normalizeName(c)))
    const cidadesVisitadasNorm = new Set(cidadesVisitadas.map(c => normalizeName(c)))

    // ========== Classify municipalities ==========
    interface CidadeClassificada {
      municipio: Municipio
      eleitorado: number
      tipo: 'visitada' | 'com-presenca' | 'sem-presenca' | 'oportunidade'
      classificacao: string | null
      motivo: string | null
      expectativaVotos?: number
      visitas?: number
      ultimaVisitaRelativa?: string
      deltaVisitas?: number | null
      regiaoLabel?: string
      coberturaLabel?: string
      proximaAgendaLabel?: string
    }

    const cidades: CidadeClassificada[] = []
    let eleitoradoTotal = 0
    let eleitoradoCoberto = 0
    let countPresenca = 0
    let countVisitadas = 0
    let countOportunidades = 0

    // Compute lat range for animation delays
    let minLat = Infinity
    let maxLat = -Infinity
    municipiosPiaui.forEach(m => {
      if (m.lat < minLat) minLat = m.lat
      if (m.lat > maxLat) maxLat = m.lat
    })
    const latRange = maxLat - minLat || 1

    if (iptMunicipios && iptMunicipios.length > 0) {
      const iptLayer = L.layerGroup()
      const iptByNome = new Map(iptMunicipios.map((row) => [normalizeName(row.municipio), row]))
      const tooltipsAutomaticos = buildIptMunicipiosComTooltipAutomatico(
        iptMunicipios,
        iptIndicadorFiltro
      )
      const mapContainer = map.getContainer()
      mapContainer.classList.add('ipt-map-mode')

      const syncIptZoomClass = () => {
        mapContainer.classList.remove('ipt-zoom-far', 'ipt-zoom-mid', 'ipt-zoom-near')
        mapContainer.classList.add(`ipt-zoom-${iptZoomLevel(map.getZoom())}`)
      }

      const clearIptFocus = () => {
        mapContainer.classList.remove('ipt-map--focus')
        mapContainer.querySelectorAll('.ipt-chip--active').forEach((el) => {
          el.classList.remove('ipt-chip--active')
        })
      }

      const setIptFocus = (municipioKey: string) => {
        clearIptFocus()
        mapContainer.classList.add('ipt-map--focus')
        const chip = mapContainer.querySelector(
          `[data-ipt-municipio="${municipioKey.replace(/"/g, '\\"')}"]`
        )
        chip?.classList.add('ipt-chip--active')
      }

      const markersByKey = new Map<string, L.Marker>()

      const openIptMunicipio = (row: IptMunicipio, municipioKey: string, marker: L.Marker) => {
        setIptFocus(municipioKey)
        onIptMunicipioSelectRef.current?.(row.municipio)
        if (!marker.isPopupOpen()) {
          marker.openPopup()
        }
      }

      const toggleFiltroIptMunicipio = (row: IptMunicipio) => {
        onIptMunicipioToggleFiltroRef.current?.(row.municipio)
      }

      map.on('zoomend', syncIptZoomClass)
      syncIptZoomClass()

      const showPesquisaFullscreenLabels =
        Boolean(iptFullscreen) && iptMissaoFiltro === 'pesquisa'
      if (showPesquisaFullscreenLabels) {
        mapContainer.classList.add('ipt-map--pesquisa-fs')
      } else {
        mapContainer.classList.remove('ipt-map--pesquisa-fs')
      }

      // Clique no chip (tooltip interativo) → mesmo fluxo do marcador: perfil + popup.
      const onChipClick = (event: Event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        const chip = target.closest('[data-ipt-municipio]')
        if (!chip) return
        const key = chip.getAttribute('data-ipt-municipio')
        if (!key) return
        const marker = markersByKey.get(key)
        const row = iptByNome.get(key)
        if (!marker || !row) return
        event.preventDefault()
        event.stopPropagation()
        openIptMunicipio(row, key, marker)
      }
      const onChipDblClick = (event: Event) => {
        const target = event.target
        if (!(target instanceof Element)) return
        const chip = target.closest('[data-ipt-municipio]')
        if (!chip) return
        const key = chip.getAttribute('data-ipt-municipio')
        if (!key) return
        const row = iptByNome.get(key)
        if (!row) return
        event.preventDefault()
        event.stopPropagation()
        toggleFiltroIptMunicipio(row)
      }
      mapContainer.addEventListener('click', onChipClick, true)
      mapContainer.addEventListener('dblclick', onChipDblClick, true)

      municipiosPiaui.forEach((municipio, index) => {
        const row = iptByNome.get(normalizeName(municipio.nome))
        if (!row) return

        const municipioKey = normalizeName(row.municipio)
        const normalizedLat = (municipio.lat - minLat) / latRange
        const animDelay = Math.round((1 - normalizedLat) * 1200) + (index % 7) * 20
        const size = iptMarkerSize(row.pesoExpectativaPct, compactMarkers)
        const icon = L.divIcon({
          className: '',
          html: createIptMarkerHtml(
            row,
            size,
            animDelay,
            iptIndicadorFiltro,
            iptEvolucaoFiltro,
            iptMissaoFiltro
          ),
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2 - 4],
        })

        const marker = L.marker([municipio.lat, municipio.lng], { icon, pane: 'markersPane' })
          .bindPopup(createIptPopupHtml(row, appearance, iptIndicadorFiltro, iptMissaoFiltro), {
            maxWidth: 660,
            className: appearance === 'dark' ? 'mapa-obras-popup-dark' : 'mapa-obras-popup-soft ipt-popup-shell',
          })

        markersByKey.set(municipioKey, marker)

        marker.on('click', () => {
          openIptMunicipio(row, municipioKey, marker)
        })

        marker.on('dblclick', (e) => {
          L.DomEvent.stopPropagation(e)
          toggleFiltroIptMunicipio(row)
        })

        marker.on('popupopen', () => {
          setIptFocus(municipioKey)
          onIptMunicipioSelectRef.current?.(row.municipio)
          const popupEl = marker.getPopup()?.getElement()
          if (popupEl) {
            void hydrateIptPopupInsights(popupEl, appearance, onIptInsightSavedRef.current)
          }
        })
        marker.on('popupclose', () => clearIptFocus())

        // Modo missões: labels permanentes só em tela cheia da Missão Pesquisa
        // (posição + expectativa × pesquisa). Nas demais missões, só marcadores.
        if (showPesquisaFullscreenLabels) {
          const chipHtml = createIptPesquisaFullscreenChipHtml(row, {
            municipioKey,
            animDelay,
          })
          marker.bindTooltip(chipHtml, {
            permanent: true,
            direction: 'top',
            offset: [0, -(size / 2 + 6)],
            className: 'ipt-chip-tooltip',
            opacity: 1,
            interactive: true,
          })
        } else if (iptMissaoFiltro == null && tooltipsAutomaticos.has(municipioKey)) {
          const chipHtml = createIptTooltipBasicoHtml(row, appearance, iptIndicadorFiltro, {
            municipioKey,
            animDelay,
            evolucaoFiltro: iptEvolucaoFiltro,
          })
          if (chipHtml) {
            marker.bindTooltip(chipHtml, {
              permanent: true,
              direction: 'top',
              offset: [0, -(size / 2 + 6)],
              className: 'ipt-chip-tooltip',
              opacity: 1,
              interactive: true,
            })
          }
        }

        marker.addTo(iptLayer)
      })

      layersRef.current = { ipt: iptLayer }
      iptLayer.addTo(map)

      const containerEl = mapRef.current
      const scheduleInvalidateSize = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const m = mapInstanceRef.current
            if (!m) return
            try {
              m.invalidateSize({ animate: false })
            } catch {
              // mapa removido
            }
          })
        })
      }

      let resizeObserver: ResizeObserver | null = null
      if (typeof ResizeObserver !== 'undefined' && containerEl) {
        resizeObserver = new ResizeObserver(() => scheduleInvalidateSize())
        resizeObserver.observe(containerEl)
      }
      window.addEventListener('resize', scheduleInvalidateSize)
      document.addEventListener('fullscreenchange', scheduleInvalidateSize)
      scheduleInvalidateSize()
      const invalidateDelays = [120, 400].map((ms) => window.setTimeout(scheduleInvalidateSize, ms))

      return () => {
        map.off('zoomend', syncIptZoomClass)
        mapContainer.removeEventListener('click', onChipClick, true)
        mapContainer.removeEventListener('dblclick', onChipDblClick, true)
        clearIptFocus()
        mapContainer.classList.remove(
          'ipt-map-mode',
          'ipt-zoom-far',
          'ipt-zoom-mid',
          'ipt-zoom-near',
          'ipt-map--focus',
          'ipt-map--pesquisa-fs'
        )
        invalidateDelays.forEach((id) => window.clearTimeout(id))
        resizeObserver?.disconnect()
        window.removeEventListener('resize', scheduleInvalidateSize)
        document.removeEventListener('fullscreenchange', scheduleInvalidateSize)
        if (mapInstanceRef.current) {
          safeRemoveLeafletMap(mapInstanceRef.current)
          mapInstanceRef.current = null
          layersRef.current = {}
          statsCalculatedRef.current = false
        }
      }
    }

    municipiosPiaui.forEach((municipio) => {
      const nomeNorm = normalizeName(municipio.nome)
      const temPresenca = cidadesPresencaNorm.has(nomeNorm)
      const foiVisitada = cidadesVisitadasNorm.has(nomeNorm)
      const eleitorado = findEleitorado(municipio.nome, eleitoresPorCidade)
      const classif = classificacaoMapRef.current.get(nomeNorm)

      eleitoradoTotal += eleitorado

      let tipo: CidadeClassificada['tipo']
      if (foiVisitada) {
        tipo = 'visitada'
        countVisitadas++
        countPresenca++
        eleitoradoCoberto += eleitorado
      } else if (temPresenca) {
        tipo = 'com-presenca'
        countPresenca++
        eleitoradoCoberto += eleitorado
      } else if (eleitorado >= OPPORTUNITY_THRESHOLD) {
        tipo = 'oportunidade'
        countOportunidades++
      } else {
        tipo = 'sem-presenca'
      }

      cidades.push({
        municipio,
        eleitorado,
        tipo,
        classificacao: classif?.tipo || null,
        motivo: classif?.motivo || null,
        expectativaVotos: classif?.expectativaVotos,
        visitas: classif?.visitas,
        ultimaVisitaRelativa: classif?.ultimaVisitaRelativa,
        deltaVisitas: classif?.deltaVisitas,
        regiaoLabel: classif?.regiaoLabel,
        coberturaLabel: classif?.coberturaLabel,
        proximaAgendaLabel: classif?.proximaAgendaLabel,
      })
    })

    // ========== Calculate region stats ==========
    const regionData: Record<string, { lats: number[]; lngs: number[]; total: number; comPresenca: number; eleitoradoSem: number }> = {}
    cidades.forEach(c => {
      const region = getRegionName(c.municipio.lat)
      if (!regionData[region]) {
        regionData[region] = { lats: [], lngs: [], total: 0, comPresenca: 0, eleitoradoSem: 0 }
      }
      regionData[region].lats.push(c.municipio.lat)
      regionData[region].lngs.push(c.municipio.lng)
      regionData[region].total++
      if (c.tipo === 'visitada' || c.tipo === 'com-presenca') {
        regionData[region].comPresenca++
      } else {
        regionData[region].eleitoradoSem += c.eleitorado
      }
    })

    const regioes = Object.entries(regionData).map(([nome, data]) => {
      const percentual = data.total > 0 ? Math.round((data.comPresenca / data.total) * 100) : 0
      const centroLat = data.lats.reduce((a, b) => a + b, 0) / data.lats.length
      const centroLng = data.lngs.reduce((a, b) => a + b, 0) / data.lngs.length

      let classificacao: 'forte' | 'medio' | 'fraco' | 'critico'
      if (percentual >= 60) classificacao = 'forte'
      else if (percentual >= 40) classificacao = 'medio'
      else if (percentual >= 20) classificacao = 'fraco'
      else classificacao = 'critico'

      return { nome, centroLat, centroLng, totalCidades: data.total, cidadesComPresenca: data.comPresenca, percentual, classificacao, eleitoradoSemCobertura: data.eleitoradoSem }
    })

    // ========== Generate strategic insight ==========
    let insightPrincipal = ''
    if (regioes.length > 0) {
      const bestRegion = regioes.reduce((best, r) => r.percentual > best.percentual ? r : best, regioes[0])
      const worstRegion = regioes.reduce((worst, r) => r.percentual < worst.percentual ? r : worst, regioes[0])

      if (bestRegion && bestRegion.percentual >= 50) {
        insightPrincipal = `Forte presença no ${bestRegion.nome} — ${bestRegion.percentual}% de cobertura`
      } else if (countOportunidades > 10) {
        insightPrincipal = `${countOportunidades} cidades estratégicas sem liderança — potencial de expansão`
      } else if (worstRegion && worstRegion.eleitoradoSemCobertura > 50000) {
        const elSem = Math.round(worstRegion.eleitoradoSemCobertura / 1000)
        insightPrincipal = `${worstRegion.nome}: ${elSem} mil eleitores sem cobertura`
      } else {
        const percentTotal = eleitoradoTotal > 0 ? Math.round((eleitoradoCoberto / eleitoradoTotal) * 100) : 0
        insightPrincipal = `${countPresenca} cidades com presença — ${percentTotal}% do eleitorado coberto`
      }
    }

    // ========== Report stats to parent ==========
    const stats: MapStats = {
      totalCidades: municipiosPiaui.length,
      cidadesComPresenca: countPresenca,
      cidadesVisitadas: countVisitadas,
      cidadesSemPresenca: municipiosPiaui.length - countPresenca - countOportunidades,
      oportunidades: countOportunidades,
      eleitoradoTotal,
      eleitoradoCoberto,
      percentualCobertura: eleitoradoTotal > 0 ? Math.round((eleitoradoCoberto / eleitoradoTotal) * 100) : 0,
      regioes,
      insightPrincipal,
    }

    if (onStatsCalculated && !statsCalculatedRef.current) {
      statsCalculatedRef.current = true
      setTimeout(() => onStatsCalculated(stats), 0)
    }

    // ========== Create Layer Groups ==========
    const heatLayer = L.layerGroup()
    const comPresencaLayer = L.layerGroup()
    const visitadasLayer = L.layerGroup()
    const semPresencaLayer = L.layerGroup()
    const oportunidadesLayer = L.layerGroup()
    const zonasLayer = L.layerGroup()

    // ========== 1) HEATMAP CIRCLES ==========
    const heatColor = markerTheme === 'war-room'
      ? WR_MARKER.yellow
      : isDark
        ? '#2dd4bf'
        : '#3B82F6'
    const heatRadius = compactMarkers ? 16000 : 25000
    cidades.filter(c => c.tipo === 'visitada' || c.tipo === 'com-presenca').forEach(c => {
      const opacity = c.tipo === 'visitada' ? (isDark ? 0.14 : 0.1) : (isDark ? 0.09 : 0.06)
      L.circle([c.municipio.lat, c.municipio.lng], {
        radius: heatRadius,
        fillColor: heatColor,
        fillOpacity: markerTheme === 'war-room' ? (c.tipo === 'visitada' ? 0.18 : 0.1) : opacity,
        stroke: false,
        pane: 'heatmapPane',
        interactive: false,
      }).addTo(heatLayer)
    })

    // ========== 2) CITY MARKERS ==========
    // Sort: draw smaller/less important first (behind), larger/important on top
    const drawOrder: Record<string, number> = { 'sem-presenca': 0, 'oportunidade': 1, 'com-presenca': 2, 'visitada': 3 }
    const sortedCidades = [...cidades].sort((a, b) => (drawOrder[a.tipo] || 0) - (drawOrder[b.tipo] || 0))
    const isWarRoom = markerTheme === 'war-room'
    const popupOpts: L.PopupOptions = isWarRoom
      ? {
          maxWidth: 236,
          autoPan: true,
          keepInView: true,
          autoPanPaddingTopLeft: L.point(20, 64),
          autoPanPaddingBottomRight: L.point(20, 24),
        }
      : { maxWidth: 300 }

    const bindCityPopup = (
      marker: L.Marker,
      html: string,
      agendaChip?: { label: string; offsetY?: number },
    ) => {
      marker.bindPopup(html, popupOpts)
      if (isWarRoom) {
        attachWarRoomPopupKeepInView(map, marker)
        const label = agendaChip?.label?.trim()
        if (label) {
          const safe = label
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
          marker.bindTooltip(
            `<span class="mapa-wr-agenda-chip" title="${safe}">${safe}</span>`,
            {
              permanent: true,
              direction: 'top',
              offset: L.point(0, agendaChip?.offsetY ?? -8),
              opacity: 1,
              className: 'mapa-wr-agenda-tooltip',
              interactive: false,
            },
          )
        }
      }
    }

    sortedCidades.forEach(c => {
      const {
        municipio,
        eleitorado,
        tipo,
        classificacao,
        motivo,
        expectativaVotos,
        visitas,
        ultimaVisitaRelativa,
        deltaVisitas,
        regiaoLabel,
        coberturaLabel,
        proximaAgendaLabel,
      } = c

      // Animation delay: north-to-south sweep (0 to 1500ms)
      const normalizedLat = (municipio.lat - minLat) / latRange // 0 (south) to 1 (north)
      const animDelay = Math.round((1 - normalizedLat) * 1500)

      const tooltipHTML = createTooltipHTML(
        appearance,
        {
          nome: municipio.nome,
          tipo,
          eleitorado,
          classificacao,
          motivo,
          expectativaVotos,
          visitas,
          ultimaVisitaRelativa,
          deltaVisitas,
          regiaoLabel,
          coberturaLabel,
          proximaAgendaLabel,
        },
        { markerTheme, expectativaLabel },
      )

      if (tipo === 'visitada') {
        if (isWarRoom) {
          // Foguete vertical (proporção ~0.73) — âncora na base da chama
          const w = compactMarkers ? 20 : 28
          const h = Math.round(w * (1027 / 750))
          const icon = L.divIcon({
            className: 'mapa-marker-foguete-wrap',
            html: `<div class="mapa-marker-foguete" style="
              width:${w}px;height:${h}px;
              animation-delay:${animDelay}ms;
              filter:drop-shadow(0 2px 5px rgba(43,45,49,0.32));
            ">
              <img src="/foguete.png" alt="" width="${w}" height="${h}" draggable="false" style="
                width:${w}px;height:${h}px;object-fit:contain;pointer-events:none;display:block;
              " />
            </div>`,
            iconSize: [w, h],
            iconAnchor: [Math.round(w / 2), h],
            popupAnchor: [0, -h + 4],
          })
          const marker = L.marker([municipio.lat, municipio.lng], { icon, pane: 'markersPane' })
          bindCityPopup(
            marker,
            tooltipHTML,
            proximaAgendaLabel
              ? { label: proximaAgendaLabel, offsetY: -(h - 2) }
              : undefined,
          )
          marker.addTo(visitadasLayer)
        } else {
          const size = compactMarkers ? 12 : 24
          const checkSize = compactMarkers ? 7 : 12
          const borderWidth = compactMarkers ? 1.5 : 2
          const vBg = isDark ? '#0d9488' : '#2563EB'
          const vBorder = isDark ? '#0f766e' : '#1D4ED8'
          const vCheck = 'white'
          const vShadow = isDark
            ? '0 2px 12px rgba(45,212,191,0.45)'
            : '0 2px 8px rgba(37,99,235,0.5)'
          const icon = L.divIcon({
            className: '',
            html: `<div style="width:${size}px;height:${size}px;position:relative;">
            <div class="mapa-marker-dot" style="
              width:${size}px;height:${size}px;
              background:${vBg};
              border:${borderWidth}px solid ${vBorder};
              display:flex;align-items:center;justify-content:center;
              box-shadow:${vShadow};
              animation-delay:${animDelay}ms;
            ">
              <svg width="${checkSize}" height="${checkSize}" viewBox="0 0 24 24" fill="none" stroke="${vCheck}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            popupAnchor: [0, -size / 2 - 4],
          })
          const marker = L.marker([municipio.lat, municipio.lng], { icon, pane: 'markersPane' })
          bindCityPopup(
            marker,
            tooltipHTML,
            proximaAgendaLabel
              ? { label: proximaAgendaLabel, offsetY: -(size / 2 + 2) }
              : undefined,
          )
          marker.addTo(visitadasLayer)
        }

      } else if (tipo === 'com-presenca') {
        const size = compactMarkers ? 9 : 14
        const container = size + (compactMarkers ? 6 : 10)
        const borderWidth = compactMarkers ? 1.5 : 2
        const cBg = isWarRoom ? WR_MARKER.yellow : isDark ? '#14b8a6' : '#3B82F6'
        const cBorder = isWarRoom ? WR_MARKER.yellowBorder : isDark ? '#0d9488' : '#2563EB'
        const cShadow = isWarRoom
          ? '0 1px 4px rgba(43,45,49,0.18)'
          : isDark
            ? '0 1px 6px rgba(45,212,191,0.35)'
            : '0 1px 4px rgba(37,99,235,0.4)'
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:${container}px;height:${container}px;position:relative;">
            <div class="mapa-marker-dot" style="
              width:${size}px;height:${size}px;
              background:${cBg};
              border:${borderWidth}px solid ${cBorder};
              box-shadow:${cShadow};
              animation-delay:${animDelay}ms;
            "></div>
          </div>`,
          iconSize: [container, container],
          iconAnchor: [container / 2, container / 2],
          popupAnchor: [0, -size / 2 - 4],
        })
        const marker = L.marker([municipio.lat, municipio.lng], { icon, pane: 'markersPane' })
        bindCityPopup(
          marker,
          tooltipHTML,
          proximaAgendaLabel
            ? { label: proximaAgendaLabel, offsetY: -(size / 2 + 2) }
            : undefined,
        )
        marker.addTo(comPresencaLayer)

      } else if (tipo === 'oportunidade') {
        if (isWarRoom) {
          // War Room / Presença: não desenha marcadores de oportunidade
          return
        }
        const size = getMarkerSize(eleitorado, compactMarkers)
        const pulseSize = size * (compactMarkers ? 2 : 2.5)
        const container = pulseSize + (compactMarkers ? 4 : 6)
        const oBg = '#F59E0B'
        const oBorder = '#D97706'
        const oPulse = 'rgba(245,158,11,0.25)'
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:${container}px;height:${container}px;position:relative;">
            <div class="mapa-pulse-ring" style="width:${pulseSize}px;height:${pulseSize}px;background:${oPulse};"></div>
            <div class="mapa-marker-dot mapa-opportunity-dot" style="
              width:${size}px;height:${size}px;
              background:${oBg};
              border:2px solid ${oBorder};
              animation-delay:${animDelay}ms;
            "></div>
          </div>`,
          iconSize: [container, container],
          iconAnchor: [container / 2, container / 2],
          popupAnchor: [0, -size / 2 - 4],
        })
        const marker = L.marker([municipio.lat, municipio.lng], { icon, pane: 'markersPane' })
        bindCityPopup(marker, tooltipHTML)
        marker.addTo(oportunidadesLayer)

      } else if (isWarRoom) {
        // War Room / Presença: não desenha marcadores de cidades sem meta
        return
      } else {
        // sem-presenca
        const size = getMarkerSize(eleitorado, compactMarkers)
        const container = size + (compactMarkers ? 6 : 10)
        const isLarge = eleitorado >= 20000
        const isMedium = eleitorado >= 10000
        const bgColor = isLarge
          ? 'rgba(220,38,38,0.85)'
          : isMedium
            ? 'rgba(239,68,68,0.7)'
            : 'rgba(248,113,113,0.5)'
        const borderColor = isLarge
          ? 'rgba(153,27,27,0.9)'
          : isMedium
            ? 'rgba(220,38,38,0.8)'
            : 'rgba(239,68,68,0.6)'
        const borderWidth = isLarge ? 2 : 1

        const icon = L.divIcon({
          className: '',
          html: `<div style="width:${container}px;height:${container}px;position:relative;">
            <div class="mapa-marker-dot" style="
              width:${size}px;height:${size}px;
              background:${bgColor};
              border:${borderWidth}px solid ${borderColor};
              animation-delay:${animDelay}ms;
            "></div>
          </div>`,
          iconSize: [container, container],
          iconAnchor: [container / 2, container / 2],
          popupAnchor: [0, -size / 2 - 4],
        })
        const marker = L.marker([municipio.lat, municipio.lng], { icon, pane: 'markersPane' })
        bindCityPopup(marker, tooltipHTML)
        marker.addTo(semPresencaLayer)
      }
    })

    // ========== 3) ZONE LABELS ==========
    const statusLabels: Record<string, string> = {
      'forte': 'Forte',
      'medio': 'Em expansão',
      'fraco': 'Em disputa',
      'critico': 'Crítico',
    }

    if (showRegionLabels) {
      regioes.forEach(regiao => {
        const icon = L.divIcon({
          className: '',
          html: `<div class="mapa-zone-label">
            <div class="mapa-zone-name">${regiao.nome}</div>
            <div class="mapa-zone-status mapa-zone-${regiao.classificacao}">
              ${statusLabels[regiao.classificacao]} • ${regiao.percentual}%
            </div>
          </div>`,
          iconSize: [130, 44],
          iconAnchor: [65, 22],
          pane: 'labelsPane',
        })
        L.marker([regiao.centroLat, regiao.centroLng], { icon, interactive: false }).addTo(zonasLayer)
      })
    }

    // ========== Store layers and add all to map ==========
    layersRef.current = {
      heat: heatLayer,
      comPresenca: comPresencaLayer,
      visitadas: visitadasLayer,
      semPresenca: semPresencaLayer,
      oportunidades: oportunidadesLayer,
      zonas: zonasLayer,
    }
    Object.values(layersRef.current).forEach(layer => layer.addTo(map))

    // Enquadra o Piauí (evita “mar” vazio de MA/CE ao redor)
    const piauiPts = municipiosPiaui
      .filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng))
      .map((m) => [m.lat, m.lng] as [number, number])

    let fitCancelled = false
    const fitDelays: number[] = []
    let piauiCropAbort = false
    let piauiCropRefitTimer: number | null = null

    if (piauiPts.length >= 2) {
      const piauiBounds = L.latLngBounds(piauiPts)
      // Aperto leve no War Room (PI alongado N–S em container wide)
      const fitBoundsTarget = isWarRoom ? piauiBounds.pad(-0.04) : piauiBounds

      const fitPiaui = () => {
        if (fitCancelled) return
        if (mapInstanceRef.current !== map) return
        if (!isLeafletMapUsable(map)) return
        try {
          map.stop()
          map.invalidateSize({ animate: false })
          map.fitBounds(fitBoundsTarget, {
            paddingTopLeft: [isWarRoom ? 24 : 36, isWarRoom ? 96 : 28],
            paddingBottomRight: [isWarRoom ? 24 : 36, isWarRoom ? 24 : 28],
            maxZoom: isWarRoom ? 9 : 8,
            animate: false,
          })
          map.setMaxBounds(piauiBounds.pad(isWarRoom ? 0.18 : 0.35))
          map.setMinZoom(isWarRoom ? 6.5 : 6)
          map.options.maxBoundsViscosity = isWarRoom ? 0.9 : 0.75
        } catch {
          // mapa em transição / destruído
        }
      }

      fitPiaui()
      // Um único re-fit após o container estabilizar (evita corrida de animações)
      fitDelays.push(window.setTimeout(fitPiaui, 120))
    }

    // War Room: máscara opaca fora do contorno IBGE do PI + re-fit no polígono
    if (isWarRoom) {
      void (async () => {
        try {
          const res = await fetch('/api/geo/malha-municipios-pi')
          if (!res.ok || piauiCropAbort || mapInstanceRef.current !== map) return
          const payload = (await res.json()) as { contornoUf?: GeoJSON.GeoJSON | null }
          const geoUf = payload.contornoUf
          if (!geoUf || piauiCropAbort || mapInstanceRef.current !== map) return

          const { buildOutsidePiauiMask } = await import('@/lib/geo-piaui-mask')
          if (piauiCropAbort || mapInstanceRef.current !== map) return

          const maskFeature = buildOutsidePiauiMask(geoUf)
          if (maskFeature && isLeafletMapUsable(map)) {
            L.geoJSON(maskFeature as GeoJSON.GeoJSON, {
              pane: 'piMaskOutside',
              interactive: false,
              style: {
                fillColor: '#ffffff',
                fillOpacity: 1,
                stroke: false,
              },
            }).addTo(map)
          }

          // Contorno sutil do estado
          if (isLeafletMapUsable(map)) {
            L.geoJSON(geoUf, {
              pane: 'piMaskOutside',
              interactive: false,
              style: {
                fill: false,
                color: '#2b2d31',
                weight: 1.25,
                opacity: 0.28,
              },
            }).addTo(map)
          }

          const ufBounds = L.geoJSON(geoUf).getBounds()
          if (!ufBounds.isValid() || piauiCropAbort || !isLeafletMapUsable(map)) return

          const fitUf = () => {
            if (piauiCropAbort || fitCancelled) return
            if (mapInstanceRef.current !== map || !isLeafletMapUsable(map)) return
            try {
              map.stop()
              map.invalidateSize({ animate: false })
              map.fitBounds(ufBounds.pad(0.02), {
                paddingTopLeft: [20, 88],
                paddingBottomRight: [20, 20],
                maxZoom: 9.25,
                animate: false,
              })
              map.setMaxBounds(ufBounds.pad(0.1))
              map.setMinZoom(6.75)
              map.options.maxBoundsViscosity = 1
            } catch {
              // mapa em transição / destruído
            }
          }

          fitUf()
          if (piauiCropAbort || fitCancelled) return
          piauiCropRefitTimer = window.setTimeout(fitUf, 140)
          if (piauiCropAbort || fitCancelled) {
            window.clearTimeout(piauiCropRefitTimer)
            piauiCropRefitTimer = null
          }
        } catch {
          // fallback: enquadramento por pontos já aplicado
        }
      })()
    }

    const containerEl = mapRef.current
    const scheduleInvalidateSize = () => {
      if (fitCancelled) return
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const m = mapInstanceRef.current
          if (!m || m !== map || fitCancelled) return
          if (!isLeafletMapUsable(m)) return
          try {
            m.stop()
            m.invalidateSize({ animate: false })
          } catch {
            // mapa já removido
          }
        })
      })
    }

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && containerEl) {
      resizeObserver = new ResizeObserver(() => scheduleInvalidateSize())
      resizeObserver.observe(containerEl)
    }
    window.addEventListener('resize', scheduleInvalidateSize)
    document.addEventListener('fullscreenchange', scheduleInvalidateSize)
    scheduleInvalidateSize()
    const invalidateDelays = [120, 400].map((ms) => window.setTimeout(scheduleInvalidateSize, ms))

    // Cleanup
    return () => {
      fitCancelled = true
      piauiCropAbort = true
      fitDelays.forEach((id) => window.clearTimeout(id))
      if (piauiCropRefitTimer != null) window.clearTimeout(piauiCropRefitTimer)
      invalidateDelays.forEach((id) => window.clearTimeout(id))
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleInvalidateSize)
      document.removeEventListener('fullscreenchange', scheduleInvalidateSize)
      if (mapInstanceRef.current) {
        safeRemoveLeafletMap(mapInstanceRef.current)
        mapInstanceRef.current = null
        layersRef.current = {}
        statsCalculatedRef.current = false
      }
    }
  }, [cidadesComPresenca, cidadesVisitadas, municipiosPiaui, eleitoresPorCidade, onStatsCalculated, appearance, showRegionLabels, compactMarkers, markerTheme, expectativaLabel, territoriosQuentes, territoriosMornos, territoriosFrios, iptMunicipios, iptIndicadorFiltro, iptEvolucaoFiltro, iptMissaoFiltro, iptFullscreen])

  // ========== Handle filter changes ==========
  useEffect(() => {
    const layers = layersRef.current
    const map = mapInstanceRef.current
    if (!map || Object.keys(layers).length === 0) return
    if (layers.ipt) return

    // Remove all layers
    Object.values(layers).forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer)
    })

    // Add back based on active filter
    switch (filtroAtivo) {
      case 'todas':
        Object.values(layers).forEach(layer => layer.addTo(map))
        break
      case 'com-lideranca':
        layers.heat.addTo(map)
        layers.comPresenca.addTo(map)
        layers.visitadas.addTo(map)
        layers.zonas.addTo(map)
        break
      case 'sem-lideranca':
        layers.semPresenca.addTo(map)
        layers.oportunidades.addTo(map)
        break
      case 'visitadas':
        layers.heat.addTo(map)
        layers.visitadas.addTo(map)
        break
      case 'oportunidades':
        layers.oportunidades.addTo(map)
        break
    }
  }, [filtroAtivo])

  /** Zoom automático ao filtrar TD ou missão — enquadra municípios visíveis. */
  useEffect(() => {
    if (!iptMunicipios) return

    let cancelled = false
    let timeoutId = 0
    let rafId = 0

    const applyView = () => {
      if (cancelled) return
      const m = mapInstanceRef.current
      if (!isLeafletMapUsable(m)) return

      const fonteBounds =
        iptMunicipiosBounds.length > 0 ? iptMunicipiosBounds : iptMunicipios
      const pts = iptLatLngPointsFromMunicipios(fonteBounds)
      safeIptFitView(m, pts)
    }

    // Espera o remount do mapa (mesmo ciclo de deps) concluir antes do enquadramento.
    timeoutId = window.setTimeout(() => {
      rafId = window.requestAnimationFrame(applyView)
    }, 80)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      window.cancelAnimationFrame(rafId)
      const m = mapInstanceRef.current
      if (m) {
        try {
          m.stop()
        } catch {
          // ignore
        }
      }
    }
  }, [iptMunicipios, iptFiltroTd, iptMunicipiosBounds, iptMissaoFiltro])

  const hostClass = [
    appearance === 'dark' ? 'mapa-leaflet-host--dark' : 'mapa-leaflet-host--light',
    markerTheme === 'war-room' ? 'mapa-leaflet-host--wr' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <style>{getMapLeafletStyles(appearance)}</style>
      <div className={hostClass} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </>
  )
}
