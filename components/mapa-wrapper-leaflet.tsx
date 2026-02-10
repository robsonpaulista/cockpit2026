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
  cidadesVisitadas?: string[]
  municipiosPiaui: Municipio[]
  eleitoresPorCidade?: Record<string, number>
}

// Calcular raio do marcador baseado no número de eleitores (para cidades SEM presença)
function getRadiusByEleitorado(eleitorado: number): number {
  if (eleitorado >= 100000) return 12
  if (eleitorado >= 50000) return 10
  if (eleitorado >= 20000) return 8
  if (eleitorado >= 10000) return 6
  if (eleitorado >= 5000) return 5
  return 3
}

// Normalizar nome para comparação
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function MapWrapperLeaflet({ cidadesComPresenca, cidadesVisitadas = [], municipiosPiaui, eleitoresPorCidade }: MapWrapperProps) {
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

    // Normalizar nomes para comparação
    const cidadesPresencaNorm = new Set(cidadesComPresenca.map(c => normalizeName(c)))
    const cidadesVisitadasNorm = new Set(cidadesVisitadas.map(c => normalizeName(c)))

    // Buscar eleitorado de uma cidade (com normalização)
    const getEleitorado = (nomeCidade: string): number => {
      if (!eleitoresPorCidade) return 0
      const normalized = normalizeName(nomeCidade)
      
      // Busca exata primeiro
      for (const [key, value] of Object.entries(eleitoresPorCidade)) {
        if (normalizeName(key) === normalized) return value
      }
      // Busca parcial
      for (const [key, value] of Object.entries(eleitoresPorCidade)) {
        const keyNorm = normalizeName(key)
        if (keyNorm.includes(normalized) || normalized.includes(keyNorm)) return value
      }
      return 0
    }

    // Classificar municípios em 3 categorias
    const semPresenca: Array<{ municipio: Municipio; eleitorado: number }> = []
    const comPresenca: Municipio[] = []
    const visitadas: Municipio[] = []

    municipiosPiaui.forEach((municipio) => {
      const nomeNorm = normalizeName(municipio.nome)
      const temPresenca = cidadesPresencaNorm.has(nomeNorm)
      const foiVisitada = cidadesVisitadasNorm.has(nomeNorm)

      if (foiVisitada) {
        visitadas.push(municipio)
      } else if (temPresenca) {
        comPresenca.push(municipio)
      } else {
        const eleitorado = getEleitorado(municipio.nome)
        semPresenca.push({ municipio, eleitorado })
      }
    })

    // Ordenar sem presença por eleitorado (menores primeiro, maiores por cima)
    semPresenca.sort((a, b) => a.eleitorado - b.eleitorado)

    // 1) Desenhar cidades SEM presença (VERMELHO)
    semPresenca.forEach(({ municipio, eleitorado }) => {
      const radius = eleitorado > 0 ? getRadiusByEleitorado(eleitorado) : 3
      const isGrande = eleitorado >= 20000
      const isMedio = eleitorado >= 10000

      const circleMarker = L.circleMarker([municipio.lat, municipio.lng], {
        radius,
        fillColor: isGrande ? '#DC2626' : isMedio ? '#EF4444' : '#F87171',
        color: isGrande ? '#991B1B' : isMedio ? '#DC2626' : '#EF4444',
        weight: isGrande ? 2 : 1,
        opacity: isGrande ? 0.9 : isMedio ? 0.7 : 0.5,
        fillOpacity: isGrande ? 0.7 : isMedio ? 0.55 : 0.4,
      })

      const eleitoradoFormatado = eleitorado > 0
        ? eleitorado.toLocaleString('pt-BR')
        : 'N/D'

      circleMarker.bindPopup(`
        <div style="font-size: 12px; min-width: 140px;">
          <p style="font-weight: bold; margin: 0; color: #DC2626;">${municipio.nome}</p>
          <p style="font-size: 11px; margin: 4px 0 0 0; color: #666;">⚠ Sem liderança</p>
          <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #eee;">
            <p style="font-size: 11px; margin: 0; color: #333;">
              <strong>Eleitores:</strong> ${eleitoradoFormatado}
            </p>
          </div>
        </div>
      `)

      circleMarker.addTo(map)
    })

    // 2) Desenhar cidades COM presença mas NÃO visitadas (AZUL - círculo)
    comPresenca.forEach((municipio) => {
      const circleMarker = L.circleMarker([municipio.lat, municipio.lng], {
        radius: 6,
        fillColor: '#2563EB',
        color: '#1D4ED8',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      })

      circleMarker.bindPopup(`
        <div style="font-size: 12px;">
          <p style="font-weight: bold; margin: 0; color: #1D4ED8;">${municipio.nome}</p>
          <p style="font-size: 11px; margin: 4px 0 0 0; color: #2563EB;">● Com liderança</p>
        </div>
      `)

      circleMarker.addTo(map)
    })

    // 3) Desenhar cidades VISITADAS (AZUL - com ícone de check)
    const visitadaIcon = L.divIcon({
      className: '',
      html: `<div style="
        width: 22px; height: 22px;
        background: #2563EB;
        border: 2px solid #1D4ED8;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(37,99,235,0.5);
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
      popupAnchor: [0, -12],
    })

    visitadas.forEach((municipio) => {
      const marker = L.marker([municipio.lat, municipio.lng], {
        icon: visitadaIcon,
      })

      marker.bindPopup(`
        <div style="font-size: 12px;">
          <p style="font-weight: bold; margin: 0; color: #1D4ED8;">${municipio.nome}</p>
          <p style="font-size: 11px; margin: 4px 0 0 0; color: #2563EB;">✓ Visitada</p>
        </div>
      `)

      marker.addTo(map)
    })

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [cidadesComPresenca, cidadesVisitadas, municipiosPiaui, eleitoresPorCidade])

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
}
