/**
 * Feedback automático (regras, sem IA) sobre desempenho em pesquisas cadastradas.
 * Usa apenas intenção, rejeição, tipo, instituto, cidade e série temporal.
 */

import { isNaoSabeOuNaoOpinaNome } from '@/lib/espontanea-normalize'

export type PollFeedbackLinha = {
  data: string
  instituto: string
  candidato_nome: string
  tipo: 'estimulada' | 'espontanea'
  cidade_id?: string | null
  intencao: number
  rejeicao: number
  cities?: { name?: string | null }
}

export type FeedbackDesempenhoCandidato = {
  bullets: string[]
  avisos: string[]
}

const PP_RELEVANTE = 1.5

export function dataPesquisaNormalizada(data: string): string {
  if (!data) return ''
  return data.includes('T') ? data.split('T')[0] : data
}

export function chaveOndaPesquisa(p: Pick<PollFeedbackLinha, 'data' | 'instituto' | 'cidade_id' | 'tipo'>): string {
  const d = dataPesquisaNormalizada(p.data)
  const inst = p.instituto.trim().toLowerCase()
  const cid = p.cidade_id ?? '—'
  return `${d}|${inst}|${cid}|${p.tipo}`
}

function toDateMs(data: string): number {
  if (!data) return 0
  if (data.includes('T')) return new Date(data).getTime()
  const [y, m, day] = data.split('-').map(Number)
  if (!y || !m || !day) return 0
  return new Date(y, m - 1, day).getTime()
}

function formatDataCurta(data: string): string {
  const d = dataPesquisaNormalizada(data)
  const [y, m, day] = d.split('-').map(Number)
  if (!y || !m || !day) return data
  return new Date(y, m - 1, day).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function tipoLabel(t: 'estimulada' | 'espontanea'): string {
  return t === 'estimulada' ? 'estimulada' : 'espontânea'
}

function media(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function desvioAmostral(nums: number[]): number {
  if (nums.length < 2) return 0
  const m = media(nums)
  const s = nums.reduce((acc, x) => acc + (x - m) ** 2, 0) / (nums.length - 1)
  return Math.sqrt(s)
}

function rankeamentoNasOndasOrdenadoPorData(candidatoNome: string, todos: PollFeedbackLinha[]) {
  const map = new Map<string, PollFeedbackLinha[]>()
  for (const p of todos) {
    const k = chaveOndaPesquisa(p)
    const arr = map.get(k) ?? []
    arr.push(p)
    map.set(k, arr)
  }

  const linhas: {
    rank: number
    total: number
    intencao: number
    dataMs: number
    dataFmt: string
    instituto: string
    tipo: string
    cidade?: string
  }[] = []

  for (const [, grupo] of map) {
    const doCandidato = grupo.find((x) => x.candidato_nome === candidatoNome)
    if (!doCandidato) continue
    const ordenados = [...grupo].sort((a, b) => (b.intencao || 0) - (a.intencao || 0))
    const idx = ordenados.findIndex((x) => x.candidato_nome === candidatoNome)
    if (idx < 0) continue
    linhas.push({
      rank: idx + 1,
      total: ordenados.length,
      intencao: doCandidato.intencao || 0,
      dataMs: toDateMs(doCandidato.data),
      dataFmt: formatDataCurta(doCandidato.data),
      instituto: doCandidato.instituto,
      tipo: tipoLabel(doCandidato.tipo),
      cidade: doCandidato.cities?.name ?? undefined,
    })
  }

  return linhas.sort((a, b) => a.dataMs - b.dataMs)
}

export function gerarFeedbackDesempenhoCandidato(
  candidatoNome: string,
  linhasDoCandidato: PollFeedbackLinha[],
  todosParaRanking: PollFeedbackLinha[]
): FeedbackDesempenhoCandidato {
  const bullets: string[] = []
  const avisos: string[] = []

  const ordenadas = [...linhasDoCandidato].sort((a, b) => toDateMs(a.data) - toDateMs(b.data))
  if (ordenadas.length === 0) {
    return { bullets: [], avisos: [] }
  }

  const ints = ordenadas.map((p) => p.intencao || 0)
  const rejs = ordenadas.map((p) => p.rejeicao || 0)
  const primeira = ordenadas[0]
  const ultima = ordenadas[ordenadas.length - 1]

  const tipos = new Set(ordenadas.map((p) => p.tipo))
  if (tipos.size > 1) {
    avisos.push(
      'A série mistura pesquisa estimulada e espontânea: compare principalmente dentro do mesmo tipo, pois os níveis de intenção costumam ser incomparáveis entre eles.'
    )
  }

  if (ordenadas.length === 1) {
    const p = primeira
    const onde = p.cities?.name ? ` em ${p.cities.name}` : ''
    bullets.push(
      `Único registro no filtro atual (${formatDataCurta(p.data)}${onde}, ${p.instituto}, ${tipoLabel(p.tipo)}): intenção ${(p.intencao || 0).toFixed(1)}% e rejeição ${(p.rejeicao || 0).toFixed(1)}%. Inclua mais leituras para avaliar tendência.`
    )
    return { bullets, avisos }
  }

  const delta = (ultima.intencao || 0) - (primeira.intencao || 0)
  const deltaRej = (ultima.rejeicao || 0) - (primeira.rejeicao || 0)

  if (Math.abs(delta) < PP_RELEVANTE) {
    bullets.push(
      `Entre a primeira leitura (${formatDataCurta(primeira.data)}) e a mais recente (${formatDataCurta(ultima.data)}), a intenção permaneceu estável em torno de ${(ultima.intencao || 0).toFixed(1)}% (variação líquida ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} p.p.).`
    )
  } else if (delta > 0) {
    bullets.push(
      `Tendência de intenção em alta: de ${(primeira.intencao || 0).toFixed(1)}% (${formatDataCurta(primeira.data)}) para ${(ultima.intencao || 0).toFixed(1)}% (${formatDataCurta(ultima.data)}), ganho líquido de ${delta.toFixed(1)} p.p.`
    )
  } else {
    bullets.push(
      `Tendência de intenção em queda: de ${(primeira.intencao || 0).toFixed(1)}% (${formatDataCurta(primeira.data)}) para ${(ultima.intencao || 0).toFixed(1)}% (${formatDataCurta(ultima.data)}), perda líquida de ${Math.abs(delta).toFixed(1)} p.p.`
    )
  }

  if (ordenadas.length >= 3) {
    const sd = desvioAmostral(ints)
    const amplitude = Math.max(...ints) - Math.min(...ints)
    if (sd >= 4) {
      avisos.push(
        `Oscilação relevante entre leituras (desvio ~${sd.toFixed(1)} p.p.): confira se mudou instituto, tipo de pergunta, cidade ou universo — comparações diretas nem sempre são equivalentes.`
      )
    } else if (amplitude >= 8 && sd < 4) {
      bullets.push(
        `Há picos e vales na série (amplitude ${amplitude.toFixed(1)} p.p.); a média no período ficou em ${media(ints).toFixed(1)}%.`
      )
    }
  }

  if (ordenadas.length >= 2) {
    const semUltima = ints.slice(0, -1)
    const mediaAnt = media(semUltima)
    const ult = ultima.intencao || 0
    const vsMedia = ult - mediaAnt
    if (Math.abs(vsMedia) >= PP_RELEVANTE) {
      bullets.push(
        vsMedia > 0
          ? `A última leitura (${ult.toFixed(1)}%) está acima da média das anteriores (${mediaAnt.toFixed(1)}%).`
          : `A última leitura (${ult.toFixed(1)}%) está abaixo da média das anteriores (${mediaAnt.toFixed(1)}%).`
      )
    }
  }

  if (Math.abs(deltaRej) >= PP_RELEVANTE) {
    bullets.push(
      deltaRej > 0
        ? `Rejeição subiu ${deltaRej.toFixed(1)} p.p. no período (de ${(primeira.rejeicao || 0).toFixed(1)}% para ${(ultima.rejeicao || 0).toFixed(1)}%).`
        : `Rejeição caiu ${Math.abs(deltaRej).toFixed(1)} p.p. no período (de ${(primeira.rejeicao || 0).toFixed(1)}% para ${(ultima.rejeicao || 0).toFixed(1)}%).`
    )
  } else {
    bullets.push(
      `Rejeição média no período: ${media(rejs).toFixed(1)}%, com variação líquida modesta entre primeira e última leitura.`
    )
  }

  const ranks = rankeamentoNasOndasOrdenadoPorData(candidatoNome, todosParaRanking)
  const comConcorrencia = ranks.filter((r) => r.total > 1)
  if (comConcorrencia.length > 0) {
    const primeiros = comConcorrencia.filter((r) => r.rank === 1).length
    const ultimoR = comConcorrencia[comConcorrencia.length - 1]
    bullets.push(
      `Nas ondas com mais de um candidato no mesmo recorte (${comConcorrencia.length} leitura(s)), ficou em 1º lugar em ${primeiros} delas. Na mais recente (${ultimoR.dataFmt}, ${ultimoR.instituto}, ${ultimoR.tipo}${ultimoR.cidade ? `, ${ultimoR.cidade}` : ''}): posição ${ultimoR.rank}º de ${ultimoR.total} com ${ultimoR.intencao.toFixed(1)}%.`
    )
  } else if (ranks.length > 0) {
    avisos.push(
      'Não há outro candidato cadastrado na mesma data/instituto/cidade/tipo: o ranking relativo só aparece quando existem pares na mesma onda.'
    )
  }

  if (ordenadas.length < 3) {
    avisos.push('Poucos pontos na série: o feedback ganha robustez com mais pesquisas ao longo do tempo.')
  }

  return { bullets, avisos }
}

function parsePctValorGrafico(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return null
    const normalized =
      t.includes(',') && t.includes('.')
        ? t.replace(/\./g, '').replace(',', '.')
        : t.includes(',')
          ? t.replace(',', '.')
          : t
    const n = Number(normalized)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Metadado por data no gráfico «Todas» (estimulada / espontânea / mista). */
export type GraficoLinhaMetaTipos = {
  apenasEspontanea: boolean
  apenasEstimulada: boolean
  mista: boolean
}

/** Deriva o recorte metodológico da linha a partir do Set gravado na agregação por data. */
export function metaTiposFromRowSet(tipos: unknown): GraficoLinhaMetaTipos {
  if (!(tipos instanceof Set) || tipos.size === 0) {
    return { apenasEspontanea: false, apenasEstimulada: false, mista: true }
  }
  const hasE = tipos.has('espontanea')
  const hasS = tipos.has('estimulada')
  if (tipos.size === 1 && hasE) {
    return { apenasEspontanea: true, apenasEstimulada: false, mista: false }
  }
  if (tipos.size === 1 && hasS) {
    return { apenasEspontanea: false, apenasEstimulada: true, mista: false }
  }
  return { apenasEspontanea: false, apenasEstimulada: false, mista: true }
}

function somaIntencaoNaoSabeNaLinha(
  row: Readonly<Record<string, string | number | undefined>>
): number {
  let s = 0
  for (const k of Object.keys(row)) {
    if (!k.startsWith('intencao_')) continue
    const nomeFromKey = k.replace(/^intencao_/, '').replace(/_/g, ' ')
    if (!isNaoSabeOuNaoOpinaNome(nomeFromKey)) continue
    const v = parsePctValorGrafico(row[k])
    if (v !== null) s += v
  }
  return s
}

/**
 * Legenda do gráfico: alta / queda / estável quando o recorte é comparável; aviso explícito ao cruzar estimulada e espontânea.
 */
export function gerarResumoLegendaSerieGrafico(
  candidatoNome: string,
  pesquisaData: ReadonlyArray<Record<string, string | number | undefined>>,
  todosParaRanking?: PollFeedbackLinha[],
  metaPorLinha?: ReadonlyArray<GraficoLinhaMetaTipos>
): string {
  const nLinhas = pesquisaData.length
  const metaOk = Boolean(metaPorLinha && metaPorLinha.length === nLinhas)

  const key = `intencao_${candidatoNome.replace(/\s+/g, '_')}`
  const pontos: { val: number; meta: GraficoLinhaMetaTipos; idx: number }[] = []
  for (let i = 0; i < nLinhas; i++) {
    const v = parsePctValorGrafico(pesquisaData[i][key])
    if (v === null) continue
    const meta: GraficoLinhaMetaTipos =
      metaOk && metaPorLinha
        ? metaPorLinha[i]
        : { apenasEspontanea: false, apenasEstimulada: false, mista: false }
    pontos.push({ val: v, meta, idx: i })
  }

  if (pontos.length === 0) {
    return 'Sem leitura no gráfico.'
  }

  let nucleo: string
  let extraIndecisao = ''

  if (pontos.length === 1) {
    nucleo = 'Única leitura no gráfico.'
  } else {
    const first = pontos[0]
    const last = pontos[pontos.length - 1]

    if (!metaOk) {
      const d = last.val - first.val
      if (Math.abs(d) < PP_RELEVANTE) nucleo = 'Estável no período.'
      else if (d > 0) nucleo = 'Tendência de alta.'
      else nucleo = 'Em queda.'
    } else {
      const extremoMisto = first.meta.mista || last.meta.mista
      const homogEsp = first.meta.apenasEspontanea && last.meta.apenasEspontanea
      const homogEst = first.meta.apenasEstimulada && last.meta.apenasEstimulada
      const cruzaEstParaEsp =
        !extremoMisto && first.meta.apenasEstimulada && last.meta.apenasEspontanea
      const cruzaEspParaEst =
        !extremoMisto && first.meta.apenasEspontanea && last.meta.apenasEstimulada

      const isNsLinha = isNaoSabeOuNaoOpinaNome(candidatoNome)
      const dCruzamento = last.val - first.val
      const nsUltimaLinha =
        last.idx >= 0 && last.idx < pesquisaData.length
          ? somaIntencaoNaoSabeNaLinha(pesquisaData[last.idx])
          : 0

      if (extremoMisto) {
        if (Math.abs(dCruzamento) >= PP_RELEVANTE) {
          const ref = dCruzamento > 0 ? 'Há alta na série, porém ' : 'Há queda na série, porém '
          nucleo =
            ref +
            'há datas com estimulada e espontânea juntas no gráfico — compare sempre dentro do mesmo tipo antes de concluir.'
        } else {
          nucleo =
            'Datas com estimulada e espontânea no mesmo dia no gráfico — não conclua tendência só por esta linha.'
        }
      } else if (cruzaEstParaEsp && isNsLinha) {
        if (dCruzamento > PP_RELEVANTE) {
          nucleo =
            '«Não sabe» subiu na espontânea — padrão esperado ao sair da lista; indecisão maior no recorte, não “onda” isolada.'
        } else if (dCruzamento < -PP_RELEVANTE) {
          nucleo =
            '«Não sabe» caiu mesmo na espontânea — atípico; vale cruzar com o boletim ou o cadastro dos números.'
        } else {
          nucleo =
            'Estimulada → espontânea: «Não sabe» sem salto forte — mudança de método presente; leitura com ressalva.'
        }
        if (nsUltimaLinha >= 22) {
          nucleo += ` Última espontânea: «Não sabe» ${nsUltimaLinha.toFixed(1)}%.`
        }
      } else if (cruzaEspParaEst && isNsLinha) {
        if (dCruzamento < -PP_RELEVANTE) {
          nucleo =
            '«Não sabe» caiu na estimulada — coerente com a lista que ancora nomes; efeito metodológico típico.'
        } else if (dCruzamento > PP_RELEVANTE) {
          nucleo =
            '«Não sabe» subiu na estimulada — incomum; sugerimos checar consistência do cadastro ou do recorte.'
        } else {
          nucleo =
            'Espontânea → estimulada: «Não sabe» estável entre tipos — mantenha ressalva metodológica.'
        }
      } else if (cruzaEstParaEsp) {
        if (Math.abs(dCruzamento) < PP_RELEVANTE) {
          nucleo =
            'Estável entre a última estimulada e a espontânea — recortes diferentes; tendência fraca para conclusão direta.'
        } else if (dCruzamento > 0) {
          nucleo =
            'Subiu na passagem estimulada → espontânea: leitura favorável (na espontânea os % costumam ser mais comprimidos).'
        } else {
          nucleo =
            'Caiu na passagem estimulada → espontânea; distinga perda real de voto do efeito de mais indecisão no recorte.'
        }
        if (nsUltimaLinha >= 22) {
          nucleo += ` Última espontânea: «Não sabe» ${nsUltimaLinha.toFixed(1)}% (indecisão relevante).`
        }
      } else if (cruzaEspParaEst) {
        if (Math.abs(dCruzamento) < PP_RELEVANTE) {
          nucleo =
            'Estável entre espontânea e estimulada — mudou o método; evite tratar como mesma régua de leitura.'
        } else if (dCruzamento > 0) {
          nucleo =
            'Subiu na passagem espontânea → estimulada: a lista costuma puxar votos da indecisão — parte do ganho pode ser metodológica.'
        } else {
          nucleo =
            'Caiu mesmo na estimulada — sinal mais forte de enfraquecimento do que mera troca espontânea → lista.'
        }
      } else if (homogEsp || homogEst) {
        const d = last.val - first.val
        if (Math.abs(d) < PP_RELEVANTE) nucleo = 'Estável no período.'
        else if (d > 0) nucleo = 'Tendência de alta.'
        else nucleo = 'Em queda.'

        if (
          homogEsp &&
          !isNaoSabeOuNaoOpinaNome(candidatoNome) &&
          last.idx >= 0 &&
          last.idx < pesquisaData.length
        ) {
          const ns = somaIntencaoNaoSabeNaLinha(pesquisaData[last.idx])
          if (ns >= 34) {
            extraIndecisao = ' «Não sabe» ainda elevado na última espontânea.'
          }
        }
      } else {
        nucleo = 'Recortes metodológicos distintos entre as datas — interpretar com ressalva.'
      }
    }
  }

  let out = nucleo + extraIndecisao

  if (todosParaRanking?.length) {
    const ranks = rankeamentoNasOndasOrdenadoPorData(candidatoNome, todosParaRanking)
    const com = ranks.filter((r) => r.total > 1)
    if (com.length > 0) {
      const r = com[com.length - 1]
      out += ` · ${r.rank}º de ${r.total}`
    }
  }

  return out
}
