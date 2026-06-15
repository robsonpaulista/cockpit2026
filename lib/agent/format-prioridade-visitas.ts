export type PrioridadeCampoApiRow = {
  cidade: string
  expectativaVotos: number
  visitas: number
  agendas?: number
  motivo?: string
  ultimaVisita?: string | null
}

type ScoredRow = PrioridadeCampoApiRow & { score: number }

function formatNum(n: number): string {
  return Math.round(n).toLocaleString('pt-BR')
}

function formatUltimaVisita(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const d = iso.includes('T') ? new Date(iso) : new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function describeVisitas(visitas: number): string {
  if (visitas === 0) return 'nenhuma visita registrada'
  if (visitas === 1) return 'apenas **1** visita'
  return `**${visitas}** visitas`
}

/** Filtra e ordena como o painel de prioridade do Campo (score = expectativa / (visitas + 1)). */
export function pickPrioridadeVisitasRows(
  rows: PrioridadeCampoApiRow[],
  limite = 10
): PrioridadeCampoApiRow[] {
  const comExpectativa = rows.filter((r) => r.expectativaVotos > 0)
  if (comExpectativa.length === 0) return []

  const expectativas = comExpectativa.map((r) => r.expectativaVotos).sort((a, b) => a - b)
  const mediana = expectativas[Math.floor(expectativas.length / 2)] ?? 0
  const limiar = Math.max(mediana, 200)

  return comExpectativa
    .map(
      (r): ScoredRow => ({
        ...r,
        score: r.expectativaVotos / (r.visitas + 1),
      })
    )
    .filter((r) => r.expectativaVotos >= limiar)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.expectativaVotos !== a.expectativaVotos) return b.expectativaVotos - a.expectativaVotos
      return a.visitas - b.visitas
    })
    .slice(0, limite)
    .map(({ score: _s, ...row }) => row)
}

export function formatPrioridadeVisitasJarvisReply(
  rows: PrioridadeCampoApiRow[],
  options?: { limite?: number }
): { content: string; speechSegments: string[] } {
  const limite = options?.limite ?? 10
  const prioridade = pickPrioridadeVisitasRows(rows, limite)

  if (prioridade.length === 0) {
    return {
      content:
        'Não encontrei municípios com expectativa de votos cruzada com visitas de campo. Configure a planilha de **Território & Base** e registre visitas no **Campo & Agenda**.',
      speechSegments: [
        'Não encontrei prioridades de visita. Verifique a planilha de território e as visitas de campo.',
      ],
    }
  }

  const semVisita = prioridade.filter((r) => r.visitas === 0)
  const poucas = prioridade.filter((r) => r.visitas > 0 && r.visitas <= 1)

  const linhas = prioridade.map((r) => {
    const votos = `${formatNum(r.expectativaVotos)} votos (expectativa 2026)`
    const visitasTxt = describeVisitas(r.visitas)
    const ultima = formatUltimaVisita(r.ultimaVisita)
    let extra = ultima && r.visitas > 0 ? ` · última em ${ultima}` : ''
    if (r.visitas === 0) extra = ''
    return `› **${r.cidade}** — ${votos} · ${visitasTxt}${extra}`
  })

  const introParts: string[] = []
  if (semVisita.length > 0) {
    introParts.push(
      `${semVisita.length} com **nenhuma visita**${semVisita.length > 1 ? '' : ''} e alta expectativa`
    )
  }
  if (poucas.length > 0) {
    introParts.push(`${poucas.length} com **poucas visitas**`)
  }

  const intro =
    introParts.length > 0
      ? introParts.join(' · ')
      : 'Municípios com melhor expectativa de votos e menor presença de campo'

  const content = [
    '**Prioridade de visitas de campo**',
    '',
    `_Mesma lógica do **Resumo Operacional** (Território): ${intro}._`,
    '',
    ...linhas,
    '',
    '_Abra **Campo & Agenda** ou **Resumo Operacional** para ver o mapa completo._',
  ].join('\n')

  const topNomes = prioridade.slice(0, 3).map((r) => r.cidade)
  const speech =
    topNomes.length >= 2
      ? `Prioridade de visitas: ${topNomes.slice(0, 2).join(' e ')}${topNomes.length > 2 ? `, entre outras` : ''}.`
      : `Prioridade de visita: ${topNomes[0]}.`

  return { content, speechSegments: [speech] }
}
