import { CANDIDATO_RESUMO_PESQUISAS } from '@/lib/resumo-operacional-pesquisas'
import {
  classificarEvolucaoPesquisaPp,
  type IptEvolucao,
} from '@/lib/ipt-evolucao'
import { redistribuirSobreVotosValidos } from '@/lib/espontanea-normalize'
import { normalizeIptMunicipio, type IptPesquisaComposicao, type IptPesquisaTopItem } from '@/lib/ipt'
import {
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
  /** Metadados das ondas que entram na média do Top 5. */
  composicaoPorMunicipio: Map<string, IptPesquisaComposicao>
}

export type PesquisaIptEvolucaoMunicipio = {
  /** Média do candidato foco; null quando ele não aparece nas ondas (ex.: fora do Top 5). */
  mediaPct: number | null
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

function dataCurta(data: string): string {
  return data.includes('T') ? (data.split('T')[0] ?? data) : data
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
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

type OndaMunicipio = {
  chave: string
  data: string
  instituto: string
  /** % sobre válidos por candidato normalizado. */
  porCandidato: Map<string, { nome: string; pct: number }>
  residuosPct: number
}

/**
 * Agrupa linhas por município → onda e redistribui cada onda sobre votos válidos
 * (exclui nenhum/branco/nulo + não sei/NS-NR).
 */
function buildOndasValidosPorMunicipio(
  polls: PollIptRow[],
  tipo: 'estimulada' | 'espontanea'
): Map<string, OndaMunicipio[]> {
  type BucketLinha = { nome: string; intencao: number }
  const bruto = new Map<
    string,
    Map<string, { data: string; instituto: string; linhas: BucketLinha[] }>
  >()

  for (const poll of polls) {
    if (poll.tipo !== tipo) continue
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
    const ondas = bruto.get(munKey) ?? new Map()
    const bucket = ondas.get(ondaKey) ?? {
      data: dataCurta(poll.data),
      instituto: (poll.instituto ?? '').trim(),
      linhas: [],
    }
    if (!bucket.instituto && poll.instituto) {
      bucket.instituto = poll.instituto.trim()
    }
    bucket.linhas.push({
      nome: poll.candidato_nome,
      intencao: poll.intencao,
    })
    ondas.set(ondaKey, bucket)
    bruto.set(munKey, ondas)
  }

  const out = new Map<string, OndaMunicipio[]>()
  for (const [munKey, ondas] of bruto) {
    const lista: OndaMunicipio[] = []
    for (const [chave, bucket] of ondas) {
      const redis = redistribuirSobreVotosValidos(bucket.linhas)
      if (redis.ativos.length === 0) continue
      const porCandidato = new Map<string, { nome: string; pct: number }>()
      for (const a of redis.ativos) {
        const nk = candidatoNormalizado(a.nome)
        const prev = porCandidato.get(nk)
        // Mesma onda pode ter duplicata de nome: média simples.
        if (prev) {
          porCandidato.set(nk, {
            nome: prev.nome,
            pct: round1((prev.pct + a.intencao) / 2),
          })
        } else {
          porCandidato.set(nk, { nome: a.nome, pct: a.intencao })
        }
      }
      lista.push({
        chave,
        data: bucket.data,
        instituto: bucket.instituto,
        porCandidato,
        residuosPct: redis.residuosPct,
      })
    }
    lista.sort((a, b) => a.data.localeCompare(b.data) || a.chave.localeCompare(b.chave))
    if (lista.length > 0) out.set(munKey, lista)
  }
  return out
}

function mediaCandidatoNasOndas(
  ondas: OndaMunicipio[],
  candidatoNorm: string
): number | null {
  let sum = 0
  let count = 0
  for (const onda of ondas) {
    const row = onda.porCandidato.get(candidatoNorm)
    if (!row) continue
    sum += row.pct
    count += 1
  }
  if (count <= 0) return null
  return round1(sum / count)
}

function top5MediasNasOndas(ondas: OndaMunicipio[]): IptPesquisaTopItem[] {
  const agg = new Map<string, { nome: string; sum: number; count: number }>()
  for (const onda of ondas) {
    for (const [nk, row] of onda.porCandidato) {
      const cur = agg.get(nk) ?? { nome: row.nome, sum: 0, count: 0 }
      cur.sum += row.pct
      cur.count += 1
      agg.set(nk, cur)
    }
  }
  return [...agg.values()]
    .map((c) => ({
      nome: c.nome,
      mediaPct: c.count > 0 ? round1(c.sum / c.count) : 0,
    }))
    .sort((a, b) =>
      b.mediaPct !== a.mediaPct
        ? b.mediaPct - a.mediaPct
        : a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
    )
    .slice(0, 5)
}

function composicaoDasOndas(ondas: OndaMunicipio[]): IptPesquisaComposicao {
  const datas = [...new Set(ondas.map((o) => o.data).filter(Boolean))].sort()
  const institutos = [
    ...new Set(ondas.map((o) => o.instituto.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  return {
    quantidade: ondas.length,
    datas,
    institutos,
  }
}

function evolucaoDoCandidatoNasOndas(
  ondas: OndaMunicipio[],
  candidatoNorm: string
): Omit<PesquisaIptEvolucaoMunicipio, 'mediaPct'> | null {
  const serie = ondas
    .map((o) => {
      const row = o.porCandidato.get(candidatoNorm)
      return row ? { pct: row.pct, data: o.data, chave: o.chave } : null
    })
    .filter((x): x is { pct: number; data: string; chave: string } => x != null)

  if (serie.length === 0) return null
  const recente = serie[serie.length - 1]!
  const anterior = serie.length >= 2 ? serie[serie.length - 2]! : null
  const deltaPp =
    anterior != null ? round1(recente.pct - anterior.pct) : null

  return {
    recentePct: recente.pct,
    anteriorPct: anterior?.pct ?? null,
    deltaPp,
    evolucao: classificarEvolucaoPesquisaPp(recente.pct, anterior?.pct ?? null),
    ondasComparadas: serie.length,
    dataRecente: recente.data,
    dataAnterior: anterior?.data ?? null,
  }
}

/**
 * Por município: preferir estimulada; se não houver estimulada (ou top vazio),
 * usar espontânea — para ampliar cobertura no mapa IPT.
 *
 * Intenção e Top 5 usam % redistribuídos sobre votos válidos
 * (excluem nenhum/branco + não sei) em cada onda, depois médios.
 */
export function buildPesquisaIptPorMunicipio(
  polls: PollIptRow[],
  candidato: string
): PesquisaIptPorMunicipio {
  const alvo = candidatoNormalizado(candidato)
  const ondasEst = buildOndasValidosPorMunicipio(polls, 'estimulada')
  const ondasEsp = buildOndasValidosPorMunicipio(polls, 'espontanea')

  const munKeys = new Set([...ondasEst.keys(), ...ondasEsp.keys()])

  const intencaoPorMunicipio = new Map<string, number>()
  const top5PorMunicipio = new Map<string, IptPesquisaTopItem[]>()
  const basePorMunicipio = new Map<string, 'estimulada' | 'espontanea'>()
  const evolucaoPorMunicipio = new Map<string, PesquisaIptEvolucaoMunicipio>()
  const composicaoPorMunicipio = new Map<string, IptPesquisaComposicao>()

  for (const key of munKeys) {
    const est = ondasEst.get(key) ?? []
    const esp = ondasEsp.get(key) ?? []
    const base: 'estimulada' | 'espontanea' | null =
      est.length > 0 ? 'estimulada' : esp.length > 0 ? 'espontanea' : null
    if (base == null) continue

    const ondas = base === 'estimulada' ? est : esp
    const ondasAlt = base === 'estimulada' ? esp : est
    const top5 = top5MediasNasOndas(ondas)
    if (top5.length === 0) continue

    basePorMunicipio.set(key, base)
    top5PorMunicipio.set(key, top5)
    composicaoPorMunicipio.set(key, composicaoDasOndas(ondas))

    const media =
      mediaCandidatoNasOndas(ondas, alvo) ??
      mediaCandidatoNasOndas(ondasAlt, alvo) ??
      top5.find((c) => candidatoNormalizado(c.nome) === alvo)?.mediaPct ??
      null
    if (media != null) intencaoPorMunicipio.set(key, media)

    const evo = evolucaoDoCandidatoNasOndas(ondas, alvo)
    const evoAlt = evolucaoDoCandidatoNasOndas(ondasAlt, alvo)
    const evoUsavel =
      evo && evo.anteriorPct != null
        ? evo
        : evoAlt && evoAlt.anteriorPct != null
          ? evoAlt
          : evo ?? evoAlt ?? null

    // Nunca usar a média do 1º do Top 5 como se fosse do candidato foco.
    if (evoUsavel) {
      evolucaoPorMunicipio.set(key, {
        ...evoUsavel,
        mediaPct: media,
        evolucao: classificarEvolucaoPesquisaPp(evoUsavel.recentePct, evoUsavel.anteriorPct),
      })
    } else if (media != null) {
      evolucaoPorMunicipio.set(key, {
        mediaPct: media,
        recentePct: media,
        anteriorPct: null,
        deltaPp: null,
        evolucao: 'estavel',
        ondasComparadas: 1,
        dataRecente: null,
        dataAnterior: null,
      })
    } else {
      // Fora do Top 5 / sem série do candidato: ranking local existe, média própria não.
      evolucaoPorMunicipio.set(key, {
        mediaPct: null,
        recentePct: null,
        anteriorPct: null,
        deltaPp: null,
        evolucao: 'sem_dado',
        ondasComparadas: 0,
        dataRecente: null,
        dataAnterior: null,
      })
    }
  }

  return {
    intencaoPorMunicipio,
    top5PorMunicipio,
    basePorMunicipio,
    evolucaoPorMunicipio,
    composicaoPorMunicipio,
  }
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
      ? round1(medias.reduce((s, v) => s + v, 0) / medias.length)
      : null
  return { porMunicipio: intencaoPorMunicipio, mediaEstadual }
}

/** Top 5 por município — estimulada; senão espontânea. */
export function buildTop5EstimuladaPorMunicipio(
  polls: PollIptRow[]
): Map<string, IptPesquisaTopItem[]> {
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
