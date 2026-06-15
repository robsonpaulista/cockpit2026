import { isInvalidCityCandidate } from '@/lib/agent/city-extract'
import { isMonthName, parseMesAnoFromText } from '@/lib/agent/parse-visitas-mes'

export type CampoAgendaRow = {
  id: string
  date: string
  type: string
  status: string
  description?: string | null
  cities?: { name?: string; state?: string } | null
  visits?: Array<{ checkin_time?: string | null }> | null
}

export type VisitasCampoModo =
  | 'ultima'
  | 'ultimas'
  | 'contagem_mes'
  | 'descricao'
  | 'lista_cidade'
  | 'cidades'
  | 'cidade_mais_visitada'
  | 'prioridade_visitas'

export interface ResolveVisitasCampoOptions {
  cidade?: string
  modo?: VisitasCampoModo
  mes?: string
  ano?: string
  limite?: number
  referenceDate?: Date
}

function norm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function parseAgendaDate(dateStr: string): Date | null {
  if (!dateStr) return null
  if (dateStr.includes('T')) {
    const d = new Date(dateStr)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const [y, m, day] = dateStr.split('-').map(Number)
  if (!y || !m || !day) return null
  return new Date(y, m - 1, day)
}

function formatDatePt(dateStr: string): string {
  const d = parseAgendaDate(dateStr)
  if (!d) return dateStr || '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function cityName(agenda: CampoAgendaRow): string {
  return agenda.cities?.name?.trim() || 'Cidade não informada'
}

function matchCity(agenda: CampoAgendaRow, cidade?: string): boolean {
  if (!cidade?.trim()) return true
  const alvo = norm(cidade)
  const nome = norm(cityName(agenda))
  return nome.includes(alvo) || alvo.includes(nome)
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    visita: 'Visita',
    evento: 'Evento',
    reuniao: 'Reunião',
    outro: 'Outro',
  }
  return map[norm(type)] || type.charAt(0).toUpperCase() + type.slice(1)
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    planejada: 'Planejada',
    concluida: 'Concluída',
    cancelada: 'Cancelada',
  }
  return map[norm(status)] || status
}

function isViagemQuery(text: string): boolean {
  return /\bviagens?\b/.test(norm(text))
}

/** «mais vezes», «já fui» — conta deslocamentos (não só type visita). */
function isBroadTripCountQuery(text: string): boolean {
  const q = norm(text)
  return (
    isViagemQuery(text) ||
    isCidadeMaisVisitadaQuery(text) ||
    /\b(mais\s+vezes|ja\s+fui|já\s+fui|quantas?\s+vezes)\b/.test(q)
  )
}

function filterByTripKind(rows: CampoAgendaRow[], queryHint: string): CampoAgendaRow[] {
  if (isBroadTripCountQuery(queryHint)) {
    return rows.filter((r) => norm(r.status) !== 'cancelada')
  }
  return rows.filter((r) => norm(r.type) === 'visita' && norm(r.status) !== 'cancelada')
}

function countVisitsByCity(rows: CampoAgendaRow[]): Array<{ cidade: string; count: number }> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const nome = cityName(row)
    if (nome === 'Cidade não informada') continue
    counts.set(nome, (counts.get(nome) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([cidade, count]) => ({ cidade, count }))
    .sort((a, b) => b.count - a.count || a.cidade.localeCompare(b.cidade, 'pt-BR'))
}

/** «qual cidade eu mais visitei / fui mais vezes». */
export function isCidadeMaisVisitadaQuery(query: string): boolean {
  const q = norm(query)
  if (/\b(descricao|detalhe|liste|listar|ultim[ao])\b/.test(q)) return false
  const falaDeCidade = /\b(cidades?|municipios?)\b/.test(q)
  const pedeRanking =
    /\b(mais\s+vezes|mais\s+visitad[ao]s?|mais\s+frequente|que\s+mais\s+(visitei|fui|foi)|maior\s+numero)\b/.test(
      q
    )
  return falaDeCidade && pedeRanking
}

function resolveMesAno(
  options: ResolveVisitasCampoOptions,
  queryHint: string,
  referenceDate: Date
): ParsedMesAno | null {
  if (options.mes && options.ano) {
    const month = Number(options.mes) - 1
    const year = Number(options.ano)
    if (month >= 0 && month <= 11 && year > 2000) {
      const d = new Date(year, month, 1)
      return {
        month,
        year,
        label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      }
    }
  }
  return parseMesAnoFromText(queryHint, referenceDate)
}

type ParsedMesAno = NonNullable<ReturnType<typeof parseMesAnoFromText>>

function filterByMonth(rows: CampoAgendaRow[], mesAno: ParsedMesAno): CampoAgendaRow[] {
  return rows.filter((row) => {
    const d = parseAgendaDate(row.date)
    if (!d) return false
    return d.getMonth() === mesAno.month && d.getFullYear() === mesAno.year
  })
}

function checkinTimestamp(agenda: CampoAgendaRow): number {
  const raw = agenda.visits?.find((v) => v.checkin_time)?.checkin_time
  if (!raw) return 0
  const t = new Date(raw).getTime()
  return Number.isNaN(t) ? 0 : t
}

function sortByDateDesc(rows: CampoAgendaRow[]): CampoAgendaRow[] {
  return [...rows].sort((a, b) => {
    const da = parseAgendaDate(a.date)?.getTime() ?? 0
    const db = parseAgendaDate(b.date)?.getTime() ?? 0
    if (db !== da) return db - da
    const ca = checkinTimestamp(a)
    const cb = checkinTimestamp(b)
    if (cb !== ca) return cb - ca
    return b.id.localeCompare(a.id)
  })
}

function formatAgendaLine(agenda: CampoAgendaRow, includeDescription = false): string {
  let line = `› **${formatDatePt(agenda.date)}** — ${cityName(agenda)}`
  line += ` (${typeLabel(agenda.type)}, ${statusLabel(agenda.status)})`
  if (agenda.visits?.some((v) => v.checkin_time)) {
    line += ' · check-in registrado'
  }
  if (includeDescription && agenda.description?.trim()) {
    line += `\n   ${agenda.description.trim()}`
  }
  return line
}

function isUltimasPluralQuery(q: string): boolean {
  return /\bultim[ao]s\b/.test(q) || /\b(recentes?)\b/.test(q)
}

/** Uma só visita/viagem/cidade — «última cidade que visitei», não «últimas visitas». */
export function isUltimaSingularQuery(query: string): boolean {
  const q = norm(query)
  if (isUltimasPluralQuery(q)) return false
  if (/\b(todas?|listar|liste|quantas?)\b/.test(q)) return false

  return (
    /\bultim[ao]\b/.test(q) ||
    /\bqual\s+(foi|e)\s+(a\s+)?ultim[ao]\b/.test(q) ||
    /\bque\s+eu\s+visitei\b/.test(q) ||
    (/\bonde\s+(foi|esteve)\b/.test(q) && /\bultim[ao]?\b/.test(q))
  )
}

function preferConcluded(rows: CampoAgendaRow[]): CampoAgendaRow[] {
  const concluidas = rows.filter((r) => norm(r.status) === 'concluida')
  return concluidas.length > 0 ? concluidas : rows
}

function asksAboutCity(query: string): boolean {
  const q = norm(query)
  return /\bcidades?\b/.test(q) || /\bmunicipios?\b/.test(q) || /\bque\s+eu\s+visitei\b/.test(q)
}

function detectModoFromQuery(query: string, cidade?: string): VisitasCampoModo {
  const q = norm(query)
  if (isUltimaSingularQuery(query)) return 'ultima'
  if (isCidadeMaisVisitadaQuery(query)) return 'cidade_mais_visitada'
  if (/\bultim[ao]s\b/.test(q) && /\b(visitas?|viagens?|cidades?)\b/.test(q)) return 'ultimas'
  if (/\bquantas?\b/.test(q) && /\b(viagens?|visitas?)\b/.test(q)) return 'contagem_mes'
  if (
    /\b(descricao|detalhe|o que foi feito)\b/.test(q) &&
    /\bvisita\b/.test(q)
  ) {
    return 'descricao'
  }
  if (/\bqual\s+foi\b/.test(q) && /\b(descricao|descrição)\b/.test(q)) return 'descricao'
  if (/\bcidades?\s+visitadas?\b/.test(q)) return 'cidades'
  if (cidade) return 'lista_cidade'
  if (parseMesAnoFromText(query)) return 'contagem_mes'
  return 'ultimas'
}

export function resolveVisitasCampoReply(
  agendas: CampoAgendaRow[],
  queryHint: string,
  options: ResolveVisitasCampoOptions = {}
): { content: string; speechSegments?: string[] } {
  const referenceDate = options.referenceDate ?? new Date()
  const limite = options.limite ?? 8
  let cidade = options.cidade?.trim()
  if (cidade && isInvalidCityCandidate(cidade)) cidade = undefined
  if (cidade && isMonthName(cidade)) cidade = undefined
  if (cidade && isUltimaSingularQuery(queryHint) && /\bcidade\s+que\s+eu\s+visitei\b/.test(norm(queryHint))) {
    cidade = undefined
  }
  const modo = options.modo ?? detectModoFromQuery(queryHint, cidade)
  if (modo === 'cidade_mais_visitada') cidade = undefined

  const todas = filterByTripKind(agendas, queryHint)
  const base = cidade ? todas.filter((a) => matchCity(a, cidade)) : todas

  if (modo === 'contagem_mes') {
    const mesAno = resolveMesAno(options, queryHint, referenceDate)
    if (!mesAno) {
      return {
        content:
          'Informe o mês, por exemplo: «quantas viagens em maio de 2026» ou «visitas em 05/2026».',
      }
    }
    const noMes = filterByMonth(base.length > 0 ? base : todas, mesAno)
    const concluidas = noMes.filter((r) => norm(r.status) === 'concluida').length
    const labelMes = mesAno.label.charAt(0).toUpperCase() + mesAno.label.slice(1)
    const escopo = cidade ? ` em **${cidade}**` : ''
    const termo = isViagemQuery(queryHint) ? 'viagens' : 'visitas'
    return {
      content: [
        `**${termo.charAt(0).toUpperCase() + termo.slice(1)} em ${labelMes}**${escopo}`,
        '',
        `Total: **${noMes.length}** ${termo} (${concluidas} concluída${concluidas !== 1 ? 's' : ''})`,
        noMes.length > 0
          ? `\nCidades: ${[...new Set(noMes.map(cityName))].slice(0, 12).join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
      speechSegments: [
        `${noMes.length} ${termo} em ${labelMes}${cidade ? ` em ${cidade}` : ''}, ${concluidas} concluídas.`,
      ],
    }
  }

  if (base.length === 0) {
    if (cidade) {
      return {
        content: `Não encontrei visitas de campo registradas para **${cidade}** no módulo Campo & Agenda.`,
      }
    }
    return {
      content: 'Ainda não há visitas de campo registradas no módulo Campo & Agenda.',
    }
  }

  if (modo === 'cidade_mais_visitada') {
    let pool = todas
    const mesAno = resolveMesAno(options, queryHint, referenceDate)
    if (mesAno) {
      pool = filterByMonth(todas, mesAno)
    }
    const ranking = countVisitsByCity(pool)
    if (ranking.length === 0) {
      return {
        content: mesAno
          ? `Não há visitas registradas em **${mesAno.label.charAt(0).toUpperCase() + mesAno.label.slice(1)}**.`
          : 'Ainda não há visitas de campo registradas para ranquear cidades.',
      }
    }
    const top = ranking[0]
    const termo = isBroadTripCountQuery(queryHint) ? 'visitas' : 'visitas'
    const periodo = mesAno
      ? ` em **${mesAno.label.charAt(0).toUpperCase() + mesAno.label.slice(1)}**`
      : ' no **histórico completo** do Campo & Agenda'
    const empate = ranking.filter((r) => r.count === top.count).length > 1
    const speech = empate
      ? `Há empate: ${ranking
          .filter((r) => r.count === top.count)
          .map((r) => r.cidade)
          .join(', ')} com ${top.count} visitas.`
      : `A cidade que você mais visitou${periodo.replace(/\*\*/g, '')} foi ${top.cidade}, com ${top.count} ${termo}.`

    let content = [
      `**Cidade mais visitada${periodo}:** ${top.cidade}`,
      '',
      `Total: **${top.count}** ${termo}`,
    ]
    if (empate) {
      const empatadas = ranking.filter((r) => r.count === top.count).map((r) => r.cidade)
      content = [
        `**Empate${periodo}** (${top.count} ${termo} cada):`,
        '',
        empatadas.map((c) => `› **${c}**`).join('\n'),
      ]
    } else if (ranking.length > 1) {
      const segundo = ranking[1]
      content.push('', `Em seguida: **${segundo.cidade}** (${segundo.count} ${termo})`)
    }
    content.push('', '_Pergunte «visitas em [cidade]» se quiser o detalhe de cada uma._')

    return { content: content.join('\n'), speechSegments: [speech] }
  }

  if (modo === 'descricao') {
    if (!cidade) {
      return {
        content:
          'Informe a cidade, por exemplo: «qual foi a descrição da visita a Picos» ou «detalhes da visita em Teresina».',
      }
    }
    const sorted = sortByDateDesc(base)
    const alvo = sorted[0]
    if (!alvo) {
      return { content: `Não encontrei visitas registradas em **${cidade}**.` }
    }
    const desc = alvo.description?.trim()
    const speech = desc
      ? `Visita em ${cityName(alvo)} em ${formatDatePt(alvo.date)}. ${desc}`
      : `Visita em ${cityName(alvo)} em ${formatDatePt(alvo.date)}, sem descrição cadastrada.`
    return {
      content: [
        `**Última visita em ${cityName(alvo)}**`,
        '',
        `Data: ${formatDatePt(alvo.date)}`,
        `Tipo: ${typeLabel(alvo.type)} · Status: ${statusLabel(alvo.status)}`,
        '',
        desc ? `**Descrição:**\n${desc}` : '_Sem descrição cadastrada para esta visita._',
      ].join('\n'),
      speechSegments: [speech],
    }
  }

  if (modo === 'ultima') {
    const sorted = sortByDateDesc(preferConcluded(base))
    const alvo = sorted[0]
    if (!alvo) {
      return { content: 'Não encontrei visitas de campo registradas.' }
    }

    const nome = cityName(alvo)
    const desc = alvo.description?.trim()
    const focoCidade = asksAboutCity(queryHint)
    const titulo = focoCidade
      ? `**Última cidade visitada:** ${nome}`
      : `**Última visita de campo**`

    const speech = focoCidade
      ? `A última cidade que você visitou foi ${nome}, em ${formatDatePt(alvo.date)}.`
      : `${typeLabel(alvo.type)} em ${nome}, em ${formatDatePt(alvo.date)}, ${statusLabel(alvo.status).toLowerCase()}.`

    return {
      content: [
        titulo,
        '',
        `Data: **${formatDatePt(alvo.date)}**`,
        `Tipo: ${typeLabel(alvo.type)} · Status: ${statusLabel(alvo.status)}`,
        desc ? `\n**Descrição:**\n${desc}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      speechSegments: [desc ? `${speech} ${desc}` : speech],
    }
  }

  if (modo === 'cidades') {
    const sorted = sortByDateDesc(base)
    const porCidade = new Map<string, CampoAgendaRow>()
    for (const row of sorted) {
      const nome = cityName(row)
      if (!porCidade.has(nome)) porCidade.set(nome, row)
    }
    const linhas = [...porCidade.entries()].slice(0, limite).map(([nome, row]) => {
      return `› **${nome}** — última em ${formatDatePt(row.date)} (${statusLabel(row.status)})`
    })
    return {
      content: [
        `**Cidades com visitas de campo** (${porCidade.size})`,
        '',
        ...linhas,
        porCidade.size > limite ? `\n+ ${porCidade.size - limite} outras cidades` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    }
  }

  const sorted = sortByDateDesc(base)
  const titulo =
    modo === 'lista_cidade' && cidade
      ? `**Visitas em ${cidade}** (${sorted.length})`
      : `**Últimas visitas de campo** (${Math.min(sorted.length, limite)} de ${sorted.length})`

  if (modo === 'lista_cidade' && cidade) {
    const ultima = sorted[0]
    const speech = ultima
      ? `${sorted.length} visitas em ${cidade}. A mais recente foi em ${formatDatePt(ultima.date)}.`
      : `Nenhuma visita em ${cidade}.`
    return {
      content: [
        titulo,
        '',
        `A mais recente: **${formatDatePt(ultima?.date ?? '')}** (${statusLabel(ultima?.status ?? '')})`,
        '',
        '_Pergunte «descrição da visita em [cidade]» para ver detalhes._',
      ].join('\n'),
      speechSegments: [speech],
    }
  }

  const show = sorted.slice(0, limite)
  const linhas = show.map((row) => formatAgendaLine(row, false))

  const speechSegments = [
    `${sorted.length} visitas recentes. A primeira da lista: ${cityName(show[0] ?? sorted[0])}, em ${formatDatePt(show[0]?.date ?? '')}.`,
  ]

  return {
    content: [titulo, '', ...linhas, sorted.length > limite ? `\n+ ${sorted.length - limite} visitas anteriores` : '']
      .filter(Boolean)
      .join('\n'),
    speechSegments,
  }
}
