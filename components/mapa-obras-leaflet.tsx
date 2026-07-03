'use client'

import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import {
  coordsMarcadorPorTema,
  temasComObrasNoMunicipio,
  type MunicipioObrasMarcador,
  type ObraFaseFiltro,
  type ObraMapaRow,
  faseMarkerParaMunicipio,
  normalizeObraText,
} from '@/lib/obras-mapa'
import {
  createObraMarkerHtml,
  createObraPopupHtml,
  createObraTooltipHtml,
  getObraMapLeafletStyles,
  type ObraMapAppearance,
} from '@/lib/obras-mapa-markers'
import { municipioUsaMarcadorFoto, primeiraImagemObraUrl } from '@/lib/google-drive-image-url'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

const MAP_HEIGHT_PX = 480

interface MapaObrasLeafletProps {
  marcadores: MunicipioObrasMarcador[]
  obras: ObraMapaRow[]
  filtroFase: ObraFaseFiltro
  selectedMarcadorKey?: string | null
  onSelectMarcador?: (markerKey: string) => void
  isFullscreen?: boolean
}

function findMunicipioCoords(nome: string): { lat: number; lng: number } | null {
  const alvo = normalizeObraText(nome)
  const hit = municipiosPiaui.find((m) => normalizeObraText(m.nome) === alvo)
  if (hit) return { lat: hit.lat, lng: hit.lng }
  const parcial = municipiosPiaui.find((m) => {
    const n = normalizeObraText(m.nome)
    return n.includes(alvo) || alvo.includes(n)
  })
  return parcial ? { lat: parcial.lat, lng: parcial.lng } : null
}

function scheduleInvalidateSize(map: L.Map) {
  const run = () => {
    try {
      map.invalidateSize({ animate: false })
    } catch {
      // mapa já removido
    }
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(run)
  })
  window.setTimeout(run, 120)
}

function tileUrlForAppearance(appearance: ObraMapAppearance): string {
  return appearance === 'dark'
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
}

export function MapaObrasLeaflet({
  marcadores,
  obras,
  filtroFase,
  selectedMarcadorKey,
  onSelectMarcador,
  isFullscreen = false,
}: MapaObrasLeafletProps) {
  const { appearance } = useTheme()
  const mapAppearance: ObraMapAppearance = appearance === 'dark' ? 'dark' : 'light'
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const markersByKeyRef = useRef<Map<string, L.Marker>>(new Map())
  const hasFitBoundsRef = useRef(false)

  const temasPorMunicipio = useMemo(() => {
    const mapa = new Map<string, ReturnType<typeof temasComObrasNoMunicipio>>()
    for (const m of marcadores) {
      if (!mapa.has(m.municipio)) {
        mapa.set(m.municipio, temasComObrasNoMunicipio(obras, m.municipio))
      }
    }
    return mapa
  }, [marcadores, obras])

  useEffect(() => {
    const container = mapRef.current
    if (!container || mapInstanceRef.current) return

    const map = L.map(container, {
      zoomControl: true,
      attributionControl: false,
    }).setView([-6.5, -43.0], 7)
    mapInstanceRef.current = map

    map.createPane('obrasMarkersPane')
    const markersPane = map.getPane('obrasMarkersPane')
    if (markersPane) markersPane.style.zIndex = '450'

    const tileLayer = L.tileLayer(tileUrlForAppearance(mapAppearance), {
      attribution: '&copy; OSM &copy; CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)
    tileLayerRef.current = tileLayer

    markersLayerRef.current = L.layerGroup().addTo(map)

    map.whenReady(() => scheduleInvalidateSize(map))

    return () => {
      map.remove()
      mapInstanceRef.current = null
      tileLayerRef.current = null
      markersLayerRef.current = null
      markersByKeyRef.current.clear()
      hasFitBoundsRef.current = false
    }
  }, [])

  useEffect(() => {
    const tileLayer = tileLayerRef.current
    if (!tileLayer) return
    tileLayer.setUrl(tileUrlForAppearance(mapAppearance))
  }, [mapAppearance])

  useEffect(() => {
    const map = mapInstanceRef.current
    const markersLayer = markersLayerRef.current
    if (!map || !markersLayer) return

    markersLayer.clearLayers()
    markersByKeyRef.current.clear()

    const bounds: L.LatLngExpression[] = []
    const lats = marcadores
      .map((m) => findMunicipioCoords(m.municipio)?.lat)
      .filter((v): v is number => typeof v === 'number')
    const minLat = lats.length ? Math.min(...lats) : -6.5
    const maxLat = lats.length ? Math.max(...lats) : -6.5
    const latRange = Math.max(maxLat - minLat, 0.1)

    marcadores.forEach((m, index) => {
      const baseCoords = findMunicipioCoords(m.municipio)
      if (!baseCoords) return

      const temasNoMunicipio = temasPorMunicipio.get(m.municipio) ?? [m.tema]
      const coords = coordsMarcadorPorTema(baseCoords, m.tema, temasNoMunicipio)

      const fase = faseMarkerParaMunicipio(m, filtroFase)
      const selected = m.markerKey === selectedMarcadorKey
      const normalizedLat = (baseCoords.lat - minLat) / latRange
      const animDelayMs = Math.round((1 - normalizedLat) * 600 + index * 40)

      let photoUrl: string | null = null
      if (municipioUsaMarcadorFoto(m.municipio) && m.tema === 'pavimentacao') {
        photoUrl = primeiraImagemObraUrl(m.obras, 200)
      }

      const pinSize = photoUrl ? (selected ? 52 : 46) : selected ? 44 : 38
      const pinHeight = photoUrl ? pinSize + 10 : pinSize + 8
      const anchorY = photoUrl ? pinSize + 6 : pinSize + 4
      const icon = L.divIcon({
        className: '',
        html: createObraMarkerHtml({
          fase,
          tema: m.tema,
          selected,
          total: m.total,
          animDelayMs,
          photoUrl,
        }),
        iconSize: [pinSize, pinHeight],
        iconAnchor: [pinSize / 2, anchorY],
        popupAnchor: [0, -(pinSize + 2)],
      })

      const marker = L.marker([coords.lat, coords.lng], {
        icon,
        pane: 'obrasMarkersPane',
        zIndexOffset: selected ? 1000 : 0,
      })
        .bindPopup(createObraPopupHtml(m, fase, mapAppearance, m.tema), {
          maxWidth: 320,
          className: mapAppearance === 'dark' ? 'mapa-obras-popup-dark' : '',
        })
        .bindTooltip(createObraTooltipHtml(m, fase, m.tema), {
          direction: 'top',
          offset: [0, -pinSize],
          opacity: 1,
          className: 'obra-marker-tooltip-shell',
        })

      marker.on('mouseover', () => {
        marker.setZIndexOffset(2000)
        marker.openTooltip()
      })
      marker.on('mouseout', () => {
        marker.setZIndexOffset(selected ? 1000 : 0)
      })
      marker.on('click', () => {
        onSelectMarcador?.(m.markerKey)
        marker.openPopup()
        map.flyTo([coords.lat, coords.lng], Math.max(map.getZoom(), 9), { duration: 0.6 })
      })

      marker.addTo(markersLayer)
      markersByKeyRef.current.set(m.markerKey, marker)
      bounds.push([coords.lat, coords.lng])
    })

    if (bounds.length > 0 && !hasFitBoundsRef.current) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 9 })
      hasFitBoundsRef.current = true
      scheduleInvalidateSize(map)
    }
  }, [filtroFase, mapAppearance, marcadores, onSelectMarcador, selectedMarcadorKey, temasPorMunicipio])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !selectedMarcadorKey) return

    const marker = markersByKeyRef.current.get(selectedMarcadorKey)
    if (!marker) return

    const latLng = marker.getLatLng()
    map.flyTo(latLng, Math.max(map.getZoom(), 9), { duration: 0.55 })
    marker.openPopup()
  }, [selectedMarcadorKey])

  useEffect(() => {
    hasFitBoundsRef.current = false
  }, [filtroFase, marcadores])

  useEffect(() => {
    const map = mapInstanceRef.current
    const containerEl = mapRef.current
    if (!map || !containerEl) return

    scheduleInvalidateSize(map)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => scheduleInvalidateSize(map))
      resizeObserver.observe(containerEl)
    }

    const onResize = () => scheduleInvalidateSize(map)
    window.addEventListener('resize', onResize)
    document.addEventListener('fullscreenchange', onResize)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', onResize)
      document.removeEventListener('fullscreenchange', onResize)
    }
  }, [isFullscreen])

  const hostClass =
    mapAppearance === 'dark' ? 'mapa-obras-host mapa-obras-host--dark' : 'mapa-obras-host mapa-obras-host--light'

  return (
    <div
      className={cn(
        hostClass,
        'relative w-full overflow-hidden',
        isFullscreen ? 'h-full min-h-0 flex-1' : ''
      )}
      style={isFullscreen ? undefined : { height: MAP_HEIGHT_PX }}
    >
      <style>{getObraMapLeafletStyles(mapAppearance)}</style>
      <div ref={mapRef} className="h-full w-full" />
    </div>
  )
}
