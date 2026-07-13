import { CANDIDATO_RESUMO_PESQUISAS } from '@/lib/resumo-operacional-pesquisas'
import {
  classificarEvolucaoPesquisaPp,
  type IptEvolucao,
} from '@/lib/ipt-evolucao'
import { normalizeIptMunicipio, type IptPesquisaTopItem } from '@/lib/ipt'
import {
  buildCidadesIntencaoTopoMedia,
  chavePesquisaDistinta,
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
  /** Comparativo onda mais recente vs anterior (mesmo tipo/base da cidade). */
  evolucaoPorMunicipio: Map<string, PesquisaIptEvolucaoMunicipio>
}

export type PesquisaIptEvolucaoMunicipio = {
  mediaPct: number
  recentePct: number | null
  anteriorPct: number | null
  deltaPp: number | null
  evolucao: IptEvolucao
  ondasComparadas: number
  dataRecente: string | null
  dataAnterior: string | null
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
 * Por município: preferir estimulada; se não houver estimulada (ou top vazio),
 * usar espontânea — para ampliar cobertura no mapa IPT.
 *
 * A intenção exibida é **média aritmética de todas as linhas** do candidato nesse tipo
 * (não só a última onda). Em paralelo, calcula evolução última onda vs penúltima.
 */
export function buildPesquisaIptPorMunicipio(
  polls: PollIptRow[],
  candidato: string
): PesquisaIptPorMunicipio {
  const cidades = buildCidadesIntencaoTopoMedia(pollsParaExecutive(polls))
  const mediaEst = buildMediaPorMunicipioETipo(polls, candidato, 'estimulada')
  const mediaEsp = buildMediaPorMunicipioETipo(polls, candidato, 'espontanea')
  const evolucaoEst = buildEvolucaoOndasPorMunicipio(polls, candidato, 'estimulada')
  const evolucaoEsp = buildEvolucaoOndasPorMunicipio(polls, candidato, 'espontanea')

  const intencaoPorMunicipio = new Map<string, number>()
  const top5PorMunicipio = new Map<string, IptPesquisaTopItem[]>()
  const basePorMunicipio = new Map<string, 'estimulada' | 'espontanea'>()
  const evolucaoPorMunicipio = new Map<string, PesquisaIptEvolucaoMunicipio>()

  for (const row of cidades) {
    if (row.cidadeLabel.startsWith('Estado')) continue
    const key = normalizeIptMunicipio(row.cidadeLabel)
    if (!key) continue

    const temEstimulada =
      row.pesquisasDistintasEstimulada > 0 && row.top10Estimulada.length > 0
    const temEspontanea =
      row.pesquisasDistintasEspontanea > 0 && row.top10Espontanea.length > 0

    // Estimulada quando existir; senão espontânea.
    const base: 'estimulada' | 'espontanea' | null = temEstimulada
      ? 'estimulada'
      : temEspontanea
        ? 'espontanea'
        : null
    if (base == null) continue

    const top10 = base === 'estimulada' ? row.top10Estimulada : row.top10Espontanea
    basePorMunicipio.set(key, base)
    top5PorMunicipio.set(
      key,
      top10.slice(0, 5).map((c) => ({ nome: c.nome, mediaPct: c.mediaPct }))
    )

    const media = (base === 'estimulada' ? mediaEst : mediaEsp).get(key)
    // Se a média do candidato não veio no tipo da base, tenta o outro tipo
    // (ex.: ranking estimulada sem linha do foco → espontânea com o candidato).
    const mediaDoTop = top10.find(
      (c) => candidatoNormalizado(c.nome) === candidatoNormalizado(candidato)
    )?.mediaPct
    const mediaFallback =
      media ??
      (base === 'estimulada' ? mediaEsp.get(key) : mediaEst.get(key)) ??
      mediaDoTop ??
      null
    if (mediaFallback != null) intencaoPorMunicipio.set(key, mediaFallback)

    const evo = (base === 'estimulada' ? evolucaoEst : evolucaoEsp).get(key)
    // Evolução: se a base não tem 2 ondas, usa o outro tipo quando houver comparativo.
    const evoAlt = (base === 'estimulada' ? evolucaoEsp : evolucaoEst).get(key)
    const evoUsavel =
      evo && evo.anteriorPct != null
        ? evo
        : evoAlt && evoAlt.anteriorPct != null
          ? evoAlt
          : evo ?? evoAlt ?? null

    // Com pesquisa na cidade: sempre classifica (1 onda → estável).
    const mediaPct = mediaFallback ?? mediaDoTop ?? top10[0]?.mediaPct ?? 0
    if (evoUsavel) {
      evolucaoPorMunicipio.set(key, {
        ...evoUsavel,
        mediaPct,
        evolucao: classificarEvolucaoPesquisaPp(evoUsavel.recentePct, evoUsavel.anteriorPct),
      })
    } else {
      evolucaoPorMunicipio.set(key, {
        mediaPct,
        recentePct: mediaPct,
        anteriorPct: null,
        deltaPp: null,
        evolucao: 'estavel',
        ondasComparadas: 1,
        dataRecente: null,
        dataAnterior: null,
      })
    }
  }

  return { intencaoPorMunicipio, top5PorMunicipio, basePorMunicipio, evolucaoPorMunicipio }
}

/**
 * Últimas duas ondas distintas (data|instituto|cidade) do candidato no tipo informado.
 * Intenção por onda = média das linhas daquela onda.
 */
function buildEvolucaoOndasPorMunicipio(
  polls: PollIptRow[],
  candidato: string,
  tipo: 'estimulada' | 'espontanea'
): Map<string, Omit<PesquisaIptEvolucaoMunicipio, 'mediaPct'>> {
  const alvo = candidatoNormalizado(candidato)
  const porMun = new Map<string, Map<string, { sum: number; count: number; data: string }>>()

  for (const poll of polls) {
    if (poll.tipo !== tipo) continue
    if (candidatoNormalizado(poll.candidato_nome) !== alvo) continue
    if (!Number.isFinite(poll.intencao)) continue
    const cidade = nomeCidadePoll(poll)
    if (!cidade) continue

    const munKey = normalizeIptMunicipio(cidade)
    const executive: PollExecutiveInput = {
      data: poll.data,
      tipo: poll.tipo,
      candidato_nome: poll.candidato_nome,
      intencao: poll.intencao,
      instituto: poll.instituto ?? '',
      cidadeId: poll.cidade_id ?? null,
      cidadeNome: cidade,
    }
    const ondaKey = chavePesquisaDistinta(executive)
    const ondas = porMun.get(munKey) ?? new Map()
    const cur = ondas.get(ondaKey) ?? {
      sum: 0,
      count: 0,
      data: poll.data.includes('T') ? (poll.data.split('T')[0] ?? poll.data) : poll.data,
    }
    cur.sum += poll.intencao
    cur.count += 1
    ondas.set(ondaKey, cur)
    porMun.set(munKey, ondas)
  }

  const out = new Map<string, Omit<PesquisaIptEvolucaoMunicipio, 'mediaPct'>>()
  for (const [munKey, ondas] of porMun) {
    const lista = [...ondas.entries()]
      .map(([chave, v]) => ({
        chave,
        pct: Math.round((v.sum / v.count) * 10) / 10,
        data: v.data,
      }))
      .sort((a, b) => a.data.localeCompare(b.data) || a.chave.localeCompare(b.chave))

    if (lista.length === 0) continue
    const recente = lista[lista.length - 1]!
    const anterior = lista.length >= 2 ? lista[lista.length - 2]! : null
    const deltaPp =
      anterior != null ? Math.round((recente.pct - anterior.pct) * 10) / 10 : null

    out.set(munKey, {
      recentePct: recente.pct,
      anteriorPct: anterior?.pct ?? null,
      deltaPp,
      evolucao: classificarEvolucaoPesquisaPp(recente.pct, anterior?.pct ?? null),
      ondasComparadas: lista.length,
      dataRecente: recente.data,
      dataAnterior: anterior?.data ?? null,
    })
  }
  return out
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
