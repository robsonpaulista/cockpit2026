'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Point {
  cidade: string
  lat: number
  lng: number
  votos: number
  liderancas: number
  nivel: 'alto' | 'medio' | 'baixo'
  deputadoDominante: string
  corDeputado: string
  rankingDeputados: Array<{
    nome: string
    votos: number
    liderancas: number
  }>
}

interface MapaVotoCruzadoWrapperLeafletProps {
  points: Point[]
}

const MAP_STYLES = `
  .leaflet-popup-content-wrapper {
    border-radius: 10px !important;
    box-shadow: 0 8px 20px rgba(0,0,0,0.15) !important;
  }
  .leaflet-popup-content {
    margin: 10px 12px !important;
    line-height: 1.4 !important;
  }
`

const levelColor = (nivel: Point['nivel']) => {
  if (nivel === 'alto') return '#059669'
  if (nivel === 'medio') return '#D97706'
  return '#2563EB'
}

const levelFill = (nivel: Point['nivel']) => {
  if (nivel === 'alto') return '#10B981'
  if (nivel === 'medio') return '#F59E0B'
  return '#3B82F6'
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

export function MapaVotoCruzadoWrapperLeaflet({ points }: MapaVotoCruzadoWrapperLeafletProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    const map = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([-6.5, -42.8], 7)
    mapInstanceRef.current = map

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (layerRef.current) {
      layerRef.current.removeFrom(map)
    }

    const layer = L.layerGroup()

    points.forEach((point) => {
      const radius = Math.max(6, Math.min(22, 6 + Math.sqrt(Math.max(0, point.votos)) / 5))
      const rankingHtml = point.rankingDeputados
        .slice(0, 3)
        .map((dep, idx) => `
          <div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#4B5563;margin-top:${idx === 0 ? 0 : 3}px;">
            <span style="max-width:145px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${idx + 1}. ${escapeHtml(dep.nome)}</span>
            <span><strong>${dep.votos.toLocaleString('pt-BR')}</strong></span>
          </div>
        `)
        .join('')

      const marker = L.circleMarker([point.lat, point.lng], {
        radius,
        color: point.corDeputado,
        fillColor: levelFill(point.nivel),
        fillOpacity: 0.75,
        weight: 3,
      })

      marker.bindPopup(`
        <div style="font-family:system-ui,-apple-system,sans-serif;min-width:180px">
          <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:6px">${escapeHtml(point.cidade)}</div>
          <div style="font-size:11px;color:#4B5563;margin-bottom:6px">
            Deputado dominante:
            <strong style="color:${point.corDeputado};">${escapeHtml(point.deputadoDominante)}</strong>
          </div>
          <div style="font-size:12px;color:#4B5563;margin-bottom:2px">Votos cruzados: <strong>${point.votos.toLocaleString('pt-BR')}</strong></div>
          <div style="font-size:12px;color:#4B5563">Lideranças vinculadas: <strong>${point.liderancas}</strong></div>
          ${rankingHtml ? `<div style="margin-top:7px;padding-top:6px;border-top:1px solid #E5E7EB;">
            <div style="font-size:10px;color:#6B7280;margin-bottom:3px;">Ranking local (top 3)</div>
            ${rankingHtml}
          </div>` : ''}
        </div>
      `)

      marker.addTo(layer)
    })

    layer.addTo(map)
    layerRef.current = layer

    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]))
      map.fitBounds(bounds.pad(0.2))
    }
  }, [points])

  return (
    <>
      <style>{MAP_STYLES}</style>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </>
  )
}

