/**
 * Cobertura de visitas por Território de Desenvolvimento (War Room · aba Cobertura).
 * Janela oficial do painel: 45 dias. Cidades do ranking = municípios com meta de votos.
 *
 * Fontes (mesmas do mapa/cards anteriores):
 * - Visitas realizadas → `/api/campo/visitas-resumo-td` (check-ins concluídos)
 * - Agenda futura → `/api/agenda/events` (próximas visitas por município)
 * - Ranking/meta → IPT (`expectativaVotos`)
 */

import { getEleitoradoByCity } from '@/lib/eleitores'
import { type IptMunicipio, normalizeIptMunicipio } from '@/lib/ipt'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  getTerritorioDesenvolvimentoPI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import {
  type WarRoomAgendaProximoItem,
  todayKeyInTz,
} from '@/lib/war-room/agenda-proximos'

/** Janela de cobertura válida (alinhada ao painel de campo / PDF). */
export const COBERTURA_VISITAS_JANELA_DIAS = 45

export type CoberturaCidadeStatus = 'visitada' | 'agendada' | 'sem_cobertura'

/** Overlay de visitas do campo (mesma API do IPT/mapa), na janela de 45 dias. */
export type CoberturaCampoVisitaInfo = {
  visitas: number
  ultimaVisita: string | null
}

export type CoberturaCidadeRow = {
  municipio: string
  municipioKey: string
  territorio: TerritorioDesenvolvimentoPI | null
  meta: number
  pesoPct: number
  eleitores: number
  status: CoberturaCidadeStatus
  ultimaVisita: string | null
  daysSinceLastVisit: number | null
  visitasNoJanela: number
  proximaAgenda: WarRoomAgendaProximoItem | null
}

export type CoberturaTdRow = {
  territorio: TerritorioDesenvolvimentoPI
  rank: number
  municipios: number
  pesoPct: number
  visitadas: number
  agendadas: number
  semCobertura: number
  eleitoresSemCobertura: number
  pesoVisitadasPct: number
  pesoAgendadasPct: number
  pesoSemCoberturaPct: number
  cidadesVisitadas: CoberturaCidadeRow[]
  cidadesAgendadas: CoberturaCidadeRow[]
  cidadesSemCobertura: CoberturaCidadeRow[]
}

export type CoberturaVisitasTdModel = {
  atualizadoEm: string
  janelaDias: number
  cutoffLabel: string
  cidadesRanking: number
  cobertas: number
  agendadas: number
  semCobertura: number
  pesoCobertasPct: number
  pesoAgendadasPct: number
  pesoSemCoberturaPct: number
  eleitoresSemCobertura: number
  metaTotal: number
  territorios: CoberturaTdRow[]
  anexoSemCobertura: CoberturaCidadeRow[]
}

function parseDayKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const s = iso.trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function daysBetween(fromKey: string, toKey: string): number | null {
  const [y1, m1, d1] = fromKey.split('-').map(Number)
  const [y2, m2, d2] = toKey.split('-').map(Number)
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return null
  const a = Date.UTC(y1, m1 - 1, d1)
  const b = Date.UTC(y2, m2 - 1, d2)
  return Math.round((b - a) / 86_400_000)
}

function pickNewerDayKey(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return a >= b ? a : b
}

function formatCutoffLabel(hojeKey: string, janelaDias: number): string {
  const [y, m, d] = hojeKey.split('-').map(Number)
  if (!y || !m || !d) return ''
  const dt = new Date(Date.UTC(y, m - 1, d - janelaDias))
  return dt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatAtualizadoEm(hojeKey: string): string {
  const [y, m, d] = hojeKey.split('-').map(Number)
  if (!y || !m || !d) return ''
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function firstProximaAgenda(
  itens: WarRoomAgendaProximoItem[] | undefined,
  hojeKey: string,
): WarRoomAgendaProximoItem | null {
  if (!itens?.length) return null
  const futuros = itens
    .filter((i) => i.dataKey >= hojeKey)
    .sort((a, b) => {
      const byDate = a.dataKey.localeCompare(b.dataKey)
      if (byDate !== 0) return byDate
      return a.horario.localeCompare(b.horario)
    })
  return futuros[0] ?? null
}

export function buildCoberturaVisitasTdModel(
  municipios: IptMunicipio[],
  agendaPorMunicipio: Map<string, WarRoomAgendaProximoItem[]>,
  opts?: {
    janelaDias?: number
    hojeKey?: string
    /** Visitas do campo na janela (preferencial; mesma fonte do mapa). */
    campoVisitasPorMunicipio?: Map<string, CoberturaCampoVisitaInfo>
  },
): CoberturaVisitasTdModel {
  const janelaDias = opts?.janelaDias ?? COBERTURA_VISITAS_JANELA_DIAS
  const hojeKey = opts?.hojeKey ?? todayKeyInTz()
  const campoMap = opts?.campoVisitasPorMunicipio

  const ranking = municipios.filter((m) => Number.isFinite(m.expectativaVotos) && m.expectativaVotos > 0)
  const metaTotal = ranking.reduce((s, m) => s + m.expectativaVotos, 0)

  const cidades: CoberturaCidadeRow[] = ranking.map((m) => {
    const municipioKey = normalizeIptMunicipio(m.municipio)
    const campo = campoMap?.get(municipioKey)
    const ultimaKey = pickNewerDayKey(
      parseDayKey(campo?.ultimaVisita ?? null),
      parseDayKey(m.ultimaVisita ?? null),
    )
    const daysSince = ultimaKey ? daysBetween(ultimaKey, hojeKey) : null

    // Visita válida: check-in na janela (API campo) OU data da última visita ≤ janela
    // OU fallback IPT (contagens 15/30d do mapa — cobre latência de data).
    const visitadaPorCampo = (campo?.visitas ?? 0) > 0
    const visitadaPorData =
      daysSince != null && daysSince >= 0 && daysSince <= janelaDias
    const visitadaPorIpt =
      m.detalhes.visitasUltimos15Dias > 0 ||
      (janelaDias >= 30 && m.detalhes.visitasNoPeriodo > 0)
    const visitada = visitadaPorCampo || visitadaPorData || visitadaPorIpt

    const proxima = firstProximaAgenda(agendaPorMunicipio.get(municipioKey), hojeKey)
    let status: CoberturaCidadeStatus
    if (visitada) status = 'visitada'
    else if (proxima) status = 'agendada'
    else status = 'sem_cobertura'

    const pesoPct = metaTotal > 0 ? (m.expectativaVotos / metaTotal) * 100 : 0
    const eleitores = getEleitoradoByCity(m.municipio) ?? 0
    const visitasNoJanela = Math.max(
      campo?.visitas ?? 0,
      m.detalhes.visitasUltimos15Dias,
      janelaDias >= 30 ? m.detalhes.visitasNoPeriodo : 0,
    )

    return {
      municipio: m.municipio,
      municipioKey,
      territorio: getTerritorioDesenvolvimentoPI(m.municipio),
      meta: m.expectativaVotos,
      pesoPct,
      eleitores,
      status,
      ultimaVisita: ultimaKey,
      daysSinceLastVisit: daysSince,
      visitasNoJanela,
      proximaAgenda: proxima,
    }
  })

  const sumPeso = (list: CoberturaCidadeRow[]) => list.reduce((s, c) => s + c.pesoPct, 0)
  const visitadasAll = cidades.filter((c) => c.status === 'visitada')
  const agendadasAll = cidades.filter((c) => c.status === 'agendada')
  const semAll = cidades.filter((c) => c.status === 'sem_cobertura')

  const territorios: CoberturaTdRow[] = TERRITORIOS_DESENVOLVIMENTO_PI.map((td) => {
    const inTd = cidades.filter((c) => c.territorio === td)
    const v = inTd.filter((c) => c.status === 'visitada')
    const a = inTd.filter((c) => c.status === 'agendada')
    const s = inTd.filter((c) => c.status === 'sem_cobertura')
    const sortByMeta = (list: CoberturaCidadeRow[]) =>
      [...list].sort((x, y) => y.meta - x.meta || x.municipio.localeCompare(y.municipio, 'pt-BR'))
    return {
      territorio: td,
      rank: 0,
      municipios: inTd.length,
      pesoPct: sumPeso(inTd),
      visitadas: v.length,
      agendadas: a.length,
      semCobertura: s.length,
      eleitoresSemCobertura: s.reduce((acc, c) => acc + c.eleitores, 0),
      pesoVisitadasPct: sumPeso(v),
      pesoAgendadasPct: sumPeso(a),
      pesoSemCoberturaPct: sumPeso(s),
      cidadesVisitadas: sortByMeta(v),
      cidadesAgendadas: sortByMeta(a),
      cidadesSemCobertura: sortByMeta(s),
    }
  })
    .filter((t) => t.municipios > 0)
    .sort((a, b) => b.pesoPct - a.pesoPct)
    .map((t, i) => ({ ...t, rank: i + 1 }))

  const anexoSemCobertura = [...semAll, ...agendadasAll].sort(
    (a, b) => b.meta - a.meta || a.municipio.localeCompare(b.municipio, 'pt-BR'),
  )

  return {
    atualizadoEm: formatAtualizadoEm(hojeKey),
    janelaDias,
    cutoffLabel: formatCutoffLabel(hojeKey, janelaDias),
    cidadesRanking: cidades.length,
    cobertas: visitadasAll.length,
    agendadas: agendadasAll.length,
    semCobertura: semAll.length,
    pesoCobertasPct: sumPeso(visitadasAll),
    pesoAgendadasPct: sumPeso(agendadasAll),
    pesoSemCoberturaPct: sumPeso(semAll),
    eleitoresSemCobertura: semAll.reduce((s, c) => s + c.eleitores, 0),
    metaTotal,
    territorios,
    anexoSemCobertura,
  }
}

export function formatMeta(n: number): string {
  return n.toLocaleString('pt-BR')
}

export function formatPeso(pct: number, digits = 1): string {
  return `${pct.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`
}

export function formatUltimaVisitaLabel(row: CoberturaCidadeRow): string {
  if (row.status === 'visitada' && row.daysSinceLastVisit != null) {
    return `${row.daysSinceLastVisit} dias atrás`
  }
  if (row.status === 'visitada' && row.visitasNoJanela > 0 && !row.ultimaVisita) {
    return `${row.visitasNoJanela} visita${row.visitasNoJanela === 1 ? '' : 's'} na janela`
  }
  if (!row.ultimaVisita) return 'nunca visitada'
  const key = parseDayKey(row.ultimaVisita)
  if (!key) return 'nunca visitada'
  const [y, m, d] = key.split('-')
  return `última visita em ${d}/${m}/${y}`
}

export function formatProximaAgendaLabel(row: CoberturaCidadeRow): string {
  const p = row.proximaAgenda
  if (!p) return '—'
  const [y, m, d] = p.dataKey.split('-')
  const data = y && m && d ? `${d}/${m}/${y}` : p.dataLabel
  const hora = p.horario?.trim()
  return hora ? `${data} · ${hora}` : data
}
