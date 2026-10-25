import { getEleitoradoByCity } from '@/lib/eleitores'
import { quadroMunicipios2026, type ResultadoSecao2026Payload } from '@/lib/resultado-secao-2026'

export type ModoComparativoBase = 'minimo' | 'votos' | 'proporcao'
export type BaseProporcao = 'eleitorado' | 'votantes'

export type RecorteComparativoBase = {
  modo: ModoComparativoBase
  quantidade: number
  base: BaseProporcao
}

export type CidadeComparativoBase = {
  nome: string
  votos: number
  eleitores: number | null
  votantes: number
  pctEleitores: number | null
  pctVotantes: number | null
}

export type ColunaComparativoBase = {
  indice: number
  cidades: CidadeComparativoBase[]
  votos: number
  eleitores: number
  votantes: number
  pctEleitores: number | null
  pctVotantes: number | null
}

type CidadeCargo = {
  nome: string
  votantes: number
  eleitores: number | null
  votos: number[]
}

export type MatrizComparativoBase = {
  indices: number[]
  cidades: CidadeCargo[]
}

function pct(votos: number, base: number | null): number | null {
  if (base == null || base <= 0) return null
  return (votos / base) * 100
}

function porNome(a: { nome: string }, b: { nome: string }): number {
  return a.nome.localeCompare(b.nome, 'pt-BR')
}

function chaveProporcao(cidade: CidadeCargo, posicao: number, base: BaseProporcao): number {
  const votos = cidade.votos[posicao] ?? 0
  if (base === 'eleitorado') return cidade.eleitores != null && cidade.eleitores > 0 ? votos / cidade.eleitores : -1
  return cidade.votantes > 0 ? votos / cidade.votantes : -1
}

function recortar(cidades: CidadeCargo[], posicao: number, recorte: RecorteComparativoBase): CidadeCargo[] {
  const comVoto = cidades.filter((c) => (c.votos[posicao] ?? 0) > 0)
  if (recorte.modo === 'minimo') {
    return comVoto
      .filter((c) => (c.votos[posicao] ?? 0) >= recorte.quantidade)
      .sort((a, b) => (b.votos[posicao] ?? 0) - (a.votos[posicao] ?? 0) || porNome(a, b))
  }
  if (recorte.modo === 'votos') {
    return [...comVoto]
      .sort((a, b) => (b.votos[posicao] ?? 0) - (a.votos[posicao] ?? 0) || porNome(a, b))
      .slice(0, recorte.quantidade)
  }
  return [...comVoto]
    .filter((c) => chaveProporcao(c, posicao, recorte.base) >= 0)
    .sort(
      (a, b) =>
        chaveProporcao(b, posicao, recorte.base) - chaveProporcao(a, posicao, recorte.base) ||
        (b.votos[posicao] ?? 0) - (a.votos[posicao] ?? 0),
    )
    .slice(0, recorte.quantidade)
}

function colunaDe(indice: number, cidades: CidadeCargo[], posicao: number, recorte: RecorteComparativoBase): ColunaComparativoBase {
  const escolhidas = recortar(cidades, posicao, recorte).map((c) => {
    const votos = c.votos[posicao] ?? 0
    return {
      nome: c.nome,
      votos,
      eleitores: c.eleitores,
      votantes: c.votantes,
      pctEleitores: pct(votos, c.eleitores),
      pctVotantes: pct(votos, c.votantes),
    }
  })
  const votos = escolhidas.reduce((soma, c) => soma + c.votos, 0)
  const eleitores = escolhidas.reduce((soma, c) => soma + (c.eleitores ?? 0), 0)
  const votantes = escolhidas.reduce((soma, c) => soma + c.votantes, 0)
  const temEleitores = escolhidas.length > 0 && escolhidas.every((c) => c.eleitores != null && c.eleitores > 0)
  return {
    indice,
    cidades: escolhidas,
    votos,
    eleitores,
    votantes,
    pctEleitores: temEleitores ? pct(votos, eleitores) : null,
    pctVotantes: pct(votos, votantes),
  }
}

/** Uma passagem no resultado do cargo: votos, votantes e eleitorado de cada município. */
export function matrizComparativoBase2026(payload: ResultadoSecao2026Payload, cargo: string): MatrizComparativoBase {
  const quadro = quadroMunicipios2026(payload, cargo)
  return {
    indices: quadro.indices,
    cidades: quadro.linhas.map((linha) => ({
      nome: linha.nome,
      votantes: linha.total,
      eleitores: getEleitoradoByCity(linha.nome),
      votos: linha.votos,
    })),
  }
}

/** Recorte individual de cada candidato: mínimo de votos, mais votos ou maior proporção. */
export function compararBaseCandidatos2026(
  matriz: MatrizComparativoBase,
  indices: number[],
  recorte: RecorteComparativoBase,
): ColunaComparativoBase[] {
  return indices.flatMap((indice) => {
    const posicao = matriz.indices.indexOf(indice)
    if (posicao < 0) return []
    return [colunaDe(indice, matriz.cidades, posicao, recorte)]
  })
}
