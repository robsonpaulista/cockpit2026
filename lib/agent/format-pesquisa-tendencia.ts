export type HistoricoIntencaoPonto = {
  date: string
  dateOriginal: string
  intencao: number
  instituto?: string
  cidade?: string
}

export type HistoricoIntencaoApiPayload = {
  data?: HistoricoIntencaoPonto[]
  candidato?: string
  mediasPorRegiao?: Array<{ regiao: string; media: number; n: number }>
  historicoMunicipioFiltro?: HistoricoIntencaoPonto[]
  mediaMunicipioFiltro?: number | null
  registrosMunicipioFiltro?: number
  municipioFiltro?: string | null
  message?: string
}

function formatPct(value: number): string {
  return value.toFixed(1).replace('.', ',')
}

function formatDataCompleta(dateOriginal: string): string {
  const [y, m, d] = dateOriginal.split('-')
  if (y?.length === 4 && m && d) return `${d}/${m}/${y}`
  return dateOriginal
}

function tendenciaLabel(delta: number): string {
  if (Math.abs(delta) < 1.5) return 'estável'
  return delta > 0 ? 'em alta' : 'em queda'
}

export function formatPesquisaTendenciaReply(
  payload: HistoricoIntencaoApiPayload,
  options: { candidato: string; municipio?: string }
): string {
  const serie =
    options.municipio && (payload.historicoMunicipioFiltro?.length ?? 0) > 0
      ? payload.historicoMunicipioFiltro!
      : payload.data ?? []

  if (serie.length === 0) {
    const alvo = options.municipio ? ` em **${options.municipio}**` : ''
    return `Não há histórico de intenção para **${options.candidato}**${alvo}. Cadastre pesquisas em Pesquisa & Relato.`
  }

  const ordenada = [...serie].sort((a, b) => a.dateOriginal.localeCompare(b.dateOriginal))
  const primeira = ordenada[0]
  const ultima = ordenada[ordenada.length - 1]
  const delta = ultima.intencao - primeira.intencao
  const mediaSerie =
    Math.round((ordenada.reduce((s, p) => s + p.intencao, 0) / ordenada.length) * 10) / 10

  const tituloMunicipio = options.municipio ? ` · ${options.municipio}` : ''
  let out = `**Tendência de intenção** · ${options.candidato}${tituloMunicipio}\n\n`

  if (ordenada.length === 1) {
    const p = primeira
    out += `Única leitura (${formatDataCompleta(p.dateOriginal)}): **${formatPct(p.intencao)}%**`
    if (p.instituto) out += ` · ${p.instituto}`
    if (p.cidade && !options.municipio) out += ` · ${p.cidade}`
    out += '.\n\nCadastre mais pesquisas para avaliar evolução temporal.'
    return out.trim()
  }

  out += `Período: ${formatDataCompleta(primeira.dateOriginal)} → ${formatDataCompleta(ultima.dateOriginal)} (${ordenada.length} leituras)\n`
  out += `Tendência **${tendenciaLabel(delta)}**: ${formatPct(primeira.intencao)}% → ${formatPct(ultima.intencao)}% (${delta >= 0 ? '+' : ''}${formatPct(delta)} p.p.)\n`
  out += `Média no período: **${formatPct(mediaSerie)}%**\n`

  if (options.municipio && payload.mediaMunicipioFiltro != null) {
    out += `Média em ${options.municipio}: **${formatPct(payload.mediaMunicipioFiltro)}%** (${payload.registrosMunicipioFiltro ?? 0} registro(s))\n`
  }

  const pontosExibir = ordenada.slice(-8)
  out += '\n**Evolução (mais recentes):**\n'
  pontosExibir.forEach((p) => {
    const extras: string[] = []
    if (p.instituto) extras.push(p.instituto)
    if (p.cidade && !options.municipio) extras.push(p.cidade)
    const sufixo = extras.length > 0 ? ` · ${extras.join(' · ')}` : ''
    out += `› ${formatDataCompleta(p.dateOriginal)} — **${formatPct(p.intencao)}%**${sufixo}\n`
  })

  if (ordenada.length > 8) {
    out += `\n+ ${ordenada.length - 8} leitura(s) anterior(es)`
  }

  const regioes = payload.mediasPorRegiao ?? []
  if (!options.municipio && regioes.length > 0) {
    out += '\n\n**Média por região (PI):**\n'
    const top = [...regioes].sort((a, b) => b.media - a.media).slice(0, 4)
    top.forEach((r) => {
      out += `› ${r.regiao}: **${formatPct(r.media)}%** (${r.n} registro(s))\n`
    })
  }

  return out.trim()
}
