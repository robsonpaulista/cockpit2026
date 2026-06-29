'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PlanoAmostragemBloco } from '@/lib/plano-amostragem-publico-types'
import type { LocalMapaPlano } from '@/lib/eleitorado-locais-pi'
import type { SetorMapaPlano } from '@/lib/setores-censitarios-pi'
import {
  corBlocoPlano,
  calcularCentroMapa,
  calcularCentroMapaFromSetores,
} from '@/lib/plano-amostragem-mapa'

export type CamadaMapaPlano = 'setores_ibge' | 'locais_tse' | 'hibrido'

type MapaPlanoAmostragemProps = {
  municipio: string
  locais: LocalMapaPlano[]
  setores?: SetorMapaPlano[]
  blocos: PlanoAmostragemBloco[]
  camadaMapa?: CamadaMapaPlano
  height?: number
}

export function MapaPlanoAmostragem({
  municipio,
  locais,
  setores = [],
  blocos,
  camadaMapa = 'locais_tse',
  height = 420,
}: MapaPlanoAmostragemProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  const modoSetores = camadaMapa === 'setores_ibge'
  const modoHibrido = camadaMapa === 'hibrido'
  const temDados =
    modoSetores ? setores.length > 0 : modoHibrido ? locais.length > 0 : locais.length > 0 || setores.length > 0

  useEffect(() => {
    if (!hostRef.current || !temDados) return

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    const centro =
      modoSetores || (modoHibrido && setores.length > 0)
        ? calcularCentroMapaFromSetores(setores)
        : calcularCentroMapa(locais)

    const map = L.map(hostRef.current, {
      center: [centro.lat, centro.lng],
      zoom: centro.zoom,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 18,
    }).addTo(map)

    if ((modoSetores || modoHibrido) && setores.length > 0) {
      const features = setores.map((setor) => ({
        type: 'Feature' as const,
        properties: {
          cdSetor: setor.cdSetor,
          rotulo: setor.rotulo,
          populacao: setor.populacao,
          blocoId: setor.blocoId,
          blocoNome: setor.blocoNome,
        },
        geometry: setor.geometry,
      }))

      L.geoJSON({ type: 'FeatureCollection', features } as GeoJSON.FeatureCollection, {
        style: (feature) => {
          if (modoHibrido) {
            return {
              color: '#94a3b8',
              weight: 1,
              fillColor: '#cbd5e1',
              fillOpacity: 0.2,
            }
          }
          const blocoId = String(feature?.properties?.blocoId ?? 'sem-bloco')
          const cor = corBlocoPlano(blocoId, blocos)
          return {
            color: cor,
            weight: 1.2,
            fillColor: cor,
            fillOpacity: 0.45,
          }
        },
        onEachFeature: (feature, layer) => {
          const p = feature.properties ?? {}
          layer.bindPopup(
            `<strong>${p.rotulo ?? 'Setor censitário'}</strong><br/>` +
              `${Number(p.populacao ?? 0).toLocaleString('pt-BR')} hab.<br/>` +
              (modoHibrido
                ? '<em>Referência espacial IBGE</em>'
                : p.blocoNome
                  ? `<em>Bloco: ${p.blocoNome}</em>`
                  : ''),
          )
        },
      }).addTo(map)
    }

    if (!modoSetores && locais.length > 0) {
      for (const local of locais) {
        const blocoId = local.blocoId ?? 'sem-bloco'
        const cor = corBlocoPlano(blocoId, blocos)
        const raio = Math.max(4, Math.min(10, 4 + Math.log10(local.eleitores + 1)))

        L.circleMarker([local.lat, local.lng], {
          radius: raio,
          color: cor,
          fillColor: cor,
          fillOpacity: 0.85,
          weight: 1.5,
        })
          .bindPopup(
            `<strong>${local.nmLocal ?? 'Local de votação'}</strong><br/>` +
              `${local.bairro}<br/>` +
              `${local.eleitores.toLocaleString('pt-BR')} eleitores<br/>` +
              (local.blocoNome ? `<em>Bloco: ${local.blocoNome}</em>` : ''),
          )
          .addTo(map)
      }
    }

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [locais, setores, blocos, municipio, modoSetores, modoHibrido, temDados, camadaMapa])

  if (!temDados) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed border-card bg-background/50 text-sm text-secondary"
        style={{ height }}
      >
        Sem malha geográfica para este município.
      </div>
    )
  }

  const legendaMapa =
    camadaMapa === 'setores_ibge'
      ? 'Polígonos IBGE · cor = bloco do plano'
      : camadaMapa === 'hibrido'
        ? 'Cinza = setores IBGE (referência) · pontos coloridos = locais TSE por bloco'
        : 'Pontos = locais TSE · cor = bloco do plano'

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-secondary">{legendaMapa}</p>
      <div
        ref={hostRef}
        className="w-full overflow-hidden rounded-lg border border-card"
        style={{ height }}
        aria-label={`Mapa do plano de amostragem — ${municipio}`}
      />
      <div className="flex flex-wrap gap-2">
        {blocos.map((bloco) => (
          <span
            key={bloco.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-card px-2 py-0.5 text-[10px] text-secondary"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: corBlocoPlano(bloco.id, blocos) }}
              aria-hidden
            />
            {bloco.nome} ({bloco.entrevistas})
          </span>
        ))}
      </div>
    </div>
  )
}
