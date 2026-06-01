import type { CandidatoMatrizColuna, LinhaMatrizSecao } from '@/lib/votacao-secao-matriz'

/** Margem máxima acima (e abaixo) para considerar votos "parecidos" entre candidatos. */
export const MARGEM_VOTOS_PARECIDOS = 0.5

export type NivelSemelhancaVotos = 'alta' | 'media' | 'baixa' | 'minima'

export type AnaliseComparacaoVotos = {
  candidatoA: CandidatoMatrizColuna
  candidatoB: CandidatoMatrizColuna
  margem: number
  secoesTotal: number
  secoesComAmbos: number
  secoesParecidas: number
  pctSecoesParecidas: number
  nivel: NivelSemelhancaVotos
  rotuloNivel: string
  resumo: string
}

/**
 * Dois candidatos têm votos parecidos na seção quando ambos receberam votos
 * e o maior não ultrapassa 50% a mais que o menor.
 * Ex.: 100 × 140 → parecido · 100 × 160 → distinto
 */
export function votosParecidosNaSecao(
  votosA: number,
  votosB: number,
  margem = MARGEM_VOTOS_PARECIDOS,
): boolean {
  if (votosA <= 0 || votosB <= 0) return false
  const menor = Math.min(votosA, votosB)
  const maior = Math.max(votosA, votosB)
  return maior <= menor * (1 + margem)
}

/** Par de candidatos com votos semelhantes na mesma seção. */
export type ParSemelhanteSecao = {
  idA: string
  idB: string
  nomeA: string
  nomeB: string
}

function primeiroNome(nome: string): string {
  return (nome.trim().split(/\s+/)[0] ?? nome).toUpperCase()
}

function chaveGrupoComparacao(c: CandidatoMatrizColuna): string {
  return c.anoEleicao != null ? `${c.anoEleicao}:${c.dsCargo}` : c.dsCargo
}

function rotuloParSemelhante(a: CandidatoMatrizColuna, b: CandidatoMatrizColuna): {
  nomeA: string
  nomeB: string
} {
  const sufixoA = a.anoEleicao != null ? ` (${String(a.anoEleicao).slice(-2)})` : ''
  const sufixoB = b.anoEleicao != null ? ` (${String(b.anoEleicao).slice(-2)})` : ''
  return {
    nomeA: `${primeiroNome(a.nmVotavel)}${sufixoA}`,
    nomeB: `${primeiroNome(b.nmVotavel)}${sufixoB}`,
  }
}

/** Lista pares de grupos (cargo ou cargo+ano) diferentes com votos parecidos na linha. */
export function paresSemelhantesNaLinha(
  votos: Record<string, number>,
  candidatos: CandidatoMatrizColuna[],
  margem = MARGEM_VOTOS_PARECIDOS,
): ParSemelhanteSecao[] {
  const pares: ParSemelhanteSecao[] = []
  const porGrupo = new Map<string, CandidatoMatrizColuna[]>()
  for (const c of candidatos) {
    const chave = chaveGrupoComparacao(c)
    const lista = porGrupo.get(chave) ?? []
    lista.push(c)
    porGrupo.set(chave, lista)
  }

  const grupos = [...porGrupo.keys()]
  if (grupos.length < 2) return pares

  for (let i = 0; i < grupos.length; i++) {
    for (let j = i + 1; j < grupos.length; j++) {
      const listaA = porGrupo.get(grupos[i]) ?? []
      const listaB = porGrupo.get(grupos[j]) ?? []
      for (const a of listaA) {
        for (const b of listaB) {
          if (votosParecidosNaSecao(votos[a.id] ?? 0, votos[b.id] ?? 0, margem)) {
            const rotulos = rotuloParSemelhante(a, b)
            pares.push({
              idA: a.id,
              idB: b.id,
              nomeA: rotulos.nomeA,
              nomeB: rotulos.nomeB,
            })
          }
        }
      }
    }
  }

  return pares
}

/** @deprecated use paresSemelhantesNaLinha().length > 0 */
export function linhaTemSemelhancaVotos(
  votos: Record<string, number>,
  candidatos: CandidatoMatrizColuna[],
  margem = MARGEM_VOTOS_PARECIDOS,
): boolean {
  return paresSemelhantesNaLinha(votos, candidatos, margem).length > 0
}

export function mapaParesSemelhantesPorSecao(
  linhas: LinhaMatrizSecao[],
  candidatos: CandidatoMatrizColuna[],
): Map<string, ParSemelhanteSecao[]> {
  const mapa = new Map<string, ParSemelhanteSecao[]>()
  if (candidatos.length < 2) return mapa
  for (const linha of linhas) {
    mapa.set(linha.localId, paresSemelhantesNaLinha(linha.votos, candidatos))
  }
  return mapa
}

/** Pares únicos agregados de várias seções (ex.: linha de bairro). */
export function paresSemelhantesAgregados(
  secoes: LinhaMatrizSecao[],
  mapa: Map<string, ParSemelhanteSecao[]>,
): ParSemelhanteSecao[] {
  const vistos = new Map<string, ParSemelhanteSecao>()
  for (const secao of secoes) {
    for (const par of mapa.get(secao.localId) ?? []) {
      const chave = [par.idA, par.idB].sort().join('::')
      vistos.set(chave, par)
    }
  }
  return [...vistos.values()]
}

/** @deprecated use mapaParesSemelhantesPorSecao */
export function mapaSemelhancaPorSecao(
  linhas: LinhaMatrizSecao[],
  candidatos: CandidatoMatrizColuna[],
): Map<string, boolean> {
  const mapa = new Map<string, boolean>()
  const pares = mapaParesSemelhantesPorSecao(linhas, candidatos)
  for (const [id, lista] of pares) {
    mapa.set(id, lista.length > 0)
  }
  return mapa
}

export function contarSecoesSemelhantes(
  mapa: Map<string, ParSemelhanteSecao[] | boolean>,
): number {
  let n = 0
  for (const v of mapa.values()) {
    if (Array.isArray(v) ? v.length > 0 : v) n += 1
  }
  return n
}

export function classificarSemelhancaVotos(pct: number): {
  nivel: NivelSemelhancaVotos
  rotulo: string
} {
  if (pct >= 70) return { nivel: 'alta', rotulo: 'Alta semelhança' }
  if (pct >= 50) return { nivel: 'media', rotulo: 'Semelhança moderada' }
  if (pct >= 30) return { nivel: 'baixa', rotulo: 'Semelhança baixa' }
  return { nivel: 'minima', rotulo: 'Pouca semelhança' }
}

export function analisarComparacaoVotos(
  linhas: LinhaMatrizSecao[],
  candidatoA: CandidatoMatrizColuna,
  candidatoB: CandidatoMatrizColuna,
  margem = MARGEM_VOTOS_PARECIDOS,
): AnaliseComparacaoVotos {
  let secoesComAmbos = 0
  let secoesParecidas = 0

  for (const linha of linhas) {
    const va = linha.votos[candidatoA.id] ?? 0
    const vb = linha.votos[candidatoB.id] ?? 0
    if (va <= 0 || vb <= 0) continue
    secoesComAmbos += 1
    if (votosParecidosNaSecao(va, vb, margem)) secoesParecidas += 1
  }

  const secoesTotal = linhas.length
  const pctSecoesParecidas = secoesTotal > 0 ? (secoesParecidas / secoesTotal) * 100 : 0
  const { nivel, rotulo } = classificarSemelhancaVotos(pctSecoesParecidas)
  const margemPct = Math.round(margem * 100)

  const resumo =
    secoesParecidas === 0
      ? `Nenhuma seção com semelhança de votos (margem de até ${margemPct}%).`
      : `${secoesParecidas} de ${secoesTotal} seções tiveram quantidade de votos semelhante (diferença de até ${margemPct}%).`

  return {
    candidatoA,
    candidatoB,
    margem,
    secoesTotal,
    secoesComAmbos,
    secoesParecidas,
    pctSecoesParecidas,
    nivel,
    rotuloNivel: rotulo,
    resumo,
  }
}

export function analisesComparacaoEntreCargos(
  linhas: LinhaMatrizSecao[],
  candidatos: CandidatoMatrizColuna[],
  margem = MARGEM_VOTOS_PARECIDOS,
): AnaliseComparacaoVotos[] {
  const porGrupo = new Map<string, CandidatoMatrizColuna[]>()
  for (const c of candidatos) {
    const chave = chaveGrupoComparacao(c)
    const lista = porGrupo.get(chave) ?? []
    lista.push(c)
    porGrupo.set(chave, lista)
  }

  const grupos = [...porGrupo.keys()]
  if (grupos.length < 2) return []

  const analises: AnaliseComparacaoVotos[] = []

  for (let i = 0; i < grupos.length; i++) {
    for (let j = i + 1; j < grupos.length; j++) {
      const listaA = porGrupo.get(grupos[i]) ?? []
      const listaB = porGrupo.get(grupos[j]) ?? []
      for (const a of listaA) {
        for (const b of listaB) {
          analises.push(analisarComparacaoVotos(linhas, a, b, margem))
        }
      }
    }
  }

  return analises.sort((x, y) => y.pctSecoesParecidas - x.pctSecoesParecidas)
}

/** @deprecated use analisesComparacaoEntreCargos */
export const analisesVotoCasadoEntreCargos = analisesComparacaoEntreCargos

/** @deprecated use AnaliseComparacaoVotos */
export type AnaliseVotoCasado = AnaliseComparacaoVotos
