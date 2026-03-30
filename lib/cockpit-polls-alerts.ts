import {
  normalizeMunicipioNome,
  type MediaIntencaoPorRegiao,
  type PesquisaLinhaPorRegiao,
} from '@/lib/piaui-regiao'

/** Tendência de intenção quando há 2+ pesquisas no mesmo município (região). */
export type CidadeTrendAlert = {
  cidadeLabel: string
  direcao: 'subiu' | 'caiu'
  de: number
  para: number
}

const DELTA_MINIMO_PONTOS = 0.55
const GAP_PONTOS_REGIAO_ABAIXO = 5.5

/**
 * Agrupa pesquisas por município (nome normalizado) e compara primeira × última
 * cronologicamente quando há pelo menos 2 registros.
 */
export function cidadeTrendAlertsParaRegiao(linhas: PesquisaLinhaPorRegiao[]): CidadeTrendAlert[] {
  const byCity = new Map<string, PesquisaLinhaPorRegiao[]>()
  for (const L of linhas) {
    const c = L.cidade?.trim()
    if (!c || c === 'Estado' || c === 'Cidade não encontrada') continue
    const k = normalizeMunicipioNome(c)
    if (!byCity.has(k)) byCity.set(k, [])
    byCity.get(k)!.push(L)
  }

  const out: CidadeTrendAlert[] = []
  for (const rows of byCity.values()) {
    if (rows.length < 2) continue
    const sorted = [...rows].sort((a, b) => a.dateOriginal.localeCompare(b.dateOriginal))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const d = last.intencao - first.intencao
    if (d >= DELTA_MINIMO_PONTOS) {
      out.push({
        cidadeLabel: first.cidade.trim(),
        direcao: 'subiu',
        de: first.intencao,
        para: last.intencao,
      })
    } else if (d <= -DELTA_MINIMO_PONTOS) {
      out.push({
        cidadeLabel: first.cidade.trim(),
        direcao: 'caiu',
        de: first.intencao,
        para: last.intencao,
      })
    }
  }

  out.sort((a, b) => Math.abs(b.para - b.de) - Math.abs(a.para - a.de))
  return out.slice(0, 2)
}

/** Média estadual ponderada pelo nº de pesquisas por região. */
export function mediaPonderadaEstado(medias: MediaIntencaoPorRegiao[]): number | null {
  const w = medias.filter((m) => m.n > 0)
  if (w.length === 0) return null
  const totN = w.reduce((s, m) => s + m.n, 0)
  if (totN <= 0) return null
  return w.reduce((s, m) => s + m.media * m.n, 0) / totN
}

/**
 * Região com média bem abaixo do restante do estado (≥2 regiões com dados).
 */
export function regiaoMuitoAbaixoDaMediaEstadual(
  mediaRegiao: number | undefined,
  medias: MediaIntencaoPorRegiao[]
): boolean {
  if (mediaRegiao === undefined || mediaRegiao === null) return false
  const comDados = medias.filter((m) => m.n > 0)
  if (comDados.length < 2) return false
  const ref = mediaPonderadaEstado(medias)
  if (ref === null) return false
  return mediaRegiao < ref - GAP_PONTOS_REGIAO_ABAIXO
}
