/**
 * Cruza lideranças (dep. estadual do cadastro) com votos nominais 2026
 * do deputado estadual no município da liderança.
 */

import {
  scoreCorrespondenciaNomeCandidato,
} from '@/lib/candidato-nome-correspondencia'
import { extrairDepEstadualDeLideranca } from '@/lib/planilha-dep-estadual-lideranca'
import {
  parseVotosEleicao,
  type ResultadoEleicao,
} from '@/lib/resumo-eleicoes-dados'
import { normalizeMunicipioChaveVotacao } from '@/lib/votacao-secao'

export type LiderancaDepEstadual2026Fonte = {
  id: number
  municipio: string
  nome: string
  cargo: string
  depEstadual?: string | null
  liderancaAtual?: string | null
  emDialogo?: boolean
}

export type LiderancaDepEstadual2026Row = {
  id: number
  municipio: string
  nome: string
  cargo: string
  liderancaAtual: string
  emDialogo: boolean
  /** Nome do dep. estadual no cadastro (coluna ou cargo). */
  depEstadual: string
  /** Nome de urna casado no resultado 2026, se houver. */
  urnaMatch: string | null
  nomeCandidato: string | null
  numeroUrna: string | null
  partido: string | null
  situacao: string | null
  votos2026: number | null
  matchScore: number | null
}

const SCORE_MINIMO = 75

function melhorCandidatoNaCidade(
  candidatos: readonly ResultadoEleicao[],
  alvo: string,
): { candidato: ResultadoEleicao; score: number } | null {
  let melhor: ResultadoEleicao | null = null
  let melhorScore = 0

  for (const item of candidatos) {
    const score = Math.max(
      scoreCorrespondenciaNomeCandidato(item.nomeUrnaCandidato, alvo),
      scoreCorrespondenciaNomeCandidato(item.nomeCandidato, alvo),
    )
    if (score > melhorScore) {
      melhorScore = score
      melhor = item
    }
  }

  if (!melhor || melhorScore < SCORE_MINIMO) return null
  return { candidato: melhor, score: melhorScore }
}

function indexarEstaduaisPorMunicipio(
  linhas: readonly ResultadoEleicao[],
): Map<string, ResultadoEleicao[]> {
  const mapa = new Map<string, ResultadoEleicao[]>()
  for (const item of linhas) {
    if (item.anoEleicao !== '2026') continue
    if (!/estadual/i.test(item.cargo || '')) continue
    const chave = normalizeMunicipioChaveVotacao(item.municipio)
    if (!chave) continue
    const lista = mapa.get(chave) ?? []
    lista.push(item)
    mapa.set(chave, lista)
  }
  return mapa
}

/** Monta a lista flat: liderança × dep. estadual × votos 2026 na cidade. */
export function buildLiderancasDepEstadual2026Rows(
  liderancas: readonly LiderancaDepEstadual2026Fonte[],
  votacao2026: readonly ResultadoEleicao[],
): LiderancaDepEstadual2026Row[] {
  const porMunicipio = indexarEstaduaisPorMunicipio(votacao2026)

  return liderancas.map((lider) => {
    const depEstadual = extrairDepEstadualDeLideranca({
      nome: lider.nome,
      cargo: lider.cargo,
      depEstadual: lider.depEstadual,
    })
    const base: LiderancaDepEstadual2026Row = {
      id: lider.id,
      municipio: lider.municipio,
      nome: lider.nome,
      cargo: lider.cargo,
      liderancaAtual: String(lider.liderancaAtual || ''),
      emDialogo: Boolean(lider.emDialogo),
      depEstadual,
      urnaMatch: null,
      nomeCandidato: null,
      numeroUrna: null,
      partido: null,
      situacao: null,
      votos2026: null,
      matchScore: null,
    }

    if (!depEstadual) return base

    const chave = normalizeMunicipioChaveVotacao(lider.municipio)
    const candidatos = chave ? porMunicipio.get(chave) : undefined
    if (!candidatos?.length) return base

    const match = melhorCandidatoNaCidade(candidatos, depEstadual)
    if (!match) return base

    return {
      ...base,
      urnaMatch: match.candidato.nomeUrnaCandidato || null,
      nomeCandidato: match.candidato.nomeCandidato || null,
      numeroUrna: match.candidato.numeroUrna || null,
      partido: match.candidato.partido || null,
      situacao: match.candidato.situacao || null,
      votos2026: parseVotosEleicao(match.candidato.quantidadeVotosNominais),
      matchScore: match.score,
    }
  })
}
