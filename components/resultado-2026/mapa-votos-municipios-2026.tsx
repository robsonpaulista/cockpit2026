'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { TseCarregando, TseErro, tseBotaoCinzaClass, tseBotaoIconeClass, tseCardClass } from '@/components/tse/tse-ui'
import type { MalhaMapaPIPayload } from '@/lib/geo-malha-pi'
import { formatarPct2026, formatarVotos2026, type MunicipioResumo2026 } from '@/lib/resultado-secao-2026'
import { fetchMalhaMunicipiosPI } from '@/lib/services/malha-pi'
import { cn } from '@/lib/utils'
import { nomeProprio } from './tse-ui'

type Ponto = [number, number]
type Anel = Ponto[]
type Forma = { chave: string; nome: string; d: string; cx: number; cy: number }

const LARGURA = 1000
const LARGURA_DICA = 240
const ZOOM_MIN = 1
const ZOOM_MAX = 6
const ZOOM_PASSO = 1.35
const COR_ZERO = '#EEEEEE'
const COR_BAIXA: [number, number, number] = [255, 248, 214] // yellow-soft TSE
const COR_ALTA: [number, number, number] = [235, 180, 2] // amarelo Jadyel / TSE #EBB402
const COR_ROTULO = '#333333'
const TAM_ROTULO = 8.5

type Camera = { zoom: number; x: number; y: number }

function limitarCamera(cam: Camera, altura: number): Camera {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.zoom))
  const vw = LARGURA / zoom
  const vh = altura / zoom
  const xMax = Math.max(0, LARGURA - vw)
  const yMax = Math.max(0, altura - vh)
  return {
    zoom,
    x: Math.min(xMax, Math.max(0, cam.x)),
    y: Math.min(yMax, Math.max(0, cam.y)),
  }
}

/** Zoom mantendo o ponto (px, py) do SVG sob o cursor. */
function zoomEm(cam: Camera, altura: number, fator: number, px: number, py: number): Camera {
  const proximo = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.zoom * fator))
  if (proximo === cam.zoom) return cam
  const vw = LARGURA / cam.zoom
  const vh = altura / cam.zoom
  const fracX = vw > 0 ? (px - cam.x) / vw : 0.5
  const fracY = vh > 0 ? (py - cam.y) / vh : 0.5
  const nvw = LARGURA / proximo
  const nvh = altura / proximo
  return limitarCamera({ zoom: proximo, x: px - fracX * nvw, y: py - fracY * nvh }, altura)
}

const chaveMunicipio = (nome: string): string =>
  nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

const ehPonto = (v: unknown): v is Ponto =>
  Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number'

const aneis = (v: unknown): Anel[] =>
  Array.isArray(v) ? v.filter((anel): anel is Anel => Array.isArray(anel) && anel.every(ehPonto)) : []

function poligonos(geometria: unknown): Anel[][] {
  if (!geometria || typeof geometria !== 'object') return []
  const { type, coordinates } = geometria as { type?: unknown; coordinates?: unknown }
  if (type === 'Polygon') return [aneis(coordinates)]
  if (type === 'MultiPolygon' && Array.isArray(coordinates)) return coordinates.map(aneis)
  return []
}

function mediaAnel(anel: Anel): Ponto {
  let sx = 0
  let sy = 0
  for (const [lon, lat] of anel) {
    sx += lon
    sy += lat
  }
  const n = anel.length || 1
  return [sx / n, sy / n]
}

function projetar(malha: MalhaMapaPIPayload): { formas: Forma[]; altura: number } {
  const geometrias = malha.municipios.features.map((f) => {
    const polys = poligonos(f.geometry)
    const centroide = f.properties.centroide
    const fallback = polys[0]?.[0] ? mediaAnel(polys[0][0]) : ([0, 0] as Ponto)
    return {
      nome: f.properties.nm_mun ?? '',
      poligonos: polys,
      centroide: centroide && ehPonto(centroide) ? centroide : fallback,
    }
  })
  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const g of geometrias)
    for (const p of g.poligonos)
      for (const anel of p)
        for (const [lon, lat] of anel) {
          minLon = Math.min(minLon, lon)
          maxLon = Math.max(maxLon, lon)
          minLat = Math.min(minLat, lat)
          maxLat = Math.max(maxLat, lat)
        }
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
  const escala = LARGURA / ((maxLon - minLon) * kx)
  const xNum = (lon: number) => (lon - minLon) * kx * escala
  const yNum = (lat: number) => (maxLat - lat) * escala
  const x = (lon: number) => xNum(lon).toFixed(1)
  const y = (lat: number) => yNum(lat).toFixed(1)
  const formas = geometrias.map((g) => ({
    chave: chaveMunicipio(g.nome),
    nome: g.nome,
    d: g.poligonos
      .flatMap((p) => p.map((anel) => `M${anel.map(([lon, lat]) => `${x(lon)},${y(lat)}`).join('L')}Z`))
      .join(''),
    cx: xNum(g.centroide[0]),
    cy: yNum(g.centroide[1]),
  }))
  return { formas, altura: Math.ceil((maxLat - minLat) * escala) }
}

/** Rótulo curto para caber no município (ex.: 12.345 → 12,3 mil). */
function rotuloVotos(n: number): string {
  if (n < 1000) return String(n)
  const mil = n / 1000
  return `${mil.toLocaleString('pt-BR', { maximumFractionDigits: mil >= 10 ? 0 : 1 })} mil`
}

/** Nome curto para o rótulo no mapa. */
function rotuloNome(nome: string, max = 14): string {
  const n = nomeProprio(nome)
  if (n.length <= max) return n
  return `${n.slice(0, Math.max(1, max - 1))}…`
}

function misturar(a: [number, number, number], b: [number, number, number], t: number): string {
  const u = Math.min(1, Math.max(0, t))
  const r = Math.round(a[0] + (b[0] - a[0]) * u)
  const g = Math.round(a[1] + (b[1] - a[1]) * u)
  const bl = Math.round(a[2] + (b[2] - a[2]) * u)
  return `rgb(${r},${g},${bl})`
}

function corVotos(votos: number, max: number): string {
  if (votos <= 0 || max <= 0) return COR_ZERO
  return misturar(COR_BAIXA, COR_ALTA, Math.sqrt(votos / max))
}

export function MapaVotosMunicipios2026({
  linhas,
  candidatoNome,
  busca,
  onAbrirMunicipio,
}: {
  linhas: MunicipioResumo2026[]
  candidatoNome: string
  busca: string
  onAbrirMunicipio: (codigo: string) => void
}) {
  const [malha, setMalha] = useState<MalhaMapaPIPayload | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [hover, setHover] = useState<{ chave: string; x: number; y: number } | null>(null)
  const [camera, setCamera] = useState<Camera>({ zoom: 1, x: 0, y: 0 })
  const [arrasto, setArrasto] = useState<{ sx: number; sy: number; cx: number; cy: number } | null>(null)
  const arrastouRef = useRef<boolean>(false)
  const mapaRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let ativo = true
    fetchMalhaMunicipiosPI()
      .then((m) => {
        if (ativo) setMalha(m)
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Erro ao carregar o mapa')
      })
    return () => {
      ativo = false
    }
  }, [])

  const porChave = useMemo(() => {
    const map = new Map<string, MunicipioResumo2026>()
    for (const linha of linhas) map.set(chaveMunicipio(linha.nome), linha)
    return map
  }, [linhas])

  const maxVotos = useMemo(() => linhas.reduce((m, l) => Math.max(m, l.votos), 0), [linhas])
  const mapa = useMemo(() => (malha ? projetar(malha) : null), [malha])
  const termo = busca.trim()
  const termoNorm = termo ? chaveMunicipio(termo) : ''

  const pontoSvg = (clientX: number, clientY: number): { px: number; py: number } | null => {
    const svg = svgRef.current
    if (!svg) return null
    const caixa = svg.getBoundingClientRect()
    if (caixa.width <= 0 || caixa.height <= 0) return null
    const vw = LARGURA / camera.zoom
    const vh = (mapa?.altura ?? 1) / camera.zoom
    return {
      px: camera.x + ((clientX - caixa.left) / caixa.width) * vw,
      py: camera.y + ((clientY - caixa.top) / caixa.height) * vh,
    }
  }

  const moverMouse = (e: ReactMouseEvent, chave: string) => {
    if (arrasto) return
    const caixa = mapaRef.current?.getBoundingClientRect()
    if (!caixa) return
    const x = e.clientX - caixa.left + 14
    setHover({ chave, x: Math.min(x, Math.max(0, caixa.width - LARGURA_DICA)), y: e.clientY - caixa.top + 14 })
  }

  const rodarRoda = (e: ReactWheelEvent) => {
    e.preventDefault()
    if (!mapa) return
    const ponto = pontoSvg(e.clientX, e.clientY)
    if (!ponto) return
    const fator = e.deltaY < 0 ? ZOOM_PASSO : 1 / ZOOM_PASSO
    setCamera((c) => zoomEm(c, mapa.altura, fator, ponto.px, ponto.py))
  }

  if (erro) return <TseErro>{erro}</TseErro>
  if (!mapa) return <TseCarregando texto="Carregando mapa do Piauí…" />

  const cam = limitarCamera(camera, mapa.altura)
  const vw = LARGURA / cam.zoom
  const vh = mapa.altura / cam.zoom
  const linhaHover = hover ? porChave.get(hover.chave) : undefined
  const nomeHover = hover ? mapa.formas.find((f) => f.chave === hover.chave)?.nome : undefined
  const escalaRotulo = 1 / Math.sqrt(cam.zoom)

  const zoomBotao = (fator: number) => {
    setCamera((c) => zoomEm(c, mapa.altura, fator, c.x + LARGURA / c.zoom / 2, c.y + mapa.altura / c.zoom / 2))
  }

  return (
    <section className={`${tseCardClass} mt-3`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">Votos por município · {nomeProprio(candidatoNome)}</h2>
          <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">
            Intensidade = votos · rótulo = município + votos · role a roda ou use +/− · arraste · clique
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-[11px] text-[var(--tse-muted)]">
            <span>Menos</span>
            <span
              className="h-2.5 w-28 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${COR_ZERO}, ${misturar(COR_BAIXA, COR_ALTA, 0.35)}, ${misturar(COR_BAIXA, COR_ALTA, 1)})`,
              }}
              aria-hidden
            />
            <span>Mais</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => zoomBotao(1 / ZOOM_PASSO)}
              disabled={cam.zoom <= ZOOM_MIN}
              className={cn(tseBotaoCinzaClass, 'disabled:opacity-40')}
              title="Afastar"
              aria-label="Afastar mapa"
            >
              <Minus className={tseBotaoIconeClass} />
            </button>
            <span className="min-w-[3.25rem] text-center text-[12px] font-bold tabular-nums">
              {Math.round(cam.zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => zoomBotao(ZOOM_PASSO)}
              disabled={cam.zoom >= ZOOM_MAX}
              className={cn(tseBotaoCinzaClass, 'disabled:opacity-40')}
              title="Aproximar"
              aria-label="Aproximar mapa"
            >
              <Plus className={tseBotaoIconeClass} />
            </button>
            <button
              type="button"
              onClick={() => setCamera({ zoom: 1, x: 0, y: 0 })}
              disabled={cam.zoom === 1 && cam.x === 0 && cam.y === 0}
              className={cn(tseBotaoCinzaClass, 'disabled:opacity-40')}
              title="Resetar zoom"
              aria-label="Resetar zoom do mapa"
            >
              <RotateCcw className={tseBotaoIconeClass} />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={mapaRef}
        className="relative mt-3 h-[min(78vh,880px)] w-full overflow-hidden rounded-lg"
        onMouseLeave={() => {
          setHover(null)
          setArrasto(null)
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`${cam.x} ${cam.y} ${vw} ${vh}`}
          preserveAspectRatio="xMidYMid meet"
          className={cn(
            'absolute inset-0 h-full w-full touch-none',
            arrasto ? 'cursor-grabbing' : cam.zoom > 1 ? 'cursor-grab' : 'cursor-default',
          )}
          role="img"
          aria-label={`Mapa do Piauí com votos de ${candidatoNome} por município`}
          onWheel={rodarRoda}
          onMouseDown={(e) => {
            if (e.button !== 0 || cam.zoom <= 1) return
            arrastouRef.current = false
            setArrasto({ sx: e.clientX, sy: e.clientY, cx: cam.x, cy: cam.y })
            setHover(null)
          }}
          onMouseMove={(e) => {
            if (!arrasto || !mapa) return
            const caixa = svgRef.current?.getBoundingClientRect()
            if (!caixa || caixa.width <= 0 || caixa.height <= 0) return
            if (Math.abs(e.clientX - arrasto.sx) > 3 || Math.abs(e.clientY - arrasto.sy) > 3) {
              arrastouRef.current = true
            }
            const dx = ((e.clientX - arrasto.sx) / caixa.width) * (LARGURA / cam.zoom)
            const dy = ((e.clientY - arrasto.sy) / caixa.height) * (mapa.altura / cam.zoom)
            setCamera(limitarCamera({ zoom: cam.zoom, x: arrasto.cx - dx, y: arrasto.cy - dy }, mapa.altura))
          }}
          onMouseUp={() => setArrasto(null)}
        >
          {mapa.formas.map((f) => {
            const linha = porChave.get(f.chave)
            const votos = linha?.votos ?? 0
            const foraBusca = termoNorm.length > 0 && !f.chave.includes(termoNorm)
            return (
              <path
                key={f.chave}
                d={f.d}
                fill={foraBusca ? '#F4F4F2' : corVotos(votos, maxVotos)}
                stroke="#FFFFFF"
                strokeWidth={0.8 / Math.sqrt(cam.zoom)}
                className={linha && !arrasto ? 'cursor-pointer' : undefined}
                onMouseMove={(e) => moverMouse(e, f.chave)}
                onClick={() => {
                  if (arrastouRef.current || !linha) return
                  onAbrirMunicipio(linha.codigo)
                }}
              />
            )
          })}
          {mapa.formas.map((f) => {
            const linha = porChave.get(f.chave)
            const votos = linha?.votos ?? 0
            if (votos <= 0) return null
            const foraBusca = termoNorm.length > 0 && !f.chave.includes(termoNorm)
            if (foraBusca) return null
            const fs = TAM_ROTULO * escalaRotulo
            return (
              <text
                key={`rotulo-${f.chave}`}
                x={f.cx}
                y={f.cy}
                textAnchor="middle"
                dominantBaseline="central"
                fill={COR_ROTULO}
                stroke="#FFFFFF"
                strokeWidth={1.8 * escalaRotulo}
                paintOrder="stroke"
                fontSize={fs}
                className="pointer-events-none select-none"
                style={{ fontFamily: 'var(--font-sans), system-ui, sans-serif' }}
              >
                <tspan x={f.cx} dy="-0.55em" fontSize={fs} fontWeight={600}>
                  {rotuloNome(f.nome)}
                </tspan>
                <tspan x={f.cx} dy="1.2em" fontSize={fs} fontWeight={700}>
                  {rotuloVotos(votos)}
                </tspan>
              </text>
            )
          })}
        </svg>

        {hover && !arrasto ? (
          <div
            className="pointer-events-none absolute z-10 rounded-lg bg-white p-3 text-[12px] shadow-lg ring-1 ring-black/5"
            style={{ left: hover.x, top: hover.y, width: LARGURA_DICA - 10 }}
          >
            <p className="font-bold uppercase">{nomeProprio(nomeHover ?? hover.chave)}</p>
            {linhaHover ? (
              <dl className="mt-1.5 space-y-0.5 text-[var(--tse-muted)]">
                <div className="flex justify-between gap-3">
                  <dt>Votos</dt>
                  <dd className="font-bold tabular-nums text-[var(--tse-text)]">
                    {formatarVotos2026(linhaHover.votos)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>% do total</dt>
                  <dd className="tabular-nums text-[var(--tse-text)]">{formatarPct2026(linhaHover.pctTotal)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Locais</dt>
                  <dd className="tabular-nums text-[var(--tse-text)]">{formatarVotos2026(linhaHover.locais)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-1 text-[var(--tse-muted)]">Sem votos nominais deste candidato</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
