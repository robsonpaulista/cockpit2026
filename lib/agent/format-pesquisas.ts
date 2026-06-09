import { isCandidatoJadyelAlencar } from '@/lib/resumo-operacional-pesquisas'

export type PesquisaRowInput = {
  data?: string
  instituto?: string
  candidato_nome?: string
  intencao?: number | null
  tipo?: string
  cidade?: string
}

export type PesquisaTipo = 'estimulada' | 'espontanea'

export interface PesquisaTipoChoicePending {
  termo: string
  cidade: string
  data: string
  instituto: string
  /** Quando a pergunta era sobre Jadyel Alencar — exibir só % e posição dele. */
  focoJadyel?: boolean
}

export function queryMentionsJadyelAlencar(text: string): boolean {
  const q = normalizeForMatch(text)
  return /\bjadyel\b/.test(q) || /\bjadyel\s+alencar\b/.test(q) || /\bjadyel\s+da\s+jupi\b/.test(q)
}

export { isCandidatoJadyelAlencar }

export type PesquisasReplyResult =
  | { kind: 'data'; content: string }
  | { kind: 'ask_tipo'; content: string; pending: PesquisaTipoChoicePending }
  | { kind: 'empty'; content: string }

export function normalizePesquisaRow(raw: Record<string, unknown>): PesquisaRowInput {
  const cities = raw.cities as { name?: string } | null | undefined
  const intencaoRaw = raw.intencao ?? raw.intencao_voto
  const intencao =
    typeof intencaoRaw === 'number'
      ? intencaoRaw
      : typeof intencaoRaw === 'string'
        ? Number.parseFloat(intencaoRaw.replace(',', '.'))
        : null

  const tipoRaw = normalizeForMatch(String(raw.tipo ?? ''))
  const tipo =
    tipoRaw === 'estimulada' ? 'estimulada' : tipoRaw === 'espontanea' ? 'espontanea' : String(raw.tipo ?? '').trim()

  return {
    data: String(raw.data ?? raw.data_pesquisa ?? '').trim(),
    instituto: String(raw.instituto ?? '').trim(),
    candidato_nome: String(raw.candidato_nome ?? '').trim(),
    intencao: intencao != null && !Number.isNaN(intencao) ? intencao : null,
    tipo,
    cidade: String(cities?.name ?? raw.cidade_nome ?? 'Estado').trim(),
  }
}

function normalizeSurveyDate(raw: string): string {
  const value = raw.trim()
  if (!value) return ''
  if (value.includes('/')) {
    const parts = value.split('/')
    if (parts.length === 3) {
      const [d, m, y] = parts
      const year = y.length === 2 ? `20${y}` : y
      return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
  }
  if (value.includes('T')) return value.split('T')[0] ?? value
  return value.slice(0, 10)
}

function surveyInstitutoKey(instituto: string): string {
  return normalizeForMatch(instituto)
}

function surveyCidadeKey(cidade: string): string {
  return normalizeForMatch(cidade)
}

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function parsePesquisaTipoFromQuery(query: string): PesquisaTipo | null {
  const q = normalizeForMatch(query)
  if (/\b(estimulada)\b/.test(q)) return 'estimulada'
  if (/\b(espontanea)\b/.test(q)) return 'espontanea'
  return null
}

function formatDatePt(isoOrDate: string): string {
  if (!isoOrDate) return '—'
  if (isoOrDate.includes('/')) return isoOrDate
  const d = isoOrDate.includes('T')
    ? new Date(isoOrDate)
    : (() => {
        const [y, m, day] = isoOrDate.split('-').map(Number)
        return new Date(y, (m || 1) - 1, day || 1)
      })()
  if (Number.isNaN(d.getTime())) return isoOrDate
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toFixed(1).replace('.', ',')
}

function groupKey(row: PesquisaRowInput): string {
  return `${normalizeSurveyDate(row.data || '')}|${surveyInstitutoKey(row.instituto || '')}|${surveyCidadeKey(row.cidade || '')}|${(row.tipo || '').toLowerCase()}`
}

function surveyKeyWithoutTipo(row: PesquisaRowInput): string {
  return `${normalizeSurveyDate(row.data || '')}|${surveyInstitutoKey(row.instituto || '')}|${surveyCidadeKey(row.cidade || '')}`
}

function rowMatchesTermo(row: PesquisaRowInput, termo: string): boolean {
  const termoNorm = normalizeForMatch(termo)
  if (!termoNorm) return true
  const cand = normalizeForMatch(row.candidato_nome || '')
  const city = surveyCidadeKey(row.cidade || '')
  const inst = surveyInstitutoKey(row.instituto || '')
  return cand.includes(termoNorm) || city.includes(termoNorm) || termoNorm.includes(city) || inst.includes(termoNorm)
}

function rowsHaveBothTipos(rows: PesquisaRowInput[]): boolean {
  const tipos = new Set(rows.map((r) => (r.tipo || '').toLowerCase()).filter((t) => t === 'estimulada' || t === 'espontanea'))
  return tipos.has('estimulada') && tipos.has('espontanea')
}

function formatCabecalho(row: PesquisaRowInput): string {
  const partes = [formatDatePt(row.data || ''), row.instituto || '—']
  if (row.tipo) partes.push(row.tipo)
  return partes.join(' · ')
}

export interface FormatPesquisasOptions {
  termo?: string
  tipoFilter?: PesquisaTipo
  /** Após o usuário escolher estimulada/espontânea */
  pendingContext?: PesquisaTipoChoicePending
  /** Exibir apenas intenção e colocação do Jadyel Alencar em cada pesquisa. */
  focoJadyel?: boolean
  maxGrupos?: number
  maxCandidatosPorGrupo?: number
}

function pickReferenceRow(rows: PesquisaRowInput[]): PesquisaRowInput | undefined {
  return [...rows].sort((a, b) =>
    normalizeSurveyDate(b.data || '').localeCompare(normalizeSurveyDate(a.data || ''))
  )[0]
}

function buildPendingFromRow(
  row: PesquisaRowInput,
  termo?: string,
  focoJadyel?: boolean
): PesquisaTipoChoicePending {
  const cidade = row.cidade || 'Estado'
  return {
    termo: termo || cidade,
    cidade,
    data: row.data || '',
    instituto: row.instituto || '',
    focoJadyel,
  }
}

function findTipoChoiceNeeded(
  rows: PesquisaRowInput[],
  options: FormatPesquisasOptions
): PesquisaTipoChoicePending | null {
  const scopedRows = options.termo ? rows.filter((r) => rowMatchesTermo(r, options.termo!)) : rows
  if (scopedRows.length === 0 || !rowsHaveBothTipos(scopedRows)) return null

  const bySurvey = new Map<string, { tipos: Set<string>; sample: PesquisaRowInput }>()

  for (const row of scopedRows) {
    const key = surveyKeyWithoutTipo(row)
    const entry = bySurvey.get(key) ?? { tipos: new Set<string>(), sample: row }
    const tipo = (row.tipo || '').toLowerCase()
    if (tipo === 'estimulada' || tipo === 'espontanea') entry.tipos.add(tipo)
    bySurvey.set(key, entry)
  }

  const ambiguous = [...bySurvey.entries()]
    .filter(([, entry]) => entry.tipos.has('estimulada') && entry.tipos.has('espontanea'))
    .sort((a, b) => (b[0].split('|')[0] || '').localeCompare(a[0].split('|')[0] || ''))

  if (ambiguous.length > 0) {
    return buildPendingFromRow(ambiguous[0][1].sample, options.termo, options.focoJadyel)
  }

  // Mesma cidade/data com tipos em chaves distintas (instituto/data com variação) — ainda pergunta
  const ref = pickReferenceRow(scopedRows)
  return ref ? buildPendingFromRow(ref, options.termo, options.focoJadyel) : null
}

function rowMatchesPendingContext(row: PesquisaRowInput, ctx: PesquisaTipoChoicePending): boolean {
  return (
    surveyCidadeKey(row.cidade || '') === surveyCidadeKey(ctx.cidade) &&
    normalizeSurveyDate(row.data || '') === normalizeSurveyDate(ctx.data) &&
    surveyInstitutoKey(row.instituto || '') === surveyInstitutoKey(ctx.instituto)
  )
}

function formatPosicao(posicao: number): string {
  return `${posicao}º lugar`
}

function formatJadyelNoGrupo(grupo: PesquisaRowInput[]): string {
  const candidatos = [...grupo].sort((a, b) => (b.intencao ?? 0) - (a.intencao ?? 0))
  const idx = candidatos.findIndex((c) => isCandidatoJadyelAlencar(c.candidato_nome || ''))
  if (idx < 0) return 'Jadyel Alencar: não consta nesta pesquisa\n'

  const row = candidatos[idx]
  const nomeExibicao = row.candidato_nome || 'Jadyel Alencar'
  return `${nomeExibicao}: ${formatPct(row.intencao)}% · ${formatPosicao(idx + 1)}\n`
}

function formatRowsGrouped(rows: PesquisaRowInput[], options: FormatPesquisasOptions): string {
  if (rows.length === 0) return ''

  const maxGrupos = options.maxGrupos ?? 3
  const maxCandidatos = options.maxCandidatosPorGrupo ?? 12

  const groups = new Map<string, PesquisaRowInput[]>()
  for (const row of rows) {
    const key = groupKey(row)
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const da = a[1][0]?.data || ''
    const db = b[1][0]?.data || ''
    return db.localeCompare(da)
  })

  const gruposExibir = sortedGroups.slice(0, maxGrupos)
  let out = ''

  const focoJadyel = options.focoJadyel ?? false

  if (sortedGroups.length === 1) {
    const grupo = gruposExibir[0][1]
    const cab = grupo[0]
    out += focoJadyel
      ? `**Jadyel Alencar** · ${cab.cidade}\n${formatCabecalho(cab)}\n\n`
      : `**${cab.cidade}**\n${formatCabecalho(cab)}\n\n`
  } else {
    const titulo = focoJadyel
      ? options.termo
        ? `**Jadyel Alencar** · ${options.termo}`
        : '**Jadyel Alencar**'
      : options.termo
        ? `**Pesquisas** · ${options.termo} (${rows.length} registros)`
        : `**Pesquisas** (${rows.length} registros)`
    out += `${titulo}\n\n`
  }

  gruposExibir.forEach(([_, grupo], index) => {
    const cab = grupo[0]

    if (sortedGroups.length > 1) {
      out += `**${cab.cidade}**\n${formatCabecalho(cab)}\n`
    }

    if (focoJadyel) {
      out += formatJadyelNoGrupo(grupo)
    } else {
      const candidatos = [...grupo].sort((a, b) => (b.intencao ?? 0) - (a.intencao ?? 0))
      const slice = candidatos.slice(0, maxCandidatos)
      slice.forEach((c, i) => {
        out += `${i + 1}. ${c.candidato_nome} — ${formatPct(c.intencao)}%\n`
      })

      if (candidatos.length > maxCandidatos) {
        out += `+ ${candidatos.length - maxCandidatos} candidatos\n`
      }
    }

    if (index < gruposExibir.length - 1) out += '\n'
  })

  const gruposRestantes = sortedGroups.length - maxGrupos
  if (gruposRestantes > 0) {
    out += `\n+ ${gruposRestantes} outra(s) pesquisa(s)`
  }

  return out.trim()
}

/**
 * Resolve resposta de pesquisas: pergunta o tipo quando há estimulada + espontânea na mesma cidade/data.
 */
export function resolvePesquisasReply(
  rawRows: Array<Record<string, unknown>>,
  options: FormatPesquisasOptions = {}
): PesquisasReplyResult {
  const rows = rawRows.map(normalizePesquisaRow).filter((r) => r.candidato_nome)
  if (rows.length === 0) {
    return { kind: 'empty', content: '' }
  }

  const tipoFilter = options.tipoFilter
  const focoJadyel = options.focoJadyel ?? options.pendingContext?.focoJadyel ?? false

  if (!tipoFilter) {
    const pending = findTipoChoiceNeeded(rows, options)
    if (pending) {
      return {
        kind: 'ask_tipo',
        content: [
          `Há pesquisa **estimulada** e **espontânea** em **${pending.cidade}**.`,
          `${formatDatePt(pending.data)} · ${pending.instituto}`,
          '',
          'Qual tipo você quer ver?',
          '› responda **estimulada** ou **espontânea**',
        ].join('\n'),
        pending,
      }
    }
  }

  let working = rows

  if (tipoFilter) {
    working = working.filter((r) => (r.tipo || '').toLowerCase() === tipoFilter)
    if (working.length === 0) {
      const alvo = options.pendingContext?.cidade || options.termo || 'esse critério'
      return {
        kind: 'empty',
        content: `Não encontrei pesquisa **${tipoFilter}** para ${alvo}.`,
      }
    }
  }

  if (options.pendingContext) {
    const ctx = options.pendingContext
    const bySlot = working.filter((r) => rowMatchesPendingContext(r, ctx))
    working = bySlot.length > 0
      ? bySlot
      : working.filter(
          (r) =>
            surveyCidadeKey(r.cidade || '') === surveyCidadeKey(ctx.cidade) &&
            (r.tipo || '').toLowerCase() === (tipoFilter ?? (r.tipo || '').toLowerCase())
        )
    if (working.length === 0) {
      return {
        kind: 'empty',
        content: `Não encontrei dados da pesquisa ${tipoFilter ?? ''} em ${ctx.cidade}.`.trim(),
      }
    }
  }

  const content = formatRowsGrouped(working, { ...options, focoJadyel })
  if (!content) return { kind: 'empty', content: '' }
  return { kind: 'data', content }
}

/** @deprecated Use resolvePesquisasReply */
export function formatPesquisasResposta(
  rawRows: Array<Record<string, unknown>>,
  options: FormatPesquisasOptions = {}
): string {
  const result = resolvePesquisasReply(rawRows, options)
  return result.content
}

export function filterPesquisasByTermo(
  polls: Array<Record<string, unknown>>,
  termo: string,
  options?: { focoJadyel?: boolean }
): Array<Record<string, unknown>> {
  const termoNorm = normalizeForMatch(termo)
  if (!termoNorm) return polls

  const focoJadyel = options?.focoJadyel ?? false
  if (focoJadyel && queryMentionsJadyelAlencar(termo)) {
    return polls
  }

  if (focoJadyel) {
    return polls.filter((raw) => {
      const row = normalizePesquisaRow(raw)
      const city = surveyCidadeKey(row.cidade || '')
      const inst = surveyInstitutoKey(row.instituto || '')
      return city.includes(termoNorm) || termoNorm.includes(city) || inst.includes(termoNorm)
    })
  }

  return polls.filter((raw) => rowMatchesTermo(normalizePesquisaRow(raw), termo))
}
