'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Municipio {
  nome: string
  lat: number
  lng: number
}

interface MapWrapperProps {
  cidadesComPresenca: string[]
  municipiosPiaui: Municipio[]
}

export function MapWrapperLeaflet({ cidadesComPresenca, municipiosPiaui }: MapWrapperProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Inicializar o mapa
    const map = L.map(mapRef.current).setView([-6.5, -43.5], 7)
    mapInstanceRef.current = map

    // Adicionar tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    // Normalizar cidades com presença
    const cidadesNormalizadas = cidadesComPresenca.map(c => c.toLowerCase().trim())

    // Adicionar marcadores
    municipiosPiaui.forEach((municipio) => {
      const temPresenca = cidadesNormalizadas.includes(municipio.nome.toLowerCase().trim())

      const circleMarker = L.circleMarker([municipio.lat, municipio.lng], {
        radius: temPresenca ? 6 : 4,
        fillColor: temPresenca ? '#C6A15B' : '#E5DED4',
        color: temPresenca ? '#A67C41' : '#D4D0C8',
        weight: temPresenca ? 2 : 1,
        opacity: temPresenca ? 1 : 0.5,
        fillOpacity: temPresenca ? 0.8 : 0.5,
      })

      // Adicionar popup
      circleMarker.bindPopup(`
        <div style="font-size: 12px;">
          <p style="font-weight: bold; margin: 0;">${municipio.nome}</p>
          <p style="font-size: 11px; margin: 4px 0 0 0;">${temPresenca ? '✓ Presença Ativa' : 'Sem presença'}</p>
        </div>
      `)

      circleMarker.addTo(map)
    })

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [cidadesComPresenca, municipiosPiaui])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
