import { CANDIDATO_RESUMO_PESQUISAS } from '@/lib/resumo-operacional-pesquisas'
import { normalizeIptMunicipio, type IptPesquisaTopItem } from '@/lib/ipt'
import {
  buildCidadesIntencaoTopoMedia,
  type PollExecutiveInput,
} from '@/lib/pesquisa-tendencia-executive'

export type PollIptRow = {
  data: string
  tipo: 'estimulada' | 'espontanea'
  candidato_nome: string
  intencao: number
  instituto?: string
  cidade_id?: string | null
  cities?: { name?: string | null } | Array<{ name?: string | null }> | null
}

export type PesquisaIptPorMunicipio = {
  /** Média de intenção (%) do candidato foco — estimulada na cidade, senão espontânea. */
  intencaoPorMunicipio: Map<string, number>
  top5PorMunicipio: Map<string, IptPesquisaTopItem[]>
  basePorMunicipio: Map<string, 'estimulada' | 'espontanea'>
}

function nomeCidadePoll(poll: PollIptRow): string {
  const c = poll.cities
  if (!c) return ''
  if (Array.isArray(c)) return (c[0]?.name ?? '').trim()
  return (c.name ?? '').trim()
}

function candidatoNormalizado(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Mesmo candidato padrão da página Pesquisa (localStorage → Jadyel). */
export function resolveCandidatoIpt(): string {
  if (typeof window !== 'undefined') {
    const salvo = localStorage.getItem('candidatoPadraoPesquisa')?.trim()
    if (salvo) return salvo
  }
  return CANDIDATO_RESUMO_PESQUISAS
}

export type MediaEstimuladaIpt = {
  /** Média de intenção (%) por município — chave normalizada. */
  porMunicipio: Map<string, number>
  /** Média estadual de referência (média das médias municipais com dado). */
  mediaEstadual: number | null
}

function buildMediaPorMunicipioETipo(
  polls: PollIptRow[],
  candidato: string,
  tipo: 'estimulada' | 'espontanea'
): Map<string, number> {
  const alvo = candidatoNormalizado(candidato)
  const acum = new Map<string, { sum: number; count: number }>()

  for (const poll of polls) {
    if (poll.tipo !== tipo) continue
    if (candidatoNormalizado(poll.candidato_nome) !== alvo) continue
    if (!Number.isFinite(poll.intencao)) continue

    const cidade = nomeCidadePoll(poll)
    if (!cidade) continue

    const key = normalizeIptMunicipio(cidade)
    const cur = acum.get(key) ?? { sum: 0, count: 0 }
    cur.sum += poll.intencao
    cur.count += 1
    acum.set(key, cur)
  }

  const porMunicipio = new Map<string, number>()
  for (const [key, { sum, count }] of acum) {
    if (count <= 0) continue
    porMunicipio.set(key, Math.round((sum / count) * 10) / 10)
  }
  return porMunicipio
}

/**
 * Por município: estimulada quando houver linhas estimuladas na cidade;
 * caso contrário, média da espontânea (mesma regra do Panorama territorial).
 */
export function buildPesquisaIptPorMunicipio(
  polls: PollIptRow[],
  candidato: string
): PesquisaIptPorMunicipio {
  const cidades = buildCidadesIntencaoTopoMedia(pollsParaExecutive(polls))
  const mediaEst = buildMediaPorMunicipioETipo(polls, candidato, 'estimulada')
  const mediaEsp = buildMediaPorMunicipioETipo(polls, candidato, 'espontanea')

  const intencaoPorMunicipio = new Map<string, number>()
  const top5PorMunicipio = new Map<string, IptPesquisaTopItem[]>()
  const basePorMunicipio = new Map<string, 'estimulada' | 'espontanea'>()

  for (const row of cidades) {
    if (row.cidadeLabel.startsWith('Estado')) continue
    const key = normalizeIptMunicipio(row.cidadeLabel)

    const usaEstimulada = row.pesquisasDistintasEstimulada > 0
    const base: 'estimulada' | 'espontanea' = usaEstimulada ? 'estimulada' : 'espontanea'
    const top10 = usaEstimulada ? row.top10Estimulada : row.top10Espontanea
    if (top10.length === 0) continue

    basePorMunicipio.set(key, base)
    top5PorMunicipio.set(
      key,
      top10.slice(0, 5).map((c) => ({ nome: c.nome, mediaPct: c.mediaPct }))
    )

    const media = (usaEstimulada ? mediaEst : mediaEsp).get(key)
    if (media != null) intencaoPorMunicipio.set(key, media)
  }

  return { intencaoPorMunicipio, top5PorMunicipio, basePorMunicipio }
}

/** @deprecated Preferir `buildPesquisaIptPorMunicipio`. Mantido para compatibilidade. */
export function buildMediaEstimuladaPorMunicipio(
  polls: PollIptRow[],
  candidato: string
): MediaEstimuladaIpt {
  const { intencaoPorMunicipio } = buildPesquisaIptPorMunicipio(polls, candidato)
  const medias = [...intencaoPorMunicipio.values()]
  const mediaEstadual =
    medias.length > 0
      ? Math.round((medias.reduce((s, v) => s + v, 0) / medias.length) * 10) / 10
      : null
  return { porMunicipio: intencaoPorMunicipio, mediaEstadual }
}

function pollsParaExecutive(polls: PollIptRow[]): PollExecutiveInput[] {
  return polls.map((p) => ({
    data: p.data,
    tipo: p.tipo,
    candidato_nome: p.candidato_nome,
    intencao: p.intencao,
    instituto: p.instituto ?? '',
    cidadeId: p.cidade_id ?? null,
    cidadeNome: nomeCidadePoll(p) || null,
  }))
}

/** Top 5 por município — estimulada; senão espontânea. */
export function buildTop5EstimuladaPorMunicipio(polls: PollIptRow[]): Map<string, IptPesquisaTopItem[]> {
  return buildPesquisaIptPorMunicipio(polls, '').top5PorMunicipio
}

/** Posição (1–5) do candidato foco no ranking local do município. */
export function posicaoCandidatoNoTop5(
  top5: IptPesquisaTopItem[],
  candidato: string
): number | null {
  const alvo = candidatoNormalizado(candidato)
  const idx = top5.findIndex((c) => candidatoNormalizado(c.nome) === alvo)
  return idx >= 0 ? idx + 1 : null
}
