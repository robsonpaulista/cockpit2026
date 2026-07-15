import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'
import { isSituacaoEleito, parseVotosEleicao } from '@/lib/resumo-eleicoes-dados'

/** Chave estável para somar votos do mesmo candidato em vários municípios. */
export function chaveAgregacaoResultado(row: ResultadoEleicao): string {
  return [
    row.anoEleicao,
    row.codigoCargo,
    row.numeroUrna,
    String(row.nomeUrnaCandidato || '').trim().toUpperCase(),
    String(row.partido || '').trim().toUpperCase(),
  ].join('::')
}

/** Soma votos nominais por candidato/cargo em todo o estado (a partir do cache da planilha). */
export function agregarResultadosEleicao(rows: ResultadoEleicao[]): ResultadoEleicao[] {
  const map = new Map<string, ResultadoEleicao>()

  for (const row of rows) {
    const key = chaveAgregacaoResultado(row)
    const votos = parseVotosEleicao(row.quantidadeVotosNominais)
    const existente = map.get(key)

    if (!existente) {
      map.set(key, {
        ...row,
        municipio: 'PI',
        quantidadeVotosNominais: String(votos),
      })
      continue
    }

    const total = parseVotosEleicao(existente.quantidadeVotosNominais) + votos
    existente.quantidadeVotosNominais = String(total)
    if (isSituacaoEleito(row.situacao) && !isSituacaoEleito(existente.situacao)) {
      existente.situacao = row.situacao
    }
  }

  return Array.from(map.values())
}

export const RESUMO_TODAS_CIDADES = '__TODAS__'

export const RESUMO_TODAS_CIDADES_LABEL = 'Todas as cidades (PI)'
