/**
 * Leituras automáticas do Comparativo de base (Resultado 2026).
 * Cruza concentração (%), tamanho da base (eleitores/votantes) e votos no recorte.
 */

import type { ColunaComparativoBase, RecorteComparativoBase } from '@/lib/comparativo-base-2026'

export type ColunaAnaliseComparativo = {
  nome: string
  partido: string
  dados: ColunaComparativoBase
}

export type InsightComparativoBase = {
  id: string
  titulo: string
  texto: string
}

function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR')
}

function fmtPct(n: number): string {
  return `${n.toFixed(1).replace('.', ',')}%`
}

const TITULOS = new Set([
  'delegado',
  'delegada',
  'dr',
  'dr.',
  'dra',
  'dra.',
  'padre',
  'pastor',
  'pastora',
  'prof',
  'prof.',
  'professor',
  'professora',
])

function primeiroNome(nome: string): string {
  const limpo = nome.trim()
  if (!limpo) return 'Candidato'
  const partes = limpo.split(/\s+/).filter(Boolean)
  if (partes.length >= 2 && TITULOS.has(partes[0].toLowerCase())) {
    return `${partes[0]} ${partes[1]}`
  }
  return partes[0] ?? limpo
}

function eleitoresMedios(coluna: ColunaComparativoBase): number | null {
  if (coluna.cidades.length === 0 || coluna.eleitores <= 0) return null
  return coluna.eleitores / coluna.cidades.length
}

/**
 * Gera 2–5 leituras objetivas a partir das colunas já recortadas.
 * Retorna vazio com menos de 2 candidatos.
 */
export function gerarAnalisesComparativoBase(opts: {
  recorte: RecorteComparativoBase
  colunas: ColunaAnaliseComparativo[]
}): InsightComparativoBase[] {
  const { recorte, colunas } = opts
  if (colunas.length < 2) return []

  const insights: InsightComparativoBase[] = []
  const comPct = colunas.filter((c) => c.dados.pctVotantes != null)
  const comEleitores = colunas.filter((c) => c.dados.eleitores > 0)

  const porConcentracao = [...comPct].sort(
    (a, b) => (b.dados.pctVotantes ?? 0) - (a.dados.pctVotantes ?? 0),
  )
  const porEleitorado = [...comEleitores].sort((a, b) => b.dados.eleitores - a.dados.eleitores)
  const porVotos = [...colunas].sort((a, b) => b.dados.votos - a.dados.votos)

  const maisConcentrado = porConcentracao[0]
  const menosConcentrado = porConcentracao[porConcentracao.length - 1]
  const maiorBase = porEleitorado[0]
  const menorBase = porEleitorado[porEleitorado.length - 1]
  const maisVotos = porVotos[0]

  const baseLabel = recorte.base === 'eleitorado' ? 'eleitores' : 'votantes'
  const recorteLabel =
    recorte.modo === 'proporcao'
      ? `top ${fmtInt(recorte.quantidade)} por proporção sobre ${baseLabel}`
      : recorte.modo === 'votos'
        ? `top ${fmtInt(recorte.quantidade)} por votos`
        : `cidades com ≥ ${fmtInt(recorte.quantidade)} votos`

  if (maisConcentrado && menosConcentrado && maisConcentrado !== menosConcentrado) {
    const alta = maisConcentrado.dados.pctVotantes ?? 0
    const baixa = menosConcentrado.dados.pctVotantes ?? 0
    if (alta - baixa >= 8) {
      insights.push({
        id: 'concentracao',
        titulo: 'Concentração no recorte',
        texto:
          `${primeiroNome(maisConcentrado.nome)} lidera a concentração: ` +
          `${fmtPct(alta)} dos votantes nas próprias cidades do recorte ` +
          `(${recorteLabel}). ${primeiroNome(menosConcentrado.nome)} fica em ` +
          `${fmtPct(baixa)} no mesmo critério — fatia menor, ainda que a base possa ser maior.`,
      })
    }
  }

  if (maiorBase && menorBase && maiorBase !== menorBase) {
    const razao = maiorBase.dados.eleitores / Math.max(1, menorBase.dados.eleitores)
    if (razao >= 1.4) {
      const mediaMaior = eleitoresMedios(maiorBase.dados)
      const mediaMenor = eleitoresMedios(menorBase.dados)
      let detalheMedias = ''
      if (mediaMaior != null && mediaMenor != null && mediaMaior > mediaMenor * 1.25) {
        detalheMedias =
          ` Em média, cada cidade do recorte de ${primeiroNome(maiorBase.nome)} tem ` +
          `${fmtInt(mediaMaior)} eleitores, contra ${fmtInt(mediaMenor)} no de ` +
          `${primeiroNome(menorBase.nome)}.`
      }
      insights.push({
        id: 'escala-base',
        titulo: 'Tamanho da base',
        texto:
          `O recorte de ${primeiroNome(maiorBase.nome)} cobre ${fmtInt(maiorBase.dados.eleitores)} eleitores — ` +
          `${razao.toFixed(1).replace('.', ',')}× o de ${primeiroNome(menorBase.nome)} ` +
          `(${fmtInt(menorBase.dados.eleitores)}).` +
          detalheMedias,
      })
    }
  }

  // Contraste clássico: quem concentra mais tem base menor; quem dilui % tem base maior.
  if (
    maisConcentrado &&
    maiorBase &&
    menosConcentrado &&
    maisConcentrado !== maiorBase &&
    maisConcentrado.dados.eleitores > 0 &&
    maiorBase.dados.eleitores > 0 &&
    (maisConcentrado.dados.pctVotantes ?? 0) >= (maiorBase.dados.pctVotantes ?? 0) + 8 &&
    maiorBase.dados.eleitores >= maisConcentrado.dados.eleitores * 1.4
  ) {
    insights.push({
      id: 'concentracao-vs-escala',
      titulo: 'Concentração × escala',
      texto:
        `${primeiroNome(maisConcentrado.nome)} concentra forte ` +
        `(${fmtPct(maisConcentrado.dados.pctVotantes ?? 0)} dos votantes) em um conjunto menor de cidades ` +
        `(${fmtInt(maisConcentrado.dados.eleitores)} eleitores). ` +
        `${primeiroNome(maiorBase.nome)} aparece com fatia menor ` +
        `(${fmtPct(maiorBase.dados.pctVotantes ?? 0)}), porém nas cidades grandes do próprio ranking — ` +
        `${fmtInt(maiorBase.dados.eleitores)} eleitores e ${fmtInt(maiorBase.dados.votos)} votos no recorte.`,
    })
  }

  if (maisVotos && maisConcentrado && maisVotos !== maisConcentrado) {
    const pctMaisVotos = maisVotos.dados.pctVotantes
    const pctMaisConc = maisConcentrado.dados.pctVotantes
    if (
      pctMaisVotos != null &&
      pctMaisConc != null &&
      pctMaisConc > pctMaisVotos + 5 &&
      maisVotos.dados.votos > maisConcentrado.dados.votos
    ) {
      insights.push({
        id: 'votos-apesar-pct',
        titulo: 'Mais votos com menor %',
        texto:
          `${primeiroNome(maisVotos.nome)} soma ${fmtInt(maisVotos.dados.votos)} votos no recorte, ` +
          `acima de ${primeiroNome(maisConcentrado.nome)} (${fmtInt(maisConcentrado.dados.votos)}), ` +
          `mesmo com concentração menor (${fmtPct(pctMaisVotos)} vs ${fmtPct(pctMaisConc)}). ` +
          `O volume das cidades do ranking pesa mais que a fatia percentual.`,
      })
    }
  }

  // Terceiro candidato “no meio” de eleitorado, se houver.
  if (colunas.length >= 3 && porEleitorado.length >= 3) {
    const meioEleitorado = porEleitorado[1]
    if (
      meioEleitorado &&
      maiorBase &&
      menorBase &&
      meioEleitorado !== maiorBase &&
      meioEleitorado !== menorBase
    ) {
      const pctMeio = meioEleitorado.dados.pctVotantes
      insights.push({
        id: 'meio-termo',
        titulo: 'Perfil intermediário',
        texto:
          `${primeiroNome(meioEleitorado.nome)} fica entre os extremos de eleitorado ` +
          `(${fmtInt(meioEleitorado.dados.eleitores)})` +
          (pctMeio != null
            ? ` e marca ${fmtPct(pctMeio)} dos votantes no recorte.`
            : '.'),
      })
    }
  }

  // Limita para não poluir a UI
  const prioridade = [
    'concentracao-vs-escala',
    'votos-apesar-pct',
    'concentracao',
    'escala-base',
    'meio-termo',
  ]
  return prioridade
    .map((id) => insights.find((i) => i.id === id))
    .filter((i): i is InsightComparativoBase => Boolean(i))
    .slice(0, 4)
}
