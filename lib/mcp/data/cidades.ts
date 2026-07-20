import municipiosPiaui from '@/lib/municipios-piaui.json'
import { buildCitySummariesFromDb } from '@/lib/territorio-liderancas-db'
import { normalizeIptMunicipio } from '@/lib/ipt'
import { getEleitoradoByCity } from '@/lib/eleitores'

export type CidadeMcpRow = {
  municipio: string
  expectativaLegado: number
  liderancas: number
  eleitorado: number | null
}

/**
 * Lista municípios do PI com expectativa (legado) e lideranças quando houver.
 * `q` filtra por nome; `minExpectativa` filtra pelo legado.
 */
export async function listarCidadesMcp(opts?: {
  q?: string
  minExpectativa?: number
  limite?: number
}): Promise<{ total: number; cidades: CidadeMcpRow[] }> {
  const limite = Math.min(Math.max(opts?.limite ?? 50, 1), 224)
  const q = opts?.q?.trim()
  const qNorm = q ? normalizeIptMunicipio(q) : ''
  const minExp = opts?.minExpectativa ?? 0

  const { summaries } = await buildCitySummariesFromDb()
  const nomes = (municipiosPiaui as Array<{ nome: string }>).map((m) => m.nome)

  const rows: CidadeMcpRow[] = []
  for (const nome of nomes) {
    const key = normalizeIptMunicipio(nome)
    if (qNorm && !key.includes(qNorm)) continue
    const summary = summaries.get(key)
    const expectativaLegado = Math.round(Number(summary?.expectativaLegadoVotos || 0))
    if (expectativaLegado < minExp) continue
    rows.push({
      municipio: nome,
      expectativaLegado,
      liderancas: Number(summary?.liderancas || 0),
      eleitorado: getEleitoradoByCity(nome),
    })
  }

  rows.sort(
    (a, b) =>
      b.expectativaLegado - a.expectativaLegado ||
      a.municipio.localeCompare(b.municipio, 'pt-BR')
  )

  return {
    total: rows.length,
    cidades: rows.slice(0, limite),
  }
}
