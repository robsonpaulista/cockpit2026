export type RankingEstimuladaApiPayload = {
  posicao?: number
  totalCandidatos?: number
  mediaCandidato?: number | null
  mediaCandidatoAjustada?: number | null
  pesquisasCandidato?: number
  candidato?: string
  projecaoVotos?: number | null
  cidadesComPesquisa?: number
  criterioRanking?: string
  top10?: Array<{
    posicao: number
    nome: string
    media: number
    mediaAjustada?: number
    totalPesquisas: number
  }>
  message?: string
}

function formatPct(value: number): string {
  return value.toFixed(1).replace('.', ',')
}

function formatVotos(value: number): string {
  return value.toLocaleString('pt-BR')
}

export function formatRankingEstimuladaFederalReply(payload: RankingEstimuladaApiPayload): string {
  if (payload.message && !payload.top10?.length) {
    return payload.message
  }

  const candidato = payload.candidato || 'Candidato'
  const posicao = payload.posicao ?? 0
  const total = payload.totalCandidatos ?? 0

  if (total === 0 || !payload.top10?.length) {
    return 'Não há pesquisas **estimuladas** para **dep. federal** cadastradas. Inclua leituras em Pesquisa & Relato.'
  }

  let out = `**Ranking estimulada · Dep. Federal**\n`
  out += `Critério: média de intenção ponderada pela cobertura de pesquisas\n\n`

  if (posicao > 0) {
    out += `**${candidato}:** ${posicao}º de ${total}`
    if (payload.mediaCandidato != null) {
      out += ` · média **${formatPct(payload.mediaCandidato)}%**`
    }
    if (
      payload.mediaCandidatoAjustada != null &&
      payload.mediaCandidatoAjustada !== payload.mediaCandidato
    ) {
      out += ` (ajustada ${formatPct(payload.mediaCandidatoAjustada)}%)`
    }
    if (payload.pesquisasCandidato != null && payload.pesquisasCandidato > 0) {
      out += ` · ${payload.pesquisasCandidato} pesquisa(s)`
    }
    out += '\n'
  } else {
    out += `**${candidato}** não aparece no ranking estimulada dep. federal.\n`
  }

  if (payload.projecaoVotos != null && payload.projecaoVotos > 0) {
    out += `Projeção de votos (última leitura por cidade): **${formatVotos(payload.projecaoVotos)}**`
    if (payload.cidadesComPesquisa) {
      out += ` · ${payload.cidadesComPesquisa} cidade(s) com pesquisa`
    }
    out += '\n'
  }

  out += '\n**Top 10:**\n'
  payload.top10.forEach((c) => {
    const destaque = c.nome.toUpperCase() === candidato.toUpperCase() ? ' ◀' : ''
    out += `${c.posicao}. ${c.nome} — ${formatPct(c.media)}% (${c.totalPesquisas} pesq.)${destaque}\n`
  })

  return out.trim()
}
