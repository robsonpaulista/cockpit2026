import * as XLSX from 'xlsx'
import {
  TERRITORIOS_DESENVOLVIMENTO_PI,
  getTerritorioDesenvolvimentoPI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'

export type LeaderExportRow = {
  id: string
  nome: string
  telefone: string | null
  cidade: string | null
  municipio: string | null
  coordinator_id: string | null
  coordinators?:
    | { id: string; nome: string; regiao: string | null }
    | { id: string; nome: string; regiao: string | null }[]
    | null
}

export type LideradoExportRow = {
  id: string
  nome: string
  whatsapp: string
  instagram: string | null
  cidade: string | null
  status: string
  leader_id: string
}

const COL_TD = 'TD (Território de Desenvolvimento)'
const COL_COORD = 'Coordenador'
const COL_CIDADE = 'Cidade (município da liderança)'
const COL_LIDERANCA = 'Liderança'
const COL_TEL_LIDERANCA = 'Telefone da liderança'
const COL_LINK = 'Link de captação (cadastro de liderados)'
const COL_LID_NOME = 'Liderado — nome'
const COL_LID_WA = 'Liderado — WhatsApp'
const COL_LID_IG = 'Liderado — Instagram'
const COL_LID_CIDADE = 'Liderado — cidade'
const COL_LID_STATUS = 'Liderado — status'

export const MOBILIZACAO_ESTRUTURA_EXPORT_HEADERS = [
  COL_TD,
  COL_COORD,
  COL_CIDADE,
  COL_LIDERANCA,
  COL_TEL_LIDERANCA,
  COL_LINK,
  COL_LID_NOME,
  COL_LID_WA,
  COL_LID_IG,
  COL_LID_CIDADE,
  COL_LID_STATUS,
] as const

export type MobilizacaoEstruturaSheetRow = Record<(typeof MOBILIZACAO_ESTRUTURA_EXPORT_HEADERS)[number], string>

function unwrapCoordinator(
  leader: LeaderExportRow
): { nome: string; regiao: string | null } | null {
  const c = leader.coordinators
  if (!c) return null
  if (Array.isArray(c)) {
    const first = c[0]
    return first ? { nome: first.nome, regiao: first.regiao ?? null } : null
  }
  return { nome: c.nome, regiao: c.regiao ?? null }
}

function labelCidadeLeader(leader: LeaderExportRow): string {
  const m = leader.municipio?.trim() || leader.cidade?.trim()
  return m && m.length > 0 ? m : '—'
}

function tdSortIndex(td: string): number {
  const i = TERRITORIOS_DESENVOLVIMENTO_PI.indexOf(td as TerritorioDesenvolvimentoPI)
  if (i >= 0) return i
  if (td === '—' || td.trim() === '') return 999
  return 998
}

function resolveTdForLeader(leader: LeaderExportRow, coordWrap: { regiao: string | null } | null): string {
  const fromCoord = coordWrap?.regiao?.trim()
  if (fromCoord) return fromCoord
  const mun = leader.municipio?.trim() || leader.cidade?.trim()
  if (!mun) return '—'
  return getTerritorioDesenvolvimentoPI(mun) ?? '—'
}

function resolveCoordenadorNome(leader: LeaderExportRow, coordWrap: { nome: string } | null): string {
  if (coordWrap?.nome?.trim()) return coordWrap.nome.trim()
  return '(sem coordenador)'
}

/**
 * Uma linha por vínculo com liderado; lideranças sem liderados geram uma linha com colunas de liderado vazias
 * (útil para disparar o link de captação). Ordenação: TD, coordenador, cidade, liderança, liderado.
 */
export function buildMobilizacaoEstruturaExportRows(
  leaders: LeaderExportRow[],
  liderados: LideradoExportRow[],
  baseCaptacaoUrl: string
): MobilizacaoEstruturaSheetRow[] {
  const base = baseCaptacaoUrl.replace(/\/$/, '')
  const lidByLeader = new Map<string, LideradoExportRow[]>()
  for (const L of leaders) {
    lidByLeader.set(L.id, [])
  }
  for (const r of liderados) {
    if (!lidByLeader.has(r.leader_id)) lidByLeader.set(r.leader_id, [])
    lidByLeader.get(r.leader_id)!.push(r)
  }
  const sortLiderado = (a: LideradoExportRow, b: LideradoExportRow) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) ||
    a.id.localeCompare(b.id, 'pt-BR')

  const out: MobilizacaoEstruturaSheetRow[] = []

  const leaderIds = new Set(leaders.map((l) => l.id))

  for (const leader of leaders) {
    const coordWrap = unwrapCoordinator(leader)
    const td = resolveTdForLeader(leader, coordWrap)
    const coordNome = resolveCoordenadorNome(leader, coordWrap)
    const cidade = labelCidadeLeader(leader)
    const link = base ? `${base}?leader_id=${leader.id}` : ''
    const tel = leader.telefone?.trim() || ''

    const lista = [...(lidByLeader.get(leader.id) ?? [])].sort(sortLiderado)
    if (lista.length === 0) {
      out.push({
        [COL_TD]: td,
        [COL_COORD]: coordNome,
        [COL_CIDADE]: cidade,
        [COL_LIDERANCA]: leader.nome,
        [COL_TEL_LIDERANCA]: tel,
        [COL_LINK]: link,
        [COL_LID_NOME]: '',
        [COL_LID_WA]: '',
        [COL_LID_IG]: '',
        [COL_LID_CIDADE]: '',
        [COL_LID_STATUS]: '',
      })
      continue
    }
    for (const lid of lista) {
      out.push({
        [COL_TD]: td,
        [COL_COORD]: coordNome,
        [COL_CIDADE]: cidade,
        [COL_LIDERANCA]: leader.nome,
        [COL_TEL_LIDERANCA]: tel,
        [COL_LINK]: link,
        [COL_LID_NOME]: lid.nome,
        [COL_LID_WA]: lid.whatsapp,
        [COL_LID_IG]: lid.instagram?.trim() || '',
        [COL_LID_CIDADE]: lid.cidade?.trim() || '',
        [COL_LID_STATUS]: String(lid.status ?? ''),
      })
    }
  }

  for (const lid of liderados) {
    if (leaderIds.has(lid.leader_id)) continue
    out.push({
      [COL_TD]: '—',
      [COL_COORD]: '—',
      [COL_CIDADE]: '—',
      [COL_LIDERANCA]: '(liderança não encontrada — verificar leader_id)',
      [COL_TEL_LIDERANCA]: '',
      [COL_LINK]: '',
      [COL_LID_NOME]: lid.nome,
      [COL_LID_WA]: lid.whatsapp,
      [COL_LID_IG]: lid.instagram?.trim() || '',
      [COL_LID_CIDADE]: lid.cidade?.trim() || '',
      [COL_LID_STATUS]: String(lid.status ?? ''),
    })
  }

  const sortRow = (a: MobilizacaoEstruturaSheetRow, b: MobilizacaoEstruturaSheetRow) => {
    const dTd = tdSortIndex(a[COL_TD]) - tdSortIndex(b[COL_TD])
    if (dTd !== 0) return dTd
    const dC = a[COL_COORD].localeCompare(b[COL_COORD], 'pt-BR', { sensitivity: 'base' })
    if (dC !== 0) return dC
    const dCi = a[COL_CIDADE].localeCompare(b[COL_CIDADE], 'pt-BR', { sensitivity: 'base' })
    if (dCi !== 0) return dCi
    const dL = a[COL_LIDERANCA].localeCompare(b[COL_LIDERANCA], 'pt-BR', { sensitivity: 'base' })
    if (dL !== 0) return dL
    return a[COL_LID_NOME].localeCompare(b[COL_LID_NOME], 'pt-BR', { sensitivity: 'base' })
  }

  out.sort(sortRow)
  return out
}

export function mobilizacaoEstruturaRowsToXlsxBuffer(rows: MobilizacaoEstruturaSheetRow[]): Buffer {
  const emptyPlaceholder: MobilizacaoEstruturaSheetRow = {
    [COL_TD]: '—',
    [COL_COORD]: '—',
    [COL_CIDADE]: '—',
    [COL_LIDERANCA]: 'Sem lideranças cadastradas',
    [COL_TEL_LIDERANCA]: '',
    [COL_LINK]: '',
    [COL_LID_NOME]: '',
    [COL_LID_WA]: '',
    [COL_LID_IG]: '',
    [COL_LID_CIDADE]: '',
    [COL_LID_STATUS]: '',
  }
  const sheetData = rows.length > 0 ? rows : [emptyPlaceholder]
  const ws = XLSX.utils.json_to_sheet(sheetData, {
    header: [...MOBILIZACAO_ESTRUTURA_EXPORT_HEADERS],
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Estrutura captação')
  const raw = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer', compression: true })
  return Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
}
