/**
 * Radar 224 — agrega top N municípios por Expectativa Legado + cruza com fontes.
 */

import { buildCitySummariesFromDb } from '@/lib/territorio-liderancas-db'
import {
  getTerritorioDesenvolvimentoPI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import { listRadarFontesSeed } from '@/lib/radar-224/fontes-seed'
import type {
  Radar224Resumo,
  RadarFonte,
  RadarMunicipioPrioritario,
} from '@/lib/radar-224/types'

export const RADAR_224_TOP_N = 50

function formatCityDisplay(key: string): string {
  return key
    .split(' ')
    .map((w) => {
      const lower = ['de', 'da', 'do', 'das', 'dos', 'e']
      if (lower.includes(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
    .replace(/^./, (s) => s.toUpperCase())
}

function normKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function fontesParaMunicipio(
  municipio: string,
  territorio: TerritorioDesenvolvimentoPI | null,
  fontes: RadarFonte[],
): { regionais: string[]; locais: string[] } {
  const key = normKey(municipio)
  const regionais: string[] = []
  const locais: string[] = []

  for (const f of fontes) {
    if (f.status === 'rejeitada' || f.status === 'pausada') continue
    const cobreMuni = f.municipiosPrioritarios.some((m) => normKey(m) === key)
    const cobreTd =
      territorio != null && f.territorios.some((td) => td === territorio)

    if (f.camada === 'regional' && (cobreMuni || cobreTd)) {
      regionais.push(f.nome)
    }
    if (f.camada === 'local' && cobreMuni) {
      locais.push(f.nome)
    }
  }

  return {
    regionais: [...new Set(regionais)],
    locais: [...new Set(locais)],
  }
}

export async function buildRadar224TopMunicipios(opts?: {
  topN?: number
  forceRefresh?: boolean
}): Promise<{
  municipios: RadarMunicipioPrioritario[]
  resumo: Radar224Resumo
  fontes: RadarFonte[]
}> {
  const topN = opts?.topN ?? RADAR_224_TOP_N
  const { summaries } = await buildCitySummariesFromDb(Boolean(opts?.forceRefresh))
  const fontes = listRadarFontesSeed()

  const ranked = [...summaries.entries()]
    .map(([key, summary]) => ({
      key,
      legado: Number(summary.expectativaLegadoVotos || 0),
      liderancas: Number(summary.liderancas || 0),
    }))
    .filter((r) => r.legado > 0)
    .sort((a, b) => b.legado - a.legado || a.key.localeCompare(b.key))

  const totalEstadoLegado = ranked.reduce((s, r) => s + r.legado, 0)
  const top = ranked.slice(0, topN)
  const topNLegado = top.reduce((s, r) => s + r.legado, 0)

  const municipios: RadarMunicipioPrioritario[] = top.map((row, index) => {
    const municipio = formatCityDisplay(row.key)
    const territorio = getTerritorioDesenvolvimentoPI(municipio)
    const cruzamento = fontesParaMunicipio(municipio, territorio, fontes)
    return {
      rank: index + 1,
      municipio,
      municipioNormalizado: row.key,
      expectativaLegado: Math.round(row.legado),
      pctEstado:
        totalEstadoLegado > 0
          ? Math.round((row.legado / totalEstadoLegado) * 1000) / 10
          : 0,
      territorio,
      liderancas: row.liderancas,
      fontesRegionais: cruzamento.regionais,
      fontesLocais: cruzamento.locais,
    }
  })

  const territoriosCobertos = new Set(
    municipios.map((m) => m.territorio).filter(Boolean),
  ).size

  const resumo: Radar224Resumo = {
    totalEstadoLegado: Math.round(totalEstadoLegado),
    topN,
    topNLegado: Math.round(topNLegado),
    topNPctEstado:
      totalEstadoLegado > 0
        ? Math.round((topNLegado / totalEstadoLegado) * 1000) / 10
        : 0,
    corteMinimoLegado: municipios[municipios.length - 1]?.expectativaLegado ?? 0,
    cidadesComExpectativa: ranked.length,
    fontesAtivas: fontes.filter((f) => f.status === 'ativa').length,
    fontesCandidatas: fontes.filter((f) => f.status === 'candidata').length,
    territoriosCobertos,
  }

  return { municipios, resumo, fontes }
}
