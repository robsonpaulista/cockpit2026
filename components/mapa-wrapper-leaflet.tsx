'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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
}

// ========== Constants ==========
const OPPORTUNITY_THRESHOLD = 15000

// ========== Helper Functions ==========
function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function getMarkerSize(eleitorado: number): number {
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

// ========== Tooltip HTML Generator ==========
function createTooltipHTML(config: {
  nome: string
  tipo: 'visitada' | 'com-presenca' | 'sem-presenca' | 'oportunidade'
  eleitorado: number
  classificacao?: string | null
  motivo?: string | null
  expectativaVotos?: number
  visitas?: number
}): string {
  const { nome, tipo, eleitorado, classificacao, motivo, expectativaVotos, visitas } = config

  const statusMap: Record<string, { text: string; color: string; headerBg: string }> = {
    'visitada': { text: '✓ Visitada', color: '#2563EB', headerBg: '#1D4ED8' },
    'com-presenca': { text: '● Com liderança', color: '#2563EB', headerBg: '#2563EB' },
    'sem-presenca': { text: '⚠ Sem liderança', color: '#DC2626', headerBg: '#DC2626' },
    'oportunidade': { text: '🎯 Oportunidade', color: '#D97706', headerBg: '#B45309' },
  }
  const s = statusMap[tipo]

  // Classification badge
  let classificacaoBadge = ''
  if (classificacao) {
    const badges: Record<string, { bg: string; label: string }> = {
      'quente': { bg: '#059669', label: '🔥 Quente' },
      'morno': { bg: '#D97706', label: '🌤 Morno' },
      'frio': { bg: '#DC2626', label: '❄️ Frio' },
    }
    const b = badges[classificacao]
    if (b) {
      classificacaoBadge = `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:600;color:white;background:${b.bg};">${b.label}</span>`
    }
  }

  // Info rows
  let rows = ''
  rows += `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #F3F4F6;">
    <span style="font-size:11px;color:#6B7280;">📍 Status</span>
    <span style="font-size:12px;font-weight:600;color:${s.color};">${s.text}</span>
  </div>`

  rows += `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #F3F4F6;">
    <span style="font-size:11px;color:#6B7280;">🗳️ Eleitores</span>
    <span style="font-size:12px;font-weight:600;color:#1F2937;">${eleitorado > 0 ? eleitorado.toLocaleString('pt-BR') : 'N/D'}</span>
  </div>`

  if (visitas && visitas > 0) {
    rows += `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #F3F4F6;">
      <span style="font-size:11px;color:#6B7280;">📋 Visitas</span>
      <span style="font-size:12px;font-weight:600;color:#1F2937;">${visitas}</span>
    </div>`
  }

  if (expectativaVotos && expectativaVotos > 0) {
    rows += `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #F3F4F6;">
      <span style="font-size:11px;color:#6B7280;">🎯 Exp. Votos</span>
      <span style="font-size:12px;font-weight:600;color:#1F2937;">${expectativaVotos.toLocaleString('pt-BR')}</span>
    </div>`
  }

  let extras = ''
  if (motivo) {
    extras += `<div style="margin-top:6px;padding:6px 8px;background:#F9FAFB;border-radius:6px;font-size:11px;color:#4B5563;line-height:1.4;">💡 ${motivo}</div>`
  }
  if (tipo === 'oportunidade') {
    extras += `<div style="margin-top:6px;padding:6px 8px;background:#FEF3C7;border-radius:6px;font-size:11px;color:#92400E;font-weight:600;text-align:center;">🚀 Alto potencial de crescimento</div>`
  }

  return `<div style="font-family:system-ui,-apple-system,sans-serif;min-width:220px;max-width:280px;">
    <div style="background:${s.headerBg};padding:10px 14px;display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <strong style="color:white;font-size:14px;">${nome}</strong>
      ${classificacaoBadge}
    </div>
    <div style="padding:10px 14px;background:white;">
      ${rows}
      ${extras}
    </div>
  </div>`
}

// ========== CSS Styles ==========
const MAP_STYLES = `
  .leaflet-popup-content-wrapper {
    border-radius: 12px !important;
    padding: 0 !important;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.18) !important;
  }
  .leaflet-popup-content {
    margin: 0 !important;
    line-height: 1.4 !important;
  }
  .leaflet-popup-tip {
    box-shadow: 0 3px 10px rgba(0,0,0,0.1) !important;
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
    font-family: system-ui, -apple-system, sans-serif;
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

// ========== Component ==========
export function MapWrapperLeaflet({
  cidadesComPresenca,
  cidadesVisitadas = [],
  municipiosPiaui,
  eleitoresPorCidade = {},
  territoriosQuentes = [],
  territoriosMornos = [],
  territoriosFrios = [],
  filtroAtivo = 'todas',
  onStatsCalculated,
}: MapWrapperProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const layersRef = useRef<Record<string, L.LayerGroup>>({})
  const statsCalculatedRef = useRef(false)

  // Build territory classification lookup
  const classificacaoMapRef = useRef(new Map<string, { tipo: string; motivo: string; expectativaVotos?: number; visitas?: number }>())

  useEffect(() => {
    const classMap = new Map<string, { tipo: string; motivo: string; expectativaVotos?: number; visitas?: number }>()
    territoriosQuentes.forEach(t => classMap.set(normalizeName(t.cidade), { tipo: 'quente', motivo: t.motivo, expectativaVotos: t.expectativaVotos, visitas: t.visitas }))
    territoriosMornos.forEach(t => classMap.set(normalizeName(t.cidade), { tipo: 'morno', motivo: t.motivo, expectativaVotos: t.expectativaVotos, visitas: t.visitas }))
    territoriosFrios.forEach(t => classMap.set(normalizeName(t.cidade), { tipo: 'frio', motivo: t.motivo, expectativaVotos: t.expectativaVotos, visitas: t.visitas }))
    classificacaoMapRef.current = classMap
  }, [territoriosQuentes, territoriosMornos, territoriosFrios])

  // ========== Map initialization ==========
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([-6.5, -43.0], 7)
    mapInstanceRef.current = map

    // Custom panes for z-ordering
    map.createPane('heatmapPane')
    const heatPane = map.getPane('heatmapPane')
    if (heatPane) { heatPane.style.zIndex = '250'; heatPane.style.pointerEvents = 'none' }

    map.createPane('markersPane')
    const markersPane = map.getPane('markersPane')
    if (markersPane) markersPane.style.zIndex = '400'

    map.createPane('labelsPane')
    const labelsPane = map.getPane('labelsPane')
    if (labelsPane) { labelsPane.style.zIndex = '500'; labelsPane.style.pointerEvents = 'none' }

    // Clean tile layer (CartoDB Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)

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
      cidadesSemPresenca: municipiosPiaui.length - countPresenca,
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
    cidades.filter(c => c.tipo === 'visitada' || c.tipo === 'com-presenca').forEach(c => {
      const opacity = c.tipo === 'visitada' ? 0.1 : 0.06
      L.circle([c.municipio.lat, c.municipio.lng], {
        radius: 25000,
        fillColor: '#3B82F6',
        fillOpacity: opacity,
        stroke: false,
        pane: 'heatmapPane',
        interactive: false,
      }).addTo(heatLayer)
    })

    // ========== 2) CITY MARKERS ==========
    // Sort: draw smaller/less important first (behind), larger/important on top
    const drawOrder: Record<string, number> = { 'sem-presenca': 0, 'oportunidade': 1, 'com-presenca': 2, 'visitada': 3 }
    const sortedCidades = [...cidades].sort((a, b) => (drawOrder[a.tipo] || 0) - (drawOrder[b.tipo] || 0))

    sortedCidades.forEach(c => {
      const { municipio, eleitorado, tipo, classificacao, motivo, expectativaVotos, visitas } = c

      // Animation delay: north-to-south sweep (0 to 1500ms)
      const normalizedLat = (municipio.lat - minLat) / latRange // 0 (south) to 1 (north)
      const animDelay = Math.round((1 - normalizedLat) * 1500)

      const tooltipHTML = createTooltipHTML({ nome: municipio.nome, tipo, eleitorado, classificacao, motivo, expectativaVotos, visitas })

      if (tipo === 'visitada') {
        const size = 24
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:${size}px;height:${size}px;position:relative;">
            <div class="mapa-marker-dot" style="
              width:${size}px;height:${size}px;
              background:#2563EB;
              border:2px solid #1D4ED8;
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 2px 8px rgba(37,99,235,0.5);
              animation-delay:${animDelay}ms;
            ">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2 - 4],
        })
        const marker = L.marker([municipio.lat, municipio.lng], { icon, pane: 'markersPane' })
        marker.bindPopup(tooltipHTML, { maxWidth: 300 })
        marker.addTo(visitadasLayer)

      } else if (tipo === 'com-presenca') {
        const size = 14
        const container = size + 10
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:${container}px;height:${container}px;position:relative;">
            <div class="mapa-marker-dot" style="
              width:${size}px;height:${size}px;
              background:#3B82F6;
              border:2px solid #2563EB;
              box-shadow:0 1px 4px rgba(37,99,235,0.4);
              animation-delay:${animDelay}ms;
            "></div>
          </div>`,
          iconSize: [container, container],
          iconAnchor: [container / 2, container / 2],
          popupAnchor: [0, -size / 2 - 4],
        })
        const marker = L.marker([municipio.lat, municipio.lng], { icon, pane: 'markersPane' })
        marker.bindPopup(tooltipHTML, { maxWidth: 300 })
        marker.addTo(comPresencaLayer)

      } else if (tipo === 'oportunidade') {
        const size = getMarkerSize(eleitorado)
        const pulseSize = size * 2.5
        const container = pulseSize + 6
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:${container}px;height:${container}px;position:relative;">
            <div class="mapa-pulse-ring" style="width:${pulseSize}px;height:${pulseSize}px;"></div>
            <div class="mapa-marker-dot mapa-opportunity-dot" style="
              width:${size}px;height:${size}px;
              background:#F59E0B;
              border:2px solid #D97706;
              animation-delay:${animDelay}ms;
            "></div>
          </div>`,
          iconSize: [container, container],
          iconAnchor: [container / 2, container / 2],
          popupAnchor: [0, -size / 2 - 4],
        })
        const marker = L.marker([municipio.lat, municipio.lng], { icon, pane: 'markersPane' })
        marker.bindPopup(tooltipHTML, { maxWidth: 300 })
        marker.addTo(oportunidadesLayer)

      } else {
        // sem-presenca
        const size = getMarkerSize(eleitorado)
        const container = size + 10
        const isLarge = eleitorado >= 20000
        const isMedium = eleitorado >= 10000
        const bgColor = isLarge ? 'rgba(220,38,38,0.85)' : isMedium ? 'rgba(239,68,68,0.7)' : 'rgba(248,113,113,0.5)'
        const borderColor = isLarge ? 'rgba(153,27,27,0.9)' : isMedium ? 'rgba(220,38,38,0.8)' : 'rgba(239,68,68,0.6)'
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
        marker.bindPopup(tooltipHTML, { maxWidth: 300 })
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

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        layersRef.current = {}
        statsCalculatedRef.current = false
      }
    }
  }, [cidadesComPresenca, cidadesVisitadas, municipiosPiaui, eleitoresPorCidade, onStatsCalculated])

  // ========== Handle filter changes ==========
  useEffect(() => {
    const layers = layersRef.current
    const map = mapInstanceRef.current
    if (!map || Object.keys(layers).length === 0) return

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

  return (
    <>
      <style>{MAP_STYLES}</style>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}
