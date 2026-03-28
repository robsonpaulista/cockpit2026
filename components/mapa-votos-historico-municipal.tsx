'use client'

import { useEffect, useRef, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import municipiosPiaui from '@/lib/municipios-piaui.json'

export type PontoVotosMunicipio = { municipio: string; votos: number }

type MunicipioCoord = { nome: string; lat: number; lng: number }

function normalizeMun(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildVotosLookup(pontos: PontoVotosMunicipio[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const p of pontos) {
    const k = normalizeMun(p.municipio)
    m.set(k, (m.get(k) || 0) + p.votos)
  }
  return m
}

function votosNoMunicipio(nomeReferencia: string, lookup: Map<string, number>): number {
  const n = normalizeMun(nomeReferencia)
  if (lookup.has(n)) return lookup.get(n) ?? 0
  for (const [k, v] of lookup.entries()) {
    if (k === n) return v
    if (k.includes(n) || n.includes(k)) return v
  }
  return 0
}

function corPorIntensidade(t: number): string {
  if (t <= 0) return '#9ca3af'
  if (t < 0.15) return '#fde68a'
  if (t < 0.35) return '#fbbf24'
  if (t < 0.55) return '#d97706'
  if (t < 0.75) return '#b45309'
  return '#92400e'
}

interface MapaVotosHistoricoMunicipalProps {
  pontos: PontoVotosMunicipio[]
  titulo: string
  subtitulo?: string
  /** Altura CSS do mapa */
  heightClass?: string
}

export function MapaVotosHistoricoMunicipal({
  pontos,
  titulo,
  subtitulo,
  heightClass = 'h-[420px]',
}: MapaVotosHistoricoMunicipalProps) {
  const mapRef = useRef<HTMLDivElement>(null)

  const lookup = useMemo(() => buildVotosLookup(pontos), [pontos])
  const maxVotos = useMemo(() => Math.max(1, ...pontos.map((p) => p.votos), 0), [pontos])
  const totalVotosMapa = useMemo(() => pontos.reduce((s, p) => s + p.votos, 0), [pontos])

  useEffect(() => {
    const el = mapRef.current
    if (!el) return

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: false,
    }).setView([-6.5, -42.5], 6.5)

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)

    const layerGroup = L.layerGroup().addTo(map)

    const lista = municipiosPiaui as MunicipioCoord[]
    lista.forEach((mun) => {
      const v = votosNoMunicipio(mun.nome, lookup)
      const t = maxVotos > 0 ? v / maxVotos : 0
      const r = v > 0 ? 5 + Math.sqrt(t) * 22 : 4
      const fill = corPorIntensidade(t)
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${r * 2}px;height:${r * 2}px;display:flex;align-items:center;justify-content:center;">
          <div style="width:${r}px;height:${r}px;border-radius:9999px;background:${fill};opacity:${v > 0 ? 0.92 : 0.35};border:1px solid rgba(0,0,0,0.12);box-shadow:0 1px 4px rgba(0,0,0,0.15);"></div>
        </div>`,
        iconSize: [r * 2, r * 2],
        iconAnchor: [r, r],
      })
      const marker = L.marker([mun.lat, mun.lng], { icon })
      const pct = maxVotos > 0 ? ((v / maxVotos) * 100).toFixed(1) : '0'
      marker.bindPopup(
        `<div style="font-family:system-ui,sans-serif;min-width:180px;padding:4px 0;">
          <strong style="font-size:13px;">${mun.nome}</strong>
          <div style="margin-top:6px;font-size:12px;color:#374151;">
            <span style="color:#6b7280;">Votos:</span> <strong>${v.toLocaleString('pt-BR')}</strong>
            ${v > 0 ? `<span style="color:#9ca3af;"> (${pct}% do pico no mapa)</span>` : ''}
          </div>
        </div>`,
        { maxWidth: 280 }
      )
      marker.addTo(layerGroup)
    })

    const fixSize = () => map.invalidateSize()
    requestAnimationFrame(fixSize)
    const t = window.setTimeout(fixSize, 200)

    return () => {
      window.clearTimeout(t)
      map.remove()
    }
  }, [lookup, maxVotos])

  return (
    <div className="w-full overflow-hidden rounded-xl border border-card bg-background">
      <div className="border-b border-card px-3 py-2">
        <p className="text-sm font-semibold text-text-primary">{titulo}</p>
        {subtitulo && <p className="text-xs text-secondary mt-0.5">{subtitulo}</p>}
        <p className="text-[11px] text-secondary mt-1">
          {(municipiosPiaui as MunicipioCoord[]).length} municípios PI ·{' '}
          {totalVotosMapa.toLocaleString('pt-BR')} votos somados nos pontos carregados
        </p>
      </div>
      <div ref={mapRef} className={`w-full min-h-[320px] ${heightClass}`} />
      <div className="flex flex-wrap items-center gap-3 border-t border-card px-3 py-2 text-[10px] text-secondary">
        <span className="font-medium text-text-primary">Intensidade (vs. município mais votado):</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-400" /> 0
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-200" /> baixa
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> média
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-900" /> alta
        </span>
      </div>
    </div>
  )
}

export type PontoVotosComparacao = { municipio: string; votosA: number; votosB: number }

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Cor: mais azul = domínio do candidato A; mais âmbar = domínio do B. */
function corComparacao(ratioA: number): string {
  const r = Math.max(0, Math.min(1, ratioA))
  const ar = 29
  const ag = 78
  const ab = 216
  const br = 217
  const bg = 119
  const bb = 6
  const lr = Math.round(ar + (br - ar) * (1 - r))
  const lg = Math.round(ag + (bg - ag) * (1 - r))
  const lb = Math.round(ab + (bb - ab) * (1 - r))
  return `rgb(${lr},${lg},${lb})`
}

function buildComparacaoLookup(
  pontos: PontoVotosComparacao[]
): Map<string, { votosA: number; votosB: number }> {
  const m = new Map<string, { votosA: number; votosB: number }>()
  for (const p of pontos) {
    const k = normalizeMun(p.municipio)
    const cur = m.get(k) || { votosA: 0, votosB: 0 }
    m.set(k, {
      votosA: cur.votosA + p.votosA,
      votosB: cur.votosB + p.votosB,
    })
  }
  return m
}

function votosComparacaoNoMunicipio(
  nomeReferencia: string,
  lookup: Map<string, { votosA: number; votosB: number }>
): { votosA: number; votosB: number } {
  const n = normalizeMun(nomeReferencia)
  if (lookup.has(n)) return lookup.get(n) ?? { votosA: 0, votosB: 0 }
  for (const [k, v] of lookup.entries()) {
    if (k === n) return v
    if (k.includes(n) || n.includes(k)) return v
  }
  return { votosA: 0, votosB: 0 }
}

interface MapaVotosMunicipioCompareProps {
  pontos: PontoVotosComparacao[]
  labelA: string
  labelB: string
  titulo: string
  subtitulo?: string
  heightClass?: string
}

export function MapaVotosMunicipioCompare({
  pontos,
  labelA,
  labelB,
  titulo,
  subtitulo,
  heightClass = 'h-[420px]',
}: MapaVotosMunicipioCompareProps) {
  const mapRef = useRef<HTMLDivElement>(null)

  const lookup = useMemo(() => buildComparacaoLookup(pontos), [pontos])
  const maxTotal = useMemo(
    () => Math.max(1, ...pontos.map((p) => p.votosA + p.votosB), 0),
    [pontos]
  )
  const totais = useMemo(
    () => ({
      a: pontos.reduce((s, p) => s + p.votosA, 0),
      b: pontos.reduce((s, p) => s + p.votosB, 0),
    }),
    [pontos]
  )

  useEffect(() => {
    const el = mapRef.current
    if (!el) return

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: false,
    }).setView([-6.5, -42.5], 6.5)

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map)

    const layerGroup = L.layerGroup().addTo(map)
    const lista = municipiosPiaui as MunicipioCoord[]

    lista.forEach((mun) => {
      const { votosA, votosB } = votosComparacaoNoMunicipio(mun.nome, lookup)
      const total = votosA + votosB
      const t = maxTotal > 0 ? total / maxTotal : 0
      const r = total > 0 ? 6 + Math.sqrt(t) * 24 : 4
      const ratioA = total > 0 ? votosA / total : 0.5
      const fill = total > 0 ? corComparacao(ratioA) : '#9ca3af'
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:${r * 2}px;height:${r * 2}px;display:flex;align-items:center;justify-content:center;">
          <div style="width:${r}px;height:${r}px;border-radius:9999px;background:${fill};opacity:${total > 0 ? 0.9 : 0.35};border:1px solid rgba(0,0,0,0.15);box-shadow:0 1px 4px rgba(0,0,0,0.15);"></div>
        </div>`,
        iconSize: [r * 2, r * 2],
        iconAnchor: [r, r],
      })
      const marker = L.marker([mun.lat, mun.lng], { icon })
      const nomeE = escHtml(mun.nome)
      const la = escHtml(labelA)
      const lb = escHtml(labelB)
      const pctTot = maxTotal > 0 ? ((total / maxTotal) * 100).toFixed(1) : '0'
      const lider =
        votosA > votosB ? la : votosB > votosA ? lb : 'Empate'
      marker.bindPopup(
        `<div style="font-family:system-ui,sans-serif;min-width:200px;padding:4px 0;">
          <strong style="font-size:13px;">${nomeE}</strong>
          <div style="margin-top:8px;font-size:12px;color:#374151;line-height:1.45;">
            <div><span style="color:#1d4ed8;font-weight:600;">${la}:</span> ${votosA.toLocaleString('pt-BR')}</div>
            <div><span style="color:#b45309;font-weight:600;">${lb}:</span> ${votosB.toLocaleString('pt-BR')}</div>
            <div style="margin-top:6px;color:#6b7280;font-size:11px;">Pico no mapa (soma): ${pctTot}% · ${lider}</div>
          </div>
        </div>`,
        { maxWidth: 300 }
      )
      marker.addTo(layerGroup)
    })

    const fixSize = () => map.invalidateSize()
    requestAnimationFrame(fixSize)
    const timer = window.setTimeout(fixSize, 200)

    return () => {
      window.clearTimeout(timer)
      map.remove()
    }
  }, [lookup, maxTotal, labelA, labelB])

  return (
    <div className="w-full overflow-hidden rounded-xl border border-card bg-background">
      <div className="border-b border-card px-3 py-2">
        <p className="text-sm font-semibold text-text-primary">{titulo}</p>
        {subtitulo && <p className="text-xs text-secondary mt-0.5">{subtitulo}</p>}
        <p className="text-[11px] text-secondary mt-1">
          {(municipiosPiaui as MunicipioCoord[]).length} municípios PI ·{' '}
          <span className="text-blue-700 font-medium">{labelA}</span>:{' '}
          {totais.a.toLocaleString('pt-BR')} ·{' '}
          <span className="text-amber-800 font-medium">{labelB}</span>: {totais.b.toLocaleString('pt-BR')}
        </p>
      </div>
      <div ref={mapRef} className={`w-full min-h-[320px] ${heightClass}`} />
      <div className="flex flex-wrap items-center gap-3 border-t border-card px-3 py-2 text-[10px] text-secondary">
        <span className="font-medium text-text-primary">Cor da bolha:</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-700" /> mais votos: {labelA}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-600" /> mais votos: {labelB}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-400" /> sem votos para ambos
        </span>
        <span className="text-text-secondary">| Tamanho ∝ soma dos votos dos dois no município</span>
      </div>
    </div>
  )
}
