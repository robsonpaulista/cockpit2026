import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'

/** Corrida territorial: quem venceu cada município para Deputado Federal em 2022 e em 2026 (PI). */

export type VencedorFederalMunicipio = {
  /** Nome civil normalizado: identifica a mesma pessoa entre as eleições. */
  chave: string
  urna: string
  partido: string
  votos: number
  pct: number
}

export type MunicipioCorrida = {
  municipio: string
  v2022: VencedorFederalMunicipio | null
  v2026: VencedorFederalMunicipio | null
}

export type ParticipanteCorrida = {
  chave: string
  nome: string
  partido: string
  partido2022: string | null
  cidades2022: number
  cidades2026: number
}

export type FluxoCorrida = { de: string; para: string; cidades: string[] }

export type CorridaTerritorial = {
  participantes: ParticipanteCorrida[]
  /** Municípios em que o vencedor de 2022 venceu de novo em 2026. */
  mantidas: { chave: string; municipio: string }[]
  fluxos: FluxoCorrida[]
}

export type ConquistasVencedor2026 = {
  chave: string
  mantidas: string[]
  tomadas: number
  /** De quem as cidades foram tomadas, do maior para o menor. */
  origens: { de: string; cidades: string[] }[]
}

/** Agrupa as trocas pelo vencedor de 2026: de quem cada um tomou cidades e quantas manteve. */
export function conquistasPorVencedor2026(corrida: CorridaTerritorial): ConquistasVencedor2026[] {
  const grupos = new Map<string, ConquistasVencedor2026>()
  const grupo = (chave: string) => {
    const g = grupos.get(chave) ?? { chave, mantidas: [], tomadas: 0, origens: [] }
    grupos.set(chave, g)
    return g
  }
  for (const m of corrida.mantidas) grupo(m.chave).mantidas.push(m.municipio)
  for (const f of corrida.fluxos) {
    const g = grupo(f.para)
    g.tomadas += f.cidades.length
    g.origens.push({ de: f.de, cidades: f.cidades })
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, origens: g.origens.sort((a, b) => b.cidades.length - a.cidades.length) }))
    .sort((a, b) => b.mantidas.length + b.tomadas - (a.mantidas.length + a.tomadas) || b.tomadas - a.tomadas)
}

export const ANOS_CORRIDA = ['2022', '2026'] as const

export function chavePessoaEleicao(valor: string): string {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Chave de município tolerante a acentos, espaços e pontuação (TSE × planilha × IBGE). */
export const chaveMunicipio = (nome: string): string =>
  nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Vencedor de Deputado Federal em cada município do PI, para 2022 e 2026. */
export function vencedoresFederais2022x2026(resultados: ResultadoEleicao[]): MunicipioCorrida[] {
  type Soma = { urna: string; partido: string; votos: number }
  const porAno = new Map<string, Map<string, { nome: string; candidatos: Map<string, Soma> }>>()
  for (const r of resultados) {
    if (r.anoEleicao !== '2022' && r.anoEleicao !== '2026') continue
    if (String(r.uf || '').toUpperCase() !== 'PI' || !/federal/i.test(r.cargo || '')) continue
    const chaveMun = chaveMunicipio(r.municipio || '')
    const pessoa = chavePessoaEleicao(r.nomeCandidato || r.nomeUrnaCandidato)
    if (!chaveMun || !pessoa) continue
    const votos = Number.parseInt(r.quantidadeVotosNominais || '0', 10) || 0
    const ano = porAno.get(r.anoEleicao) ?? new Map()
    porAno.set(r.anoEleicao, ano)
    const mun = ano.get(chaveMun) ?? { nome: r.municipio, candidatos: new Map<string, Soma>() }
    ano.set(chaveMun, mun)
    const soma = mun.candidatos.get(pessoa) ?? { urna: r.nomeUrnaCandidato, partido: r.partido, votos: 0 }
    soma.votos += votos
    mun.candidatos.set(pessoa, soma)
  }

  const vencedor = (ano: string, chaveMun: string): VencedorFederalMunicipio | null => {
    const mun = porAno.get(ano)?.get(chaveMun)
    if (!mun) return null
    let total = 0
    let melhor: VencedorFederalMunicipio | null = null
    for (const [chave, s] of mun.candidatos) {
      total += s.votos
      if (s.votos > 0 && (!melhor || s.votos > melhor.votos)) {
        melhor = { chave, urna: s.urna, partido: s.partido, votos: s.votos, pct: 0 }
      }
    }
    return melhor && { ...melhor, pct: total ? (melhor.votos / total) * 100 : 0 }
  }

  const nomes = new Map<string, string>()
  for (const ano of ANOS_CORRIDA) for (const [k, m] of porAno.get(ano) ?? []) if (!nomes.has(k)) nomes.set(k, m.nome)
  return [...nomes.entries()]
    .map(([k, municipio]) => ({ municipio, v2022: vencedor('2022', k), v2026: vencedor('2026', k) }))
    .sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR'))
}

export type CandidatoCorridaMunicipio = {
  chave: string
  nome: string
  partido: string
  partido2022: string | null
  votos2022: number
  votos2026: number
}

export type CorridaMunicipio = {
  municipio: string
  total2022: number
  total2026: number
  candidatos: CandidatoCorridaMunicipio[]
}

/** Votos de cada candidato a Deputado Federal em um município, em 2022 e 2026. */
export function corridaFederalNoMunicipio(resultados: ResultadoEleicao[], municipio: string): CorridaMunicipio {
  const alvo = chaveMunicipio(municipio)
  const candidatos = new Map<string, CandidatoCorridaMunicipio>()
  let nome = municipio
  let total2022 = 0
  let total2026 = 0
  for (const r of resultados) {
    if (r.anoEleicao !== '2022' && r.anoEleicao !== '2026') continue
    if (String(r.uf || '').toUpperCase() !== 'PI' || !/federal/i.test(r.cargo || '')) continue
    if (chaveMunicipio(r.municipio || '') !== alvo) continue
    const chave = chavePessoaEleicao(r.nomeCandidato || r.nomeUrnaCandidato)
    if (!chave) continue
    nome = r.municipio
    const votos = Number.parseInt(r.quantidadeVotosNominais || '0', 10) || 0
    const c = candidatos.get(chave) ?? {
      chave,
      nome: r.nomeUrnaCandidato,
      partido: r.partido,
      partido2022: null,
      votos2022: 0,
      votos2026: 0,
    }
    if (r.anoEleicao === '2026') {
      c.nome = r.nomeUrnaCandidato
      c.partido = r.partido
      c.votos2026 += votos
      total2026 += votos
    } else {
      c.partido2022 = r.partido
      c.votos2022 += votos
      total2022 += votos
    }
    candidatos.set(chave, c)
  }
  return {
    municipio: nome,
    total2022,
    total2026,
    candidatos: [...candidatos.values()]
      .filter((c) => c.votos2022 > 0 || c.votos2026 > 0)
      .sort((a, b) => b.votos2026 - a.votos2026 || b.votos2022 - a.votos2022),
  }
}

/** Municípios vencidos por pessoa em cada ano, cidades mantidas e quem tomou cidades de quem. */
export function montarCorridaTerritorial(municipios: MunicipioCorrida[]): CorridaTerritorial {
  const pessoas = new Map<string, ParticipanteCorrida>()
  const pessoa = (v: VencedorFederalMunicipio, ano: '2022' | '2026') => {
    const p = pessoas.get(v.chave) ?? {
      chave: v.chave,
      nome: v.urna,
      partido: v.partido,
      partido2022: null,
      cidades2022: 0,
      cidades2026: 0,
    }
    if (ano === '2026') {
      p.nome = v.urna
      p.partido = v.partido
      p.cidades2026 += 1
    } else {
      p.partido2022 = v.partido
      p.cidades2022 += 1
    }
    pessoas.set(v.chave, p)
  }

  const mantidas: CorridaTerritorial['mantidas'] = []
  const fluxos = new Map<string, FluxoCorrida>()
  for (const m of municipios) {
    if (m.v2022) pessoa(m.v2022, '2022')
    if (m.v2026) pessoa(m.v2026, '2026')
    if (!m.v2022 || !m.v2026) continue
    if (m.v2022.chave === m.v2026.chave) {
      mantidas.push({ chave: m.v2026.chave, municipio: m.municipio })
      continue
    }
    const k = `${m.v2022.chave}>${m.v2026.chave}`
    const f = fluxos.get(k) ?? { de: m.v2022.chave, para: m.v2026.chave, cidades: [] }
    f.cidades.push(m.municipio)
    fluxos.set(k, f)
  }

  return {
    participantes: [...pessoas.values()].sort(
      (a, b) => b.cidades2026 - a.cidades2026 || b.cidades2022 - a.cidades2022,
    ),
    mantidas,
    fluxos: [...fluxos.values()].sort((a, b) => b.cidades.length - a.cidades.length),
  }
}
