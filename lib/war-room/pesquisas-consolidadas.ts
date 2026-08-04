import { redistribuirSobreVotosValidos } from '@/lib/espontanea-normalize'
import { normalizeIptMunicipio } from '@/lib/ipt'
import {
  chavePesquisaDistinta,
  type PollExecutiveInput,
} from '@/lib/pesquisa-tendencia-executive'
import type { PollIptRow } from '@/lib/ipt-pesquisa'

export type WarRoomPesquisaRankingItem = {
  nome: string
  pct: number
}

export type WarRoomPesquisaConsolidadaReal = {
  id: string
  cidade: string
  instituto: string
  data: string
  dataLabel: string
  cenario: 'Estimulada' | 'Espontânea'
  jadyelPct: number | null
  /** Posição do candidato foco no ranking da onda (1 = líder). */
  jadyelPosicao: number | null
  /**
   * Candidato foco ausente na onda (ex.: espontânea sem menção).
   * UI: badge "NP" · 0% — não confundir com município sem pesquisa.
   */
  jadyelNaoPontuou: boolean
  liderPct: number
  liderNome: string
  diferencaPp: number | null
  /** Ranking completo da onda, % desc. */
  ranking: WarRoomPesquisaRankingItem[]
}

function candidatoNormalizado(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function dataCurta(data: string): string {
  return data.includes('T') ? (data.split('T')[0] ?? data) : data
}

function formatDataLabel(isoDate: string): string {
  const parts = dataCurta(isoDate).split('-')
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}`
  }
  return isoDate
}

function nomeCidadePoll(poll: PollIptRow): string {
  const c = poll.cities
  if (!c) return ''
  if (Array.isArray(c)) return (c[0]?.name ?? '').trim()
  return (c.name ?? '').trim()
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

type OndaBucket = {
  cidade: string
  data: string
  instituto: string
  tipo: 'estimulada' | 'espontanea'
  linhas: Array<{ nome: string; intencao: number }>
}

type OndaValida = OndaBucket & {
  ondaKey: string
  ranking: WarRoomPesquisaRankingItem[]
  liderNome: string
  liderPct: number
}

/**
 * Ondas consolidadas da War Room (alinhado ao IPT):
 * - só conta onda com ≥1 candidato ativo após redistribuir sobre válidos;
 * - prefere estimulada na mesma chave cidade+data+instituto;
 * - espontânea só entra em município sem nenhuma estimulada válida;
 * - candidato foco ausente na onda = não pontuou (0% · NP).
 */
export function buildWarRoomPesquisasConsolidadas(
  polls: PollIptRow[],
  candidato: string,
  limit = 20,
): WarRoomPesquisaConsolidadaReal[] {
  const candidatoNorm = candidatoNormalizado(candidato)
  if (!candidatoNorm) return []

  const buildForTipo = (tipo: 'estimulada' | 'espontanea') => {
    const bruto = new Map<string, OndaBucket>()
    for (const poll of polls) {
      if (poll.tipo !== tipo) continue
      if (!Number.isFinite(poll.intencao)) continue
      const cidade = nomeCidadePoll(poll)
      if (!cidade) continue

      const executive: PollExecutiveInput = {
        data: poll.data,
        tipo: poll.tipo,
        candidato_nome: poll.candidato_nome,
        intencao: poll.intencao,
        instituto: poll.instituto ?? '',
        cidadeId: poll.cidade_id ?? null,
        cidadeNome: cidade,
      }
      const ondaKey = `${tipo}::${chavePesquisaDistinta(executive)}`
      const bucket = bruto.get(ondaKey) ?? {
        cidade,
        data: dataCurta(poll.data),
        instituto: (poll.instituto ?? '').trim() || '—',
        tipo,
        linhas: [],
      }
      if (!bucket.instituto || bucket.instituto === '—') {
        const inst = (poll.instituto ?? '').trim()
        if (inst) bucket.instituto = inst
      }
      bucket.linhas.push({
        nome: poll.candidato_nome,
        intencao: poll.intencao,
      })
      bruto.set(ondaKey, bucket)
    }

    const validas: OndaValida[] = []
    for (const [ondaKey, bucket] of bruto) {
      const redis = redistribuirSobreVotosValidos(bucket.linhas)
      if (redis.ativos.length === 0) continue

      const porCandidato = new Map<string, { nome: string; pct: number }>()
      for (const a of redis.ativos) {
        const nk = candidatoNormalizado(a.nome)
        const prev = porCandidato.get(nk)
        if (prev) {
          porCandidato.set(nk, {
            nome: prev.nome,
            pct: round1((prev.pct + a.intencao) / 2),
          })
        } else {
          porCandidato.set(nk, { nome: a.nome, pct: round1(a.intencao) })
        }
      }

      let liderNome = ''
      let liderPct = -1
      for (const row of porCandidato.values()) {
        if (row.pct > liderPct) {
          liderPct = row.pct
          liderNome = row.nome
        }
      }
      if (liderPct < 0) continue

      const ranking = [...porCandidato.values()].sort((a, b) => {
        if (b.pct !== a.pct) return b.pct - a.pct
        return a.nome.localeCompare(b.nome, 'pt-BR')
      })

      validas.push({
        ...bucket,
        ondaKey,
        ranking,
        liderNome,
        liderPct: round1(liderPct),
      })
    }
    return validas
  }

  const estimuladas = buildForTipo('estimulada')
  const espontaneas = buildForTipo('espontanea')

  /** Chave cidade+data+instituto — evita duplicar espontânea se já há estimulada. */
  const chaveSemTipo = (b: OndaBucket) =>
    `${normalizeIptMunicipio(b.cidade)}|${b.data}|${candidatoNormalizado(b.instituto)}`

  const escolhidas = new Map<string, OndaValida>()
  for (const bucket of estimuladas) {
    escolhidas.set(chaveSemTipo(bucket), bucket)
  }
  for (const bucket of espontaneas) {
    const key = chaveSemTipo(bucket)
    if (!escolhidas.has(key)) escolhidas.set(key, bucket)
  }

  /** Municípios com ≥1 estimulada válida: espontânea só preenche onde não há. */
  const cidadesComEstimulada = new Set<string>()
  for (const bucket of escolhidas.values()) {
    if (bucket.tipo !== 'estimulada') continue
    const cidadeKey = normalizeIptMunicipio(bucket.cidade)
    if (cidadeKey) cidadesComEstimulada.add(cidadeKey)
  }
  for (const [key, bucket] of [...escolhidas.entries()]) {
    if (bucket.tipo !== 'espontanea') continue
    const cidadeKey = normalizeIptMunicipio(bucket.cidade)
    if (cidadeKey && cidadesComEstimulada.has(cidadeKey)) {
      escolhidas.delete(key)
    }
  }

  const rows: WarRoomPesquisaConsolidadaReal[] = []
  for (const bucket of escolhidas.values()) {
    const jadyelPosicaoIdx = bucket.ranking.findIndex(
      (row) => candidatoNormalizado(row.nome) === candidatoNorm,
    )
    const jadyelNaoPontuou = jadyelPosicaoIdx < 0
    const jadyelPct = jadyelNaoPontuou
      ? 0
      : (bucket.ranking[jadyelPosicaoIdx]?.pct ?? 0)
    const jadyelPosicao = jadyelNaoPontuou ? null : jadyelPosicaoIdx + 1
    const diferencaPp = round1(jadyelPct - bucket.liderPct)

    rows.push({
      id: bucket.ondaKey,
      cidade: bucket.cidade,
      instituto: bucket.instituto,
      data: bucket.data,
      dataLabel: formatDataLabel(bucket.data),
      cenario: bucket.tipo === 'estimulada' ? 'Estimulada' : 'Espontânea',
      jadyelPct,
      jadyelPosicao,
      jadyelNaoPontuou,
      liderPct: bucket.liderPct,
      liderNome: bucket.liderNome,
      diferencaPp,
      ranking: bucket.ranking,
    })
  }

  rows.sort((a, b) => {
    const byDate = b.data.localeCompare(a.data)
    if (byDate !== 0) return byDate
    return a.cidade.localeCompare(b.cidade, 'pt-BR')
  })

  if (!Number.isFinite(limit) || limit <= 0) return rows
  return rows.slice(0, Math.max(1, limit))
}

/**
 * Última onda por município (data desc). Mesmo critério do card
 * Pesquisas eleitorais / alertas fora do top 5.
 */
export function mapUltimaPesquisaPorMunicipio(
  rows: WarRoomPesquisaConsolidadaReal[],
): Map<string, WarRoomPesquisaConsolidadaReal> {
  const sorted = [...rows].sort((a, b) => {
    const byDate = b.data.localeCompare(a.data)
    if (byDate !== 0) return byDate
    return a.cidade.localeCompare(b.cidade, 'pt-BR')
  })

  const latest = new Map<string, WarRoomPesquisaConsolidadaReal>()
  for (const row of sorted) {
    const cidadeKey = normalizeIptMunicipio(row.cidade)
    if (!cidadeKey || latest.has(cidadeKey)) continue
    latest.set(cidadeKey, row)
  }
  return latest
}

export type WarRoomPesquisaParMunicipio = {
  ultima: WarRoomPesquisaConsolidadaReal
  anterior: WarRoomPesquisaConsolidadaReal | null
}

export type WarRoomPesquisaTendencia = 'alta' | 'baixa' | 'estavel' | null

/** Tolerância (pp) para considerar % estável entre ondas. */
export const WR_PESQUISA_TENDENCIA_TOL_PP = 0.5

/**
 * Última e penúltima onda por município (data desc).
 * Penúltima = próxima pesquisa com data diferente da última.
 */
export function mapUltimasDuasPesquisasPorMunicipio(
  rows: WarRoomPesquisaConsolidadaReal[],
): Map<string, WarRoomPesquisaParMunicipio> {
  const sorted = [...rows].sort((a, b) => {
    const byDate = b.data.localeCompare(a.data)
    if (byDate !== 0) return byDate
    return a.cidade.localeCompare(b.cidade, 'pt-BR')
  })

  const byCity = new Map<string, WarRoomPesquisaParMunicipio>()
  for (const row of sorted) {
    const cidadeKey = normalizeIptMunicipio(row.cidade)
    if (!cidadeKey) continue
    const cur = byCity.get(cidadeKey)
    if (!cur) {
      byCity.set(cidadeKey, { ultima: row, anterior: null })
      continue
    }
    if (cur.anterior) continue
    if (row.data === cur.ultima.data) continue
    byCity.set(cidadeKey, { ultima: cur.ultima, anterior: row })
  }
  return byCity
}

/** Tendência do % do candidato foco: última vs anterior. */
export function tendenciaPctPesquisa(
  pctUltima: number | null | undefined,
  pctAnterior: number | null | undefined,
  tolPp: number = WR_PESQUISA_TENDENCIA_TOL_PP,
): WarRoomPesquisaTendencia {
  if (
    pctUltima == null ||
    pctAnterior == null ||
    !Number.isFinite(pctUltima) ||
    !Number.isFinite(pctAnterior)
  ) {
    return null
  }
  const delta = pctUltima - pctAnterior
  if (Math.abs(delta) <= tolPp) return 'estavel'
  return delta > 0 ? 'alta' : 'baixa'
}
