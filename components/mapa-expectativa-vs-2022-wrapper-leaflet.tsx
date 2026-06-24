'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import {
  labelTendenciaExpectativa2022,
  type ComparativoExpectativa2022Row,
  type TendenciaExpectativa2022,
} from '@/lib/comparativo-expectativa-2022'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import { APP_FONT_STACK_CSS } from '@/lib/app-font-stack'

type MapAppearance = 'light' | 'dark'

export interface ComparativoMapStats {
  totalCidades: number
  cresceu: number
  manteve: number
  caiu: number
  semDados: number
  insightPrincipal: string
}

interface MapaExpectativaVs2022WrapperLeafletProps {
  comparativoLista: ComparativoExpectativa2022Row[]
  filtroTendencia?: TendenciaExpectativa2022 | 'todos'
  appearance?: MapAppearance
  onStatsCalculated?: (stats: ComparativoMapStats) => void
}

function normalizeName(name: string): string {
  return normalizeMunicipioNome(name)
}

function getMarkerSize(votosRef: number): number {
  if (votosRef >= 5000) return 18
  if (votosRef >= 2000) return 15
  if (votosRef >= 800) return 12
  if (votosRef >= 300) return 10
  if (votosRef >= 100) return 8
  return 6
}

const CORES_TENDENCIA: Record<TendenciaExpectativa2022, { bg: string; border: string }> = {
  cresceu: { bg: '#059669', border: '#047857' },
  manteve: { bg: '#D97706', border: '#B45309' },
  caiu: { bg: '#DC2626', border: '#B91C1C' },
  'sem-dados': { bg: '#9CA3AF', border: '#6B7280' },
}

function createPopupHTML(row: ComparativoExpectativa2022Row, appearance: MapAppearance): string {
  const isDark = appearance === 'dark'
  const cor = CORES_TENDENCIA[row.tendencia]
  const pct =
    row.deltaPercentual != null
      ? `${row.deltaPercentual >= 0 ? '+' : ''}${row.deltaPercentual.toFixed(1)}%`
      : '—'
  const deltaLabel = `${row.delta >= 0 ? '+' : ''}${row.delta.toLocaleString('pt-BR')}`

  return `
    <div style="font-family:${APP_FONT_STACK_CSS};min-width:200px;color:${isDark ? '#e2e8f0' : '#111827'};">
      <div style="font-weight:700;font-size:13px;margin-bottom:6px;">${row.cidade}</div>
      <div style="font-size:11px;margin-bottom:4px;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${cor.bg};margin-right:6px;"></span>
        ${labelTendenciaExpectativa2022(row.tendencia)}
      </div>
      <div style="font-size:11px;line-height:1.5;">
        <div>Expectativa 2026: <strong>${row.expectativa2026.toLocaleString('pt-BR')}</strong></div>
        <div>Federal 2022 (Jadyel): <strong>${row.votos2022.toLocaleString('pt-BR')}</strong></div>
        <div>Δ ${deltaLabel} (${pct})</div>
      </div>
    </div>
  `
}

export function MapaExpectativaVs2022WrapperLeaflet({
  comparativoLista,
  filtroTendencia = 'todos',
  appearance = 'light',
  onStatsCalculated,
}: MapaExpectativaVs2022WrapperLeafletProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const isDark = appearance === 'dark'
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView(
      [-6.5, -43.0],
      7
    )
    mapInstanceRef.current = map

    map.createPane('markersPane')
    const markersPane = map.getPane('markersPane')
    if (markersPane) markersPane.style.zIndex = '400'

    const tileUrl = isDark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
    L.tileLayer(tileUrl, {
      attribution: '&copy; OSM &copy; CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markersLayerRef.current = null
    }
  }, [appearance])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current)
      markersLayerRef.current = null
    }

    const comparativoMap = new Map(
      comparativoLista.map((row) => [normalizeName(row.cidade), row] as const)
    )

    const listaFiltrada =
      filtroTendencia === 'todos'
        ? comparativoLista
        : comparativoLista.filter((row) => row.tendencia === filtroTendencia)

    let cresceu = 0
    let manteve = 0
    let caiu = 0
    let semDados = 0
    comparativoLista.forEach((row) => {
      if (row.tendencia === 'cresceu') cresceu += 1
      else if (row.tendencia === 'manteve') manteve += 1
      else if (row.tendencia === 'caiu') caiu += 1
      else semDados += 1
    })

    const markersLayer = L.layerGroup().addTo(map)
    markersLayerRef.current = markersLayer

    ;(municipiosPiaui as Array<{ nome: string; lat: number; lng: number }>).forEach((municipio) => {
      const row = comparativoMap.get(normalizeName(municipio.nome))
      if (!row) return
      if (filtroTendencia !== 'todos' && row.tendencia !== filtroTendencia) return

      const votosRef = Math.max(row.expectativa2026, row.votos2022, 1)
      const size = getMarkerSize(votosRef)
      const container = size + 8
      const cores = CORES_TENDENCIA[row.tendencia]

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${container}px;height:${container}px;display:flex;align-items:center;justify-content:center;">
          <div style="width:${size}px;height:${size}px;border-radius:50%;background:${cores.bg};border:2px solid ${cores.border};box-shadow:0 1px 6px rgba(0,0,0,0.25);"></div>
        </div>`,
        iconSize: [container, container],
        iconAnchor: [container / 2, container / 2],
        popupAnchor: [0, -size / 2 - 4],
      })

      const marker = L.marker([municipio.lat, municipio.lng], { icon, pane: 'markersPane' })
      marker.bindPopup(createPopupHTML(row, appearance), { maxWidth: 280 })
      marker.addTo(markersLayer)
    })

    const insight =
      cresceu >= caiu
        ? `Crescimento em ${cresceu} municípios vs. queda em ${caiu}`
        : `Queda em ${caiu} municípios — atenção territorial`

    if (onStatsCalculated) {
      onStatsCalculated({
        totalCidades: comparativoLista.length,
        cresceu,
        manteve,
        caiu,
        semDados,
        insightPrincipal: insight,
      })
    }

    return () => {
      if (markersLayerRef.current) {
        map.removeLayer(markersLayerRef.current)
        markersLayerRef.current = null
      }
    }
  }, [comparativoLista, filtroTendencia, appearance, onStatsCalculated])

  return <div ref={mapRef} className="h-full w-full" />
}
