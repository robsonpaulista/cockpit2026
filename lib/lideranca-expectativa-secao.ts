import { scoreCorrespondenciaNomeCandidato } from '@/lib/candidato-nome-correspondencia'
import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'
import {
  chaveBairroMatriz,
  mapaPctSimilaridadePorBairro,
  MARGEM_VOTOS_PARECIDOS,
  votosParecidosNaSecao,
} from '@/lib/votacao-secao-correlacao'
import type {
  CandidatoMatrizColuna,
  LinhaMatrizSecao,
  MatrizVotacaoSecao,
} from '@/lib/votacao-secao-matriz'

export const CANDIDATO_EXPECTATIVA_LIDERANCA_ID = 'expectativa:lideranca:2026'

/** Mínimo de seções parecidas (vereador × dep. estadual) no bairro para manter peso integral. */
export const LIMIAR_SIMILARIDADE_BAIRRO_EXP = 50

/** Redução do peso do vereador na distribuição quando a similaridade no bairro fica abaixo do limiar. */
export const CORTE_PESO_VEREADOR_SIMILARIDADE_BAIXA = 0.3

export type RegraExpectativaDistribuicao =
  | 'proporcional_simples'
  | 'similaridade_alta'
  | 'similaridade_baixa'

export type ExpectativaSecaoDetalhe = {
  regra: RegraExpectativaDistribuicao
  localId: string
  bairroId: string
  nmBairro: string
  votosVereadorSecao: number
  votosEstadualSecao: number
  pesoVereadorUsado: number
  expectativaSecao: number
  expectativaExataSecao: number
  pctSimilaridadeBairro: number | null
  secoesComAmbosNoBairro: number
  secoesParecidasNoBairro: number
  totalExpectativaMunicipio: number
  totalMapaEleitoral: number
  totalPesoMunicipio: number
  nomeLideranca: string
}

export type ExpectativaBairroDetalhe = {
  regra: RegraExpectativaDistribuicao
  bairroId: string
  nmBairro: string
  expectativaBairro: number
  expectativaProporcionalExataBairro: number
  votosVereadorBairro: number
  pesoUsadoBairro: number
  totalPesoMunicipio: number
  totalSecoesBairro: number
  pctSimilaridadeBairro: number | null
  secoesComAmbosNoBairro: number
  secoesParecidasNoBairro: number
  totalExpectativaMunicipio: number
  totalMapaEleitoral: number
  nomeLideranca: string
}

export type BlocoExplicacaoExpectativa = {
  titulo: string
  linhas: string[]
  formula?: string
}

function fmtV(n: number, dec = 0): string {
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

function fmtPct(n: number): string {
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function textoAjusteSimilaridade(regra: RegraExpectativaDistribuicao): string | null {
  if (regra === 'similaridade_baixa') {
    return `Neste bairro, vereador e dep. estadual não votaram parecido em muitas seções (menos de ${LIMIAR_SIMILARIDADE_BAIRRO_EXP}%). Para não superestimar, reduzimos ${Math.round(CORTE_PESO_VEREADOR_SIMILARIDADE_BAIXA * 100)}% nesta parte.`
  }
  if (regra === 'similaridade_alta') {
    return 'Neste bairro, o padrão de voto do vereador e do dep. estadual é consistente — usamos a base de 2024 sem desconto.'
  }
  return null
}

export type InjetarExpectativaLiderancaResult = {
  matriz: MatrizVotacaoSecao
  detalhesPorSecao: Map<string, ExpectativaSecaoDetalhe>
  detalhesPorBairro: Map<string, ExpectativaBairroDetalhe>
  usaRegraSimilaridade: boolean
  totalMapaEleitoral: number
  totalReferenciaPlanilha: number
}

export function rotuloRegraExpectativa(regra: RegraExpectativaDistribuicao): string {
  if (regra === 'similaridade_baixa') return 'Regra 2'
  if (regra === 'similaridade_alta') return 'Regra 1'
  return 'Proporcional simples'
}

export function tituloRegraExpectativa(regra: RegraExpectativaDistribuicao): string {
  if (regra === 'similaridade_baixa') {
    return 'Estimativa cautelosa neste bairro'
  }
  if (regra === 'similaridade_alta') {
    return 'Base de 2024 confiável neste bairro'
  }
  return 'Mapa pelas urnas de 2024'
}

function linhasIntroExpectativa(d: {
  regra: RegraExpectativaDistribuicao
  nomeLideranca: string
  totalExpectativaMunicipio: number
  totalMapaEleitoral: number
}): string[] {
  const linhas = [
    'Partimos do que o vereador fez nas urnas de 2024 — quanto ele teve em cada seção.',
  ]
  if (d.regra !== 'proporcional_simples') {
    linhas.push(
      'Cruzamos com o dep. estadual na mesma urna: onde os dois tiveram votos parecidos no bairro, confiamos na base de 2024; onde divergiram, a estimativa fica mais conservadora.',
    )
  }
  linhas.push(
    `Somando o mapa, chegamos a ${fmtV(d.totalMapaEleitoral)} votos. Na planilha, ${d.nomeLideranca} consta com ${fmtV(d.totalExpectativaMunicipio)} — são números independentes para comparar, não um rateio da meta.`,
  )
  return linhas
}

export function montarExplicacaoExpectativaSecao(d: ExpectativaSecaoDetalhe): BlocoExplicacaoExpectativa[] {
  const share =
    d.pesoVereadorUsado > 0 && d.totalPesoMunicipio > 0
      ? (d.pesoVereadorUsado / d.totalPesoMunicipio) * 100
      : 0

  const resumo: string[] = [...linhasIntroExpectativa(d)]

  if (d.votosVereadorSecao <= 0) {
    resumo.push('Nesta seção o vereador não teve votos em 2024, então a expectativa aqui fica em zero.')
  } else {
    resumo.push(
      `Nesta seção (${d.nmBairro}), o vereador teve ${fmtV(d.votosVereadorSecao)} votos em 2024 — cerca de ${fmtPct(share)} do mapa municipal.`,
    )
    const ajuste = textoAjusteSimilaridade(d.regra)
    if (ajuste) resumo.push(ajuste)
    resumo.push(`Com isso, a expectativa nesta seção é de ${fmtV(d.expectativaSecao)} votos.`)
  }

  const referencia: string[] = [
    `Total do mapa eleitoral: ${fmtV(d.totalMapaEleitoral)} votos`,
    `Referência na planilha (${d.nomeLideranca}): ${fmtV(d.totalExpectativaMunicipio)} votos`,
    `Votos do vereador nesta seção (2024): ${fmtV(d.votosVereadorSecao)}`,
  ]
  if (d.votosEstadualSecao > 0) {
    referencia.push(`Votos do dep. estadual nesta seção (2024): ${fmtV(d.votosEstadualSecao)}`)
  }
  if (d.regra !== 'proporcional_simples' && d.pctSimilaridadeBairro != null) {
    referencia.push(
      `Seções parecidas no bairro (vereador × estadual): ${d.secoesParecidasNoBairro} de ${d.secoesComAmbosNoBairro}`,
    )
  }

  return [
    { titulo: 'Em resumo', linhas: resumo },
    { titulo: 'Números de referência', linhas: referencia },
  ]
}

export function montarExplicacaoExpectativaBairro(d: ExpectativaBairroDetalhe): BlocoExplicacaoExpectativa[] {
  const share =
    d.pesoUsadoBairro > 0 && d.totalPesoMunicipio > 0
      ? (d.pesoUsadoBairro / d.totalPesoMunicipio) * 100
      : 0

  const resumo: string[] = [...linhasIntroExpectativa(d)]

  if (d.votosVereadorBairro > 0) {
    resumo.push(
      `Em ${d.nmBairro}, o vereador somou ${fmtV(d.votosVereadorBairro)} votos em 2024 — cerca de ${fmtPct(share)} do mapa municipal.`,
    )
    const ajuste = textoAjusteSimilaridade(d.regra)
    if (ajuste) resumo.push(ajuste)
    resumo.push(`Somando as ${fmtV(d.totalSecoesBairro)} seções do bairro, a expectativa aqui é de ${fmtV(d.expectativaBairro)} votos.`)
  } else {
    resumo.push(`Em ${d.nmBairro} o vereador não teve votos em 2024, então a expectativa aqui fica em zero.`)
  }

  const referencia: string[] = [
    `Total do mapa eleitoral: ${fmtV(d.totalMapaEleitoral)} votos`,
    `Referência na planilha (${d.nomeLideranca}): ${fmtV(d.totalExpectativaMunicipio)} votos`,
    `Votos do vereador no bairro (2024): ${fmtV(d.votosVereadorBairro)}`,
    `Seções no bairro: ${fmtV(d.totalSecoesBairro)}`,
  ]
  if (d.regra !== 'proporcional_simples' && d.pctSimilaridadeBairro != null) {
    referencia.push(
      `Seções parecidas no bairro (vereador × estadual): ${d.secoesParecidasNoBairro} de ${d.secoesComAmbosNoBairro}`,
    )
  }

  return [
    { titulo: 'Em resumo', linhas: resumo },
    { titulo: 'Números de referência', linhas: referencia },
  ]
}

/** @deprecated use montarExplicacaoExpectativaSecao */
export function explicacaoExpectativaSecao(d: ExpectativaSecaoDetalhe): string[] {
  return montarExplicacaoExpectativaSecao(d).flatMap((b) => [b.titulo, ...b.linhas, ...(b.formula ? [b.formula] : [])])
}

/** @deprecated use montarExplicacaoExpectativaBairro */
export function explicacaoExpectativaBairro(d: ExpectativaBairroDetalhe): string[] {
  return montarExplicacaoExpectativaBairro(d).flatMap((b) => [b.titulo, ...b.linhas, ...(b.formula ? [b.formula] : [])])
}

type BlocoSimilaridadeBairro = {
  pct: number
  secoesComAmbos: number
  secoesParecidas: number
}

function resolverRegraExpectativa(
  usaSimilaridade: boolean,
  bloco: BlocoSimilaridadeBairro | null,
): RegraExpectativaDistribuicao {
  if (!usaSimilaridade) return 'proporcional_simples'
  if (!bloco || bloco.secoesComAmbos <= 0) return 'similaridade_baixa'
  return bloco.pct >= LIMIAR_SIMILARIDADE_BAIRRO_EXP ? 'similaridade_alta' : 'similaridade_baixa'
}

function buildMapaSimilaridadeBairroDetalhado(
  linhas: readonly LinhaMatrizSecao[],
  vereadorId: string,
  estadualId: string,
): Map<string, BlocoSimilaridadeBairro> {
  const pctMap = mapaPctSimilaridadePorBairro([...linhas], vereadorId, estadualId, MARGEM_VOTOS_PARECIDOS)
  const out = new Map<string, BlocoSimilaridadeBairro>()

  for (const linha of linhas) {
    const bairroId = chaveBairroMatriz(linha.nmBairro)
    if (out.has(bairroId)) continue

    let secoesComAmbos = 0
    let secoesParecidas = 0
    for (const l of linhas) {
      if (chaveBairroMatriz(l.nmBairro) !== bairroId) continue
      const vv = l.votos[vereadorId] ?? 0
      const ve = l.votos[estadualId] ?? 0
      if (vv <= 0 || ve <= 0) continue
      secoesComAmbos += 1
      if (votosParecidosNaSecao(vv, ve, MARGEM_VOTOS_PARECIDOS)) secoesParecidas += 1
    }

    out.set(bairroId, {
      pct: pctMap.get(bairroId) ?? 0,
      secoesComAmbos,
      secoesParecidas,
    })
  }

  return out
}

export type CenarioVotosLideranca = 'aferido_jadyel' | 'promessa_lideranca' | 'legado_anterior'

export type LiderancaExpectativaSecao = {
  nome: string
  cargo: string
  depEstadual?: string
  projecaoAferida: number
  projecaoPromessa: number
  projecaoLegado: number
}

export function expectativaVotosLideranca(
  lideranca: Pick<
    LiderancaExpectativaSecao,
    'projecaoAferida' | 'projecaoPromessa' | 'projecaoLegado'
  >,
  cenario: CenarioVotosLideranca,
): number {
  if (cenario === 'promessa_lideranca') return Math.round(lideranca.projecaoPromessa || 0)
  if (cenario === 'legado_anterior') return Math.round(lideranca.projecaoLegado || 0)
  return Math.round(lideranca.projecaoAferida || 0)
}

function extrairNomeDoCargo(cargoTexto: string, padrao: RegExp): string | null {
  const match = cargoTexto.match(padrao)
  const nome = match?.[1]?.trim()
  return nome ? nome : null
}

/** Alvos de nome para match vereador ↔ liderança (mesma lógica do botão Marcar). */
export function alvosVereadorLideranca(lideranca: Pick<LiderancaExpectativaSecao, 'nome' | 'cargo'>): string[] {
  const cargoBruto = String(lideranca.cargo || '')
  const alvos: string[] = []

  const verNome = extrairNomeDoCargo(
    cargoBruto,
    /(?:vereador(?:a)?)\s*:?\s*([^|;·]+?)(?=\s{2,}|[|;·]|$)/i,
  )
  if (verNome) alvos.push(verNome)

  const cargoNorm = cargoBruto.toLowerCase()
  if (cargoNorm.includes('vereador') && alvos.length === 0) {
    alvos.push(lideranca.nome)
  }

  if (alvos.length === 0) {
    alvos.push(lideranca.nome)
  }

  return [...new Set(alvos.filter(Boolean))]
}

export function scoreVereadorLideranca(
  vereador: Pick<ResultadoEleicao, 'nomeUrnaCandidato'>,
  lideranca: Pick<LiderancaExpectativaSecao, 'nome' | 'cargo'>,
): number {
  const alvos = alvosVereadorLideranca(lideranca)
  let melhor = 0
  for (const alvo of alvos) {
    melhor = Math.max(melhor, scoreCorrespondenciaNomeCandidato(vereador.nomeUrnaCandidato, alvo))
  }
  return melhor
}

export function encontrarLiderancaDoVereador(
  liderancas: readonly LiderancaExpectativaSecao[],
  vereador: Pick<ResultadoEleicao, 'nomeUrnaCandidato' | 'numeroUrna'>,
  scoreMinimo = 75,
): LiderancaExpectativaSecao | null {
  let melhor: LiderancaExpectativaSecao | null = null
  let melhorScore = 0

  for (const l of liderancas) {
    const score = scoreVereadorLideranca(vereador, l)
    if (score > melhorScore) {
      melhorScore = score
      melhor = l
    }
  }

  return melhorScore >= scoreMinimo ? melhor : null
}

export function ajustarPesoVereadorPorSimilaridadeBairro(
  linhas: readonly LinhaMatrizSecao[],
  vereadorId: string,
  estadualId: string,
  limiarPct = LIMIAR_SIMILARIDADE_BAIRRO_EXP,
  corte = CORTE_PESO_VEREADOR_SIMILARIDADE_BAIXA,
): (linha: LinhaMatrizSecao, pesoVereador: number) => number {
  const similaridadePorBairro = mapaPctSimilaridadePorBairro(
    [...linhas],
    vereadorId,
    estadualId,
    MARGEM_VOTOS_PARECIDOS,
  )
  const fatorBaixa = 1 - corte

  return (linha, pesoVereador) => {
    if (pesoVereador <= 0) return 0
    const pct = similaridadePorBairro.get(chaveBairroMatriz(linha.nmBairro)) ?? 0
    if (pct >= limiarPct) return pesoVereador
    return pesoVereador * fatorBaixa
  }
}

/** Projeta expectativa por seção a partir das urnas de 2024 (+ similaridade), sem forçar soma = planilha. */
export function distribuirExpectativaComDetalhes(
  referenciaPlanilha: number,
  linhas: readonly LinhaMatrizSecao[],
  params: {
    nomeLideranca: string
    candidatoIdReferencia: string
    candidatoIdEstadual?: string | null
  },
): {
  porSecao: Map<string, number>
  detalhesPorSecao: Map<string, ExpectativaSecaoDetalhe>
  detalhesPorBairro: Map<string, ExpectativaBairroDetalhe>
  usaRegraSimilaridade: boolean
  totalMapaEleitoral: number
} {
  const detalhesPorSecao = new Map<string, ExpectativaSecaoDetalhe>()
  const porSecao = new Map<string, number>()
  const detalhesPorBairro = new Map<string, ExpectativaBairroDetalhe>()

  if (linhas.length === 0) {
    return {
      porSecao,
      detalhesPorSecao,
      detalhesPorBairro,
      usaRegraSimilaridade: false,
      totalMapaEleitoral: 0,
    }
  }

  const usaRegraSimilaridade = Boolean(
    params.candidatoIdEstadual &&
      params.candidatoIdEstadual !== params.candidatoIdReferencia,
  )

  const similaridadePorBairro = usaRegraSimilaridade
    ? buildMapaSimilaridadeBairroDetalhado(
        linhas,
        params.candidatoIdReferencia,
        params.candidatoIdEstadual!,
      )
    : null

  const fatorBaixa = 1 - CORTE_PESO_VEREADOR_SIMILARIDADE_BAIXA

  const itens = linhas.map((l) => {
    const pesoBase = l.votos[params.candidatoIdReferencia] ?? 0
    const bairroId = chaveBairroMatriz(l.nmBairro)
    const bloco = similaridadePorBairro?.get(bairroId) ?? null
    const regra = resolverRegraExpectativa(usaRegraSimilaridade, bloco)
    let pesoUsado = pesoBase
    if (regra === 'similaridade_baixa' && pesoBase > 0) {
      pesoUsado = pesoBase * fatorBaixa
    }
    return { linha: l, bairroId, bloco, regra, pesoBase, pesoUsado }
  })

  const totalPeso = itens.reduce((s, i) => s + i.pesoUsado, 0)
  if (totalPeso <= 0) {
    return {
      porSecao,
      detalhesPorSecao,
      detalhesPorBairro,
      usaRegraSimilaridade,
      totalMapaEleitoral: 0,
    }
  }

  const alvoMapa = Math.round(totalPeso)
  const quotas = itens
    .filter((i) => i.pesoUsado > 0)
    .map((i) => {
      const exact = (alvoMapa * i.pesoUsado) / totalPeso
      const floor = Math.floor(exact)
      return { ...i, exact, floor, remainder: exact - floor }
    })

  let restante = alvoMapa - quotas.reduce((s, q) => s + q.floor, 0)
  quotas.sort((a, b) => b.remainder - a.remainder)

  const expectativaExataPorLocal = new Map<string, number>()
  for (const q of quotas) {
    expectativaExataPorLocal.set(q.linha.localId, q.exact)
  }

  const expectativaPorLocal = new Map<string, number>()
  for (let i = 0; i < quotas.length; i++) {
    const bonus = i < restante ? 1 : 0
    expectativaPorLocal.set(quotas[i].linha.localId, quotas[i].floor + bonus)
  }

  for (const i of itens) {
    if (i.pesoUsado <= 0) expectativaPorLocal.set(i.linha.localId, 0)
  }

  const totalMapaEleitoral = [...expectativaPorLocal.values()].reduce((s, v) => s + v, 0)

  const acumuloBairro = new Map<
    string,
    {
      nmBairro: string
      expectativa: number
      votosVereador: number
      pesoUsado: number
      totalSecoes: number
      regra: RegraExpectativaDistribuicao
      bloco: BlocoSimilaridadeBairro | null
    }
  >()

  for (const i of itens) {
    const expectativaSecao = expectativaPorLocal.get(i.linha.localId) ?? 0
    const expectativaExataSecao = expectativaExataPorLocal.get(i.linha.localId) ?? 0
    porSecao.set(i.linha.localId, expectativaSecao)

    const nmBairro = i.linha.nmBairro?.trim() || 'Sem bairro cadastrado'
    detalhesPorSecao.set(i.linha.localId, {
      regra: i.regra,
      localId: i.linha.localId,
      bairroId: i.bairroId,
      nmBairro,
      votosVereadorSecao: i.pesoBase,
      votosEstadualSecao: params.candidatoIdEstadual
        ? i.linha.votos[params.candidatoIdEstadual] ?? 0
        : 0,
      pesoVereadorUsado: i.pesoUsado,
      expectativaSecao,
      expectativaExataSecao,
      pctSimilaridadeBairro: i.bloco?.pct ?? null,
      secoesComAmbosNoBairro: i.bloco?.secoesComAmbos ?? 0,
      secoesParecidasNoBairro: i.bloco?.secoesParecidas ?? 0,
      totalExpectativaMunicipio: referenciaPlanilha,
      totalMapaEleitoral,
      totalPesoMunicipio: totalPeso,
      nomeLideranca: params.nomeLideranca,
    })

    const acc = acumuloBairro.get(i.bairroId) ?? {
      nmBairro,
      expectativa: 0,
      votosVereador: 0,
      pesoUsado: 0,
      totalSecoes: 0,
      regra: i.regra,
      bloco: i.bloco,
    }
    acc.expectativa += expectativaSecao
    acc.votosVereador += i.pesoBase
    acc.pesoUsado += i.pesoUsado
    acc.totalSecoes += 1
    acumuloBairro.set(i.bairroId, acc)
  }

  for (const [bairroId, acc] of acumuloBairro) {
    detalhesPorBairro.set(bairroId, {
      regra: acc.regra,
      bairroId,
      nmBairro: acc.nmBairro,
      expectativaBairro: acc.expectativa,
      expectativaProporcionalExataBairro: acc.pesoUsado,
      votosVereadorBairro: acc.votosVereador,
      pesoUsadoBairro: acc.pesoUsado,
      totalPesoMunicipio: totalPeso,
      totalSecoesBairro: acc.totalSecoes,
      pctSimilaridadeBairro: acc.bloco?.pct ?? null,
      secoesComAmbosNoBairro: acc.bloco?.secoesComAmbos ?? 0,
      secoesParecidasNoBairro: acc.bloco?.secoesParecidas ?? 0,
      totalExpectativaMunicipio: referenciaPlanilha,
      totalMapaEleitoral,
      nomeLideranca: params.nomeLideranca,
    })
  }

  return {
    porSecao,
    detalhesPorSecao,
    detalhesPorBairro,
    usaRegraSimilaridade,
    totalMapaEleitoral,
  }
}

/** Distribui expectativa inteira proporcionalmente aos votos do candidato referência por seção. */
export function distribuirExpectativaProporcionalSecao(
  totalExpectativa: number,
  linhas: readonly LinhaMatrizSecao[],
  candidatoIdReferencia: string,
  ajustarPeso?: (linha: LinhaMatrizSecao, pesoVereador: number) => number,
): Map<string, number> {
  const out = new Map<string, number>()
  if (totalExpectativa <= 0 || linhas.length === 0) return out

  const itens = linhas.map((l) => {
    const pesoBase = l.votos[candidatoIdReferencia] ?? 0
    const peso = ajustarPeso ? ajustarPeso(l, pesoBase) : pesoBase
    return { localId: l.localId, peso }
  })

  const totalPeso = itens.reduce((s, i) => s + i.peso, 0)
  if (totalPeso <= 0) return out

  const quotas = itens
    .filter((i) => i.peso > 0)
    .map((i) => {
      const exact = (totalExpectativa * i.peso) / totalPeso
      const floor = Math.floor(exact)
      return { localId: i.localId, floor, remainder: exact - floor }
    })

  let restante = totalExpectativa - quotas.reduce((s, q) => s + q.floor, 0)
  quotas.sort((a, b) => b.remainder - a.remainder)

  for (let i = 0; i < quotas.length; i++) {
    const bonus = i < restante ? 1 : 0
    out.set(quotas[i].localId, quotas[i].floor + bonus)
  }

  for (const i of itens) {
    if (i.peso <= 0) out.set(i.localId, 0)
  }

  return out
}

export function injetarColunaExpectativaLideranca(
  matriz: MatrizVotacaoSecao,
  params: {
    nomeLideranca: string
    totalExpectativa: number
    candidatoIdReferencia: string
    candidatoIdEstadual?: string | null
    rotuloCargo?: string
  } | null,
): InjetarExpectativaLiderancaResult {
  const vazio: InjetarExpectativaLiderancaResult = {
    matriz,
    detalhesPorSecao: new Map(),
    detalhesPorBairro: new Map(),
    usaRegraSimilaridade: false,
    totalMapaEleitoral: 0,
    totalReferenciaPlanilha: 0,
  }

  if (!params || !params.candidatoIdReferencia) {
    return vazio
  }

  const { porSecao, detalhesPorSecao, detalhesPorBairro, usaRegraSimilaridade, totalMapaEleitoral } =
    distribuirExpectativaComDetalhes(params.totalExpectativa ?? 0, matriz.linhas, {
      nomeLideranca: params.nomeLideranca,
      candidatoIdReferencia: params.candidatoIdReferencia,
      candidatoIdEstadual: params.candidatoIdEstadual,
    })

  if (porSecao.size === 0 || totalMapaEleitoral <= 0) return vazio

  const totalDistribuido = totalMapaEleitoral

  const candidatoExtra: CandidatoMatrizColuna = {
    id: CANDIDATO_EXPECTATIVA_LIDERANCA_ID,
    dsCargo: params.rotuloCargo ?? 'Expectativa 2026',
    nrVotavel: 0,
    nmVotavel: params.nomeLideranca,
    totalVotos: totalDistribuido,
    anoEleicao: 2026,
  }

  const linhas = matriz.linhas.map((l) => ({
    ...l,
    votos: {
      ...l.votos,
      [CANDIDATO_EXPECTATIVA_LIDERANCA_ID]: porSecao.get(l.localId) ?? 0,
    },
  }))

  return {
    matriz: {
      candidatos: [...matriz.candidatos, candidatoExtra],
      linhas,
    },
    detalhesPorSecao,
    detalhesPorBairro,
    usaRegraSimilaridade,
    totalMapaEleitoral,
    totalReferenciaPlanilha: Math.round(params.totalExpectativa ?? 0),
  }
}

export function isColunaExpectativaLideranca(candidatoId: string): boolean {
  return candidatoId === CANDIDATO_EXPECTATIVA_LIDERANCA_ID
}
