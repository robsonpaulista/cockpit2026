'use client'

import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import type { CidadeIntencaoTopoRow } from '@/lib/pesquisa-tendencia-executive'

interface Municipio {
  nome: string
  lat: number
  lng: number
}

type MapAppearance = 'light' | 'dark'

export interface MapaIntencaoMunicipiosProps {
  /** Linhas calculadas na guia "Visão geral" (top 10 espontânea/estimulada por cidade). */
  cidades: CidadeIntencaoTopoRow[]
  /**
   * Nome do candidato em foco. Quando informado, a cor do marcador e o
   * destaque do tooltip refletem a posição dele em cada município.
   * Quando ausente, a cor é baseada na densidade de pesquisas.
   */
  candidatoFoco?: string | null
  /** Alinha tiles, popups e marcadores ao tema claro/escuro do app */
  appearance?: MapAppearance
}

const MUNICIPIOS = municipiosPiaui as ReadonlyArray<Municipio>

function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function getRegionName(lat: number): string {
  if (lat > -4.8) return 'Norte'
  if (lat > -6.5) return 'Centro-Norte'
  if (lat > -8.5) return 'Centro-Sul'
  return 'Sul'
}

/**
 * Para o candidato em foco, descobre sua posição (1-based) e % médio em uma
 * lista top-N já ordenada decrescente. Retorna `null` quando não encontrado.
 */
function buscaPosicaoCandidato(
  lista: ReadonlyArray<{ nome: string; mediaPct: number }>,
  candidato: string | null | undefined,
): { posicao: number; mediaPct: number } | null {
  if (!candidato) return null
  const alvo = candidato.trim().toLowerCase()
  if (!alvo) return null
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].nome.trim().toLowerCase() === alvo) {
      return { posicao: i + 1, mediaPct: lista[i].mediaPct }
    }
  }
  return null
}

function primeiroColocadoPreferencial(row: CidadeIntencaoTopoRow | undefined): {
  nome: string
  mediaPct: number
  base: 'estimulada' | 'espontanea'
} | null {
  if (!row) return null
  const estimulado = row.top10Estimulada[0]
  if (estimulado) return { ...estimulado, base: 'estimulada' }
  const espontaneo = row.top10Espontanea[0]
  if (espontaneo) return { ...espontaneo, base: 'espontanea' }
  return null
}

/**
 * Mapeia uma posição (1, 2, 3, ...) em uma paleta de marcação por desempenho.
 * O 1º lugar do candidato em foco vira azul para identificar visualmente
 * "onde nós lideramos". Demais posições mantêm a escala verde → âmbar → vermelho.
 * `null` (sem dados) usa um cinza calmo.
 */
function corPorPosicao(posicao: number | null, isDark: boolean): { bg: string; border: string; text: string } {
  if (posicao == null) {
    return isDark
      ? { bg: 'rgba(148,163,184,0.32)', border: 'rgba(148,163,184,0.6)', text: '#cbd5e1' }
      : { bg: 'rgba(148,163,184,0.55)', border: 'rgba(100,116,139,0.85)', text: '#1f2937' }
  }
  if (posicao === 1) {
    // Azul "nosso candidato lidera"
    return isDark
      ? { bg: '#3b82f6', border: '#1d4ed8', text: '#e0ecff' }
      : { bg: '#2563eb', border: '#1e40af', text: 'white' }
  }
  if (posicao <= 3) {
    return isDark
      ? { bg: '#22c55e', border: '#15803d', text: '#dcfce7' }
      : { bg: '#65a30d', border: '#365314', text: 'white' }
  }
  if (posicao <= 5) {
    return isDark
      ? { bg: '#f59e0b', border: '#b45309', text: '#fff7ed' }
      : { bg: '#f59e0b', border: '#b45309', text: 'white' }
  }
  return isDark
    ? { bg: '#ef4444', border: '#991b1b', text: '#fff1f2' }
    : { bg: '#dc2626', border: '#7f1d1d', text: 'white' }
}

/**
 * Cor por densidade de pesquisas (quando não há candidato em foco): escala
 * azul com brilho proporcional ao total esp+est, e cinza quando não houver.
 */
function corPorDensidade(pesquisas: number, isDark: boolean): { bg: string; border: string; text: string } {
  if (pesquisas <= 0) {
    return isDark
      ? { bg: 'rgba(148,163,184,0.28)', border: 'rgba(148,163,184,0.5)', text: '#cbd5e1' }
      : { bg: 'rgba(148,163,184,0.5)', border: 'rgba(100,116,139,0.8)', text: '#1f2937' }
  }
  if (pesquisas >= 5) {
    return isDark
      ? { bg: '#0ea5e9', border: '#075985', text: '#e0f2fe' }
      : { bg: '#1d4ed8', border: '#1e3a8a', text: 'white' }
  }
  if (pesquisas >= 3) {
    return isDark
      ? { bg: '#38bdf8', border: '#0369a1', text: '#082f49' }
      : { bg: '#2563eb', border: '#1e40af', text: 'white' }
  }
  return isDark
    ? { bg: '#7dd3fc', border: '#0284c7', text: '#0c4a6e' }
    : { bg: '#3b82f6', border: '#1d4ed8', text: 'white' }
}

function tamanhoMarcador(pesquisas: number, posicaoMin: number | null): number {
  // Posições altas (próximas de 1) ganham um marcador um pouco maior.
  let base = 9
  if (pesquisas >= 5) base = 16
  else if (pesquisas >= 3) base = 13
  else if (pesquisas >= 1) base = 11
  if (posicaoMin === 1) base += 4
  else if (posicaoMin != null && posicaoMin <= 3) base += 2
  return base
}

function fmtPct(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) return '—'
  return `${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

interface InfoPosicao {
  posicao: number | null
  mediaPct: number | null
}

/**
 * HTML do popup do marcador: nome do município, posição e % em espontânea/estimulada
 * (do candidato em foco quando houver) e contagem de pesquisas distintas em cada tipo.
 */
function createPopupHTML(
  appearance: MapAppearance,
  config: {
    nome: string
    candidatoFoco: string | null
    espontanea: InfoPosicao
    estimulada: InfoPosicao
    pesquisasEspontaneas: number
    pesquisasEstimuladas: number
    topEspontanea: ReadonlyArray<{ nome: string; mediaPct: number }>
    topEstimulada: ReadonlyArray<{ nome: string; mediaPct: number }>
    primeiroColocado: { nome: string; mediaPct: number; base: 'estimulada' | 'espontanea' } | null
  },
): string {
  const isDark = appearance === 'dark'
  const muted = isDark ? '#94a3b8' : '#6b7280'
  const strong = isDark ? '#f1f5f9' : '#1f2937'
  const rowBorder = isDark ? '#334155' : '#f3f4f6'
  const headerBg = isDark ? '#0f172a' : '#0e7490'
  const bodyBg = isDark ? '#0f172a' : 'white'

  const semDados = config.pesquisasEspontaneas + config.pesquisasEstimuladas === 0

  function corTextoPosicao(p: number | null): string {
    if (p == null) return muted
    // 1º lugar do candidato em foco: azul (segue a cor do marcador).
    if (p === 1) return isDark ? '#93c5fd' : '#1d4ed8'
    if (p <= 3) return isDark ? '#bef264' : '#3f6212'
    if (p <= 5) return isDark ? '#fde68a' : '#92400e'
    return isDark ? '#fca5a5' : '#b91c1c'
  }

  function blocoTipo(titulo: string, info: InfoPosicao, total: number): string {
    return `<div style="padding:6px 0;border-bottom:1px solid ${rowBorder};">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <span style="font-size:11px;font-weight:600;color:${muted};text-transform:uppercase;letter-spacing:0.04em;">${titulo}</span>
        <span style="font-size:10px;color:${muted};">${total} pesq.</span>
      </div>
      <div style="margin-top:3px;display:flex;justify-content:space-between;align-items:baseline;gap:8px;">
        <span style="font-size:12px;color:${strong};">
          ${info.posicao != null ? `<strong style="color:${corTextoPosicao(info.posicao)};">${info.posicao}º</strong>` : `<span style="color:${muted};">—</span>`}
        </span>
        <span style="font-size:13px;font-weight:700;color:${strong};">${fmtPct(info.mediaPct)}</span>
      </div>
    </div>`
  }

  function rankingTop3(top: ReadonlyArray<{ nome: string; mediaPct: number }>): string {
    if (top.length === 0) return ''
    const itens = top.slice(0, 3).map((row, idx) => `
      <li style="display:flex;justify-content:space-between;gap:6px;padding:1px 0;">
        <span style="font-size:11px;color:${strong};">${idx + 1}º ${row.nome}</span>
        <span style="font-size:11px;font-weight:600;color:${strong};">${fmtPct(row.mediaPct)}</span>
      </li>`).join('')
    return `<ul style="margin:6px 0 0;padding:0;list-style:none;">${itens}</ul>`
  }

  function blocoTop3(titulo: string, top: ReadonlyArray<{ nome: string; mediaPct: number }>): string {
    if (top.length === 0) return ''
    return `<div style="margin-top:8px;">
      <span style="font-size:10px;font-weight:600;color:${muted};text-transform:uppercase;letter-spacing:0.04em;">${titulo}</span>
      ${rankingTop3(top)}
    </div>`
  }

  const candidatoLabel = config.candidatoFoco
    ? `<div style="margin-top:2px;font-size:11px;color:${muted};">Candidato em foco: <strong style="color:${strong};">${config.candidatoFoco}</strong></div>`
    : ''
  const primeiroColocadoLabel = config.primeiroColocado
    ? `<div style="margin-top:6px;padding:6px 8px;border-radius:8px;background:${isDark ? 'rgba(34,197,94,0.12)' : '#f0fdf4'};border:1px solid ${isDark ? 'rgba(134,239,172,0.22)' : '#bbf7d0'};">
        <div style="font-size:10px;font-weight:700;color:${isDark ? '#86efac' : '#15803d'};text-transform:uppercase;letter-spacing:0.05em;">1º colocado (${config.primeiroColocado.base === 'estimulada' ? 'estimulada' : 'espontânea'})</div>
        <div style="display:flex;justify-content:space-between;gap:8px;margin-top:2px;">
          <strong style="font-size:12px;color:${strong};">${config.primeiroColocado.nome}</strong>
          <strong style="font-size:12px;color:${strong};">${fmtPct(config.primeiroColocado.mediaPct)}</strong>
        </div>
      </div>`
    : ''

  if (semDados) {
    return `<div style="font-family:system-ui,-apple-system,sans-serif;min-width:220px;max-width:280px;">
      <div style="background:${headerBg};padding:10px 14px;">
        <strong style="color:white;font-size:14px;">${config.nome}</strong>
      </div>
      <div style="padding:10px 14px;background:${bodyBg};color:${muted};font-size:12px;">
        Sem pesquisas cadastradas neste município nos filtros atuais.
      </div>
    </div>`
  }

  return `<div style="font-family:system-ui,-apple-system,sans-serif;min-width:240px;max-width:300px;">
    <div style="background:${headerBg};padding:10px 14px;">
      <strong style="color:white;font-size:14px;">${config.nome}</strong>
      ${candidatoLabel}
    </div>
    <div style="padding:10px 14px;background:${bodyBg};">
      ${primeiroColocadoLabel}
      ${blocoTipo('Espontânea', config.espontanea, config.pesquisasEspontaneas)}
      ${blocoTipo('Estimulada', config.estimulada, config.pesquisasEstimuladas)}
      ${blocoTop3('Top 3 estimulada', config.topEstimulada)}
      ${blocoTop3('Top 3 espontânea', config.topEspontanea)}
    </div>
  </div>`
}

/** CSS específico do hospedeiro do mapa: tiles, popups e tooltip CARTO. */
function getMapStyles(appearance: MapAppearance): string {
  const base = `
  .mapa-intencao-host .leaflet-popup-content-wrapper {
    border-radius: 12px !important;
    padding: 0 !important;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.18) !important;
  }
  .mapa-intencao-host .leaflet-popup-content {
    margin: 0 !important;
    line-height: 1.4 !important;
  }
  .mapa-intencao-host .leaflet-popup-tip {
    box-shadow: 0 3px 10px rgba(0,0,0,0.1) !important;
  }
  .mapa-intencao-marker {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 999px;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    cursor: pointer;
    display:flex;align-items:center;justify-content:center;
    font-weight: 700;
    line-height: 1;
  }
  .mapa-intencao-marker:hover {
    transform: translate(-50%, -50%) scale(1.25) !important;
    z-index: 100 !important;
  }
  .mapa-intencao-leader-tooltip {
    background: rgba(255,255,255,0.94) !important;
    border: 1px solid rgba(15,23,42,0.12) !important;
    border-radius: 999px !important;
    box-shadow: 0 4px 14px rgba(15,23,42,0.14) !important;
    color: #0f172a !important;
    font-family: system-ui,-apple-system,sans-serif !important;
    font-size: 10px !important;
    font-weight: 700 !important;
    line-height: 1.1 !important;
    max-width: 132px !important;
    overflow: hidden !important;
    padding: 4px 7px !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }
  .mapa-intencao-leader-tooltip::before {
    display: none !important;
  }
  .mapa-intencao-leader-tooltip--candidato-padrao {
    background: #2563eb !important;
    border-color: #1e40af !important;
    color: #ffffff !important;
    box-shadow: 0 6px 18px rgba(37,99,235,0.32) !important;
  }
  .mapa-intencao-zone-label {
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 10px;
    padding: 6px 10px;
    font-family: system-ui,-apple-system,sans-serif;
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
    border: 1px solid rgba(0,0,0,0.06);
    text-align:center;
    pointer-events:none;
    white-space:nowrap;
  }
  .mapa-intencao-zone-name {
    font-size: 11px;
    font-weight: 700;
    color: #374151;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
`
  const dark = `
  .mapa-intencao-host--dark .leaflet-container {
    background: #0f1419 !important;
  }
  .mapa-intencao-host--dark .leaflet-popup-content-wrapper {
    background: #0f172a !important;
    box-shadow: 0 12px 40px rgba(0,0,0,0.55) !important;
    border: 1px solid rgba(148,163,184,0.25) !important;
  }
  .mapa-intencao-host--dark .leaflet-popup-tip {
    background: #0f172a !important;
  }
  .mapa-intencao-host--dark .leaflet-control-zoom a {
    background: #1e293b !important;
    color: #e2e8f0 !important;
    border-color: #334155 !important;
  }
  .mapa-intencao-host--dark .mapa-intencao-leader-tooltip {
    background: rgba(15,23,42,0.92) !important;
    border-color: rgba(148,163,184,0.28) !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.34) !important;
    color: #f8fafc !important;
  }
  .mapa-intencao-host--dark .mapa-intencao-leader-tooltip--candidato-padrao {
    background: #3b82f6 !important;
    border-color: #1d4ed8 !important;
    color: #ffffff !important;
    box-shadow: 0 6px 18px rgba(59,130,246,0.4) !important;
  }
  .mapa-intencao-host--dark .mapa-intencao-zone-label {
    background: rgba(22,34,44,0.92) !important;
    border: 1px solid rgba(148,163,184,0.22) !important;
  }
  .mapa-intencao-host--dark .mapa-intencao-zone-name {
    color: #e2e8f0 !important;
  }
`
  return appearance === 'dark' ? base + dark : base
}

export function MapaIntencaoMunicipios({
  cidades,
  candidatoFoco = null,
  appearance = 'light',
}: MapaIntencaoMunicipiosProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  /**
   * Indexa as linhas da guia "Visão geral" por nome de cidade normalizado.
   * Como o cálculo já garante `cidadeLabel`, este lookup é direto.
   */
  const cidadesPorChave = useMemo(() => {
    const map = new Map<string, CidadeIntencaoTopoRow>()
    for (const row of cidades) {
      if (!row.cidadeLabel) continue
      map.set(normalizeName(row.cidadeLabel), row)
    }
    return map
  }, [cidades])

  /**
   * Inicializa o mapa Leaflet e renderiza todos os municípios do Piauí como
   * marcadores. Os dados de pesquisa são lidos do `cidadesPorChave`.
   */
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const isDark = appearance === 'dark'

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([-6.5, -43.0], 7)
    mapInstanceRef.current = map

    map.createPane('mapaIntencaoMarkers')
    const markersPane = map.getPane('mapaIntencaoMarkers')
    if (markersPane) markersPane.style.zIndex = '400'

    map.createPane('mapaIntencaoLabels')
    const labelsPane = map.getPane('mapaIntencaoLabels')
    if (labelsPane) {
      labelsPane.style.zIndex = '500'
      labelsPane.style.pointerEvents = 'none'
    }

    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    L.tileLayer(tileUrl, {
      attribution: '&copy; OSM &copy; CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)

    const markersLayer = L.layerGroup().addTo(map)
    const zonasLayer = L.layerGroup().addTo(map)

    // Acumula centros regionais para rotular as 4 zonas no mapa.
    const regionAcc: Record<string, { lat: number; lng: number; n: number }> = {}

    MUNICIPIOS.forEach((mun) => {
      const row = cidadesPorChave.get(normalizeName(mun.nome))
      const pesqEsp = row?.pesquisasDistintasEspontanea ?? 0
      const pesqEst = row?.pesquisasDistintasEstimulada ?? 0

      const posEsp = row ? buscaPosicaoCandidato(row.top10Espontanea, candidatoFoco) : null
      const posEst = row ? buscaPosicaoCandidato(row.top10Estimulada, candidatoFoco) : null

      const posicaoMin = (() => {
        const arr: number[] = []
        if (posEsp) arr.push(posEsp.posicao)
        if (posEst) arr.push(posEst.posicao)
        return arr.length > 0 ? Math.min(...arr) : null
      })()

      const totalPesquisas = pesqEsp + pesqEst
      const primeiroColocado = primeiroColocadoPreferencial(row)
      const cor = candidatoFoco
        ? corPorPosicao(posicaoMin, isDark)
        : corPorDensidade(totalPesquisas, isDark)
      const size = tamanhoMarcador(totalPesquisas, posicaoMin)
      const container = size + 8

      // Texto interno: posição quando houver candidato em foco; caso contrário,
      // mostra apenas a contagem total para destacar municípios mais pesquisados.
      const labelInterno = candidatoFoco
        ? posicaoMin != null
          ? String(posicaoMin)
          : ''
        : totalPesquisas > 0
          ? String(totalPesquisas)
          : ''

      const fontSize = size >= 14 ? 11 : size >= 11 ? 10 : 9

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${container}px;height:${container}px;position:relative;">
          <div class="mapa-intencao-marker" style="
            width:${size}px;height:${size}px;
            background:${cor.bg};
            border:1.5px solid ${cor.border};
            color:${cor.text};
            font-size:${fontSize}px;
            box-shadow:0 1px 4px rgba(0,0,0,0.25);
          ">${labelInterno}</div>
        </div>`,
        iconSize: [container, container],
        iconAnchor: [container / 2, container / 2],
        popupAnchor: [0, -size / 2 - 4],
      })

      const marker = L.marker([mun.lat, mun.lng], { icon, pane: 'mapaIntencaoMarkers' })
      const popupHTML = createPopupHTML(appearance, {
        nome: mun.nome,
        candidatoFoco: candidatoFoco ?? null,
        espontanea: {
          posicao: posEsp?.posicao ?? null,
          mediaPct: posEsp?.mediaPct ?? null,
        },
        estimulada: {
          posicao: posEst?.posicao ?? null,
          mediaPct: posEst?.mediaPct ?? null,
        },
        pesquisasEspontaneas: pesqEsp,
        pesquisasEstimuladas: pesqEst,
        topEspontanea: row?.top10Espontanea ?? [],
        topEstimulada: row?.top10Estimulada ?? [],
        primeiroColocado,
      })
      marker.bindPopup(popupHTML, { maxWidth: 320 })
      if (primeiroColocado) {
        const liderEhCandidatoFoco = Boolean(
          candidatoFoco && normalizeName(primeiroColocado.nome) === normalizeName(candidatoFoco),
        )
        const tooltipClassName = liderEhCandidatoFoco
          ? 'mapa-intencao-leader-tooltip mapa-intencao-leader-tooltip--candidato-padrao'
          : 'mapa-intencao-leader-tooltip'
        marker.bindTooltip(primeiroColocado.nome, {
          permanent: true,
          direction: 'right',
          offset: [8, 0],
          opacity: 1,
          className: tooltipClassName,
        })
      }
      marker.addTo(markersLayer)

      // Centroide regional aproximado para rotular as zonas.
      const region = getRegionName(mun.lat)
      if (!regionAcc[region]) {
        regionAcc[region] = { lat: 0, lng: 0, n: 0 }
      }
      regionAcc[region].lat += mun.lat
      regionAcc[region].lng += mun.lng
      regionAcc[region].n += 1
    })

    Object.entries(regionAcc).forEach(([nome, acc]) => {
      const centroLat = acc.lat / acc.n
      const centroLng = acc.lng / acc.n
      const icon = L.divIcon({
        className: '',
        html: `<div class="mapa-intencao-zone-label">
          <div class="mapa-intencao-zone-name">${nome}</div>
        </div>`,
        iconSize: [110, 28],
        iconAnchor: [55, 14],
        pane: 'mapaIntencaoLabels',
      })
      L.marker([centroLat, centroLng], { icon, interactive: false }).addTo(zonasLayer)
    })

    const containerEl = mapRef.current
    const scheduleInvalidateSize = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const m = mapInstanceRef.current
          if (!m) return
          try {
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

    return () => {
      invalidateDelays.forEach((id) => window.clearTimeout(id))
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleInvalidateSize)
      document.removeEventListener('fullscreenchange', scheduleInvalidateSize)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [cidadesPorChave, candidatoFoco, appearance])

  const hostClass = appearance === 'dark' ? 'mapa-intencao-host mapa-intencao-host--dark' : 'mapa-intencao-host'

  return (
    <>
      <style>{getMapStyles(appearance)}</style>
      <div className={hostClass} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      </div>
    </>
  )
}
