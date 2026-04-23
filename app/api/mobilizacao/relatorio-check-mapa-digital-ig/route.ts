import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import { normalizeInstagramHandle } from '@/lib/mobilizacao-lead-capture'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import {
  getMunicipiosPorTerritorioDesenvolvimentoPI,
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import {
  classificacaoTerritorioTdPorPctEngajamentoIg,
  pctComentariosPorPostagensProcessadas,
  rotuloEngajamentoIgPorTipo,
} from '@/lib/instagram-engajamento-ig-classificacao'
import type {
  RelatorioMapaDigitalIgDetalheLinha,
  RelatorioMapaDigitalIgTdPayload,
} from '@/lib/relatorio-mapa-digital-ig-td-types'

export const dynamic = 'force-dynamic'

const TD_SET = new Set<string>(TERRITORIOS_DESENVOLVIMENTO_PI)
const SEP_TD_MUN = '\u0000'

type CoordRow = { regiao: string | null }
type LeaderJoin = { cidade: string | null; municipio: string | null; coordinators: CoordRow | CoordRow[] | null }
type LeadRow = {
  cidade: string | null
  instagram: string | null
  status: string
  leaders: LeaderJoin | LeaderJoin[] | null
}
type LeaderRow = {
  id: string
  nome: string
  telefone: string | null
  cidade: string | null
  municipio: string | null
  coordinators: CoordRow | CoordRow[] | null
}

type LideradoAgg = {
  id: string
  nome: string
  whatsapp: string
  instagram: string | null
  cidade: string | null
  status: string
}

type Acc = {
  lideres: number
  liderados: number
  comentarios: number
  perfis: Set<string>
  tempoPostComentarioSomaMs: number
  tempoPostComentarioN: number
}

function mkAcc(): Acc {
  return {
    lideres: 0,
    liderados: 0,
    comentarios: 0,
    perfis: new Set(),
    tempoPostComentarioSomaMs: 0,
    tempoPostComentarioN: 0,
  }
}

function regiaoTdDeCoordJoin(C: CoordRow | CoordRow[] | null | undefined): TerritorioDesenvolvimentoPI | null {
  const coord = Array.isArray(C) ? C[0] : C
  const regiao = coord?.regiao?.trim() ?? ''
  if (!regiao || !TD_SET.has(regiao)) return null
  return regiao as TerritorioDesenvolvimentoPI
}

function extrairRegiaoTdLead(row: LeadRow): TerritorioDesenvolvimentoPI | null {
  const L = row.leaders
  const leader = Array.isArray(L) ? L[0] : L
  if (!leader) return null
  return regiaoTdDeCoordJoin(leader.coordinators)
}

function extrairRegiaoTdLeader(row: LeaderRow): TerritorioDesenvolvimentoPI | null {
  return regiaoTdDeCoordJoin(row.coordinators)
}

function cidadeLeadPreferida(row: LeadRow): string {
  const L = row.leaders
  const leader = Array.isArray(L) ? L[0] : L
  const raw =
    (typeof row.cidade === 'string' ? row.cidade.trim() : '') ||
    (leader?.municipio && String(leader.municipio).trim()) ||
    (leader?.cidade && String(leader.cidade).trim()) ||
    ''
  return raw
}

function cidadeLeaderPreferida(row: LeaderRow): string {
  const raw =
    (typeof row.municipio === 'string' ? row.municipio.trim() : '') ||
    (typeof row.cidade === 'string' ? row.cidade.trim() : '') ||
    ''
  return raw
}

function resolveOfficialMunicipio(raw: string, oficialList: readonly string[]): string | null {
  const n = normalizeMunicipioNome(raw)
  if (!n) return null
  for (const o of oficialList) {
    if (normalizeMunicipioNome(o) === n) return o
  }
  return null
}

async function passarComentariosIg(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  handleTo: Map<string, { td: TerritorioDesenvolvimentoPI; municipioOficial: string }>
): Promise<{
  postagensProcessadas: number
  comentariosPorHandle: Map<string, number>
  delayAccPorHandle: Map<string, { sumMs: number; n: number }>
}> {
  const comentariosPorHandle = new Map<string, number>()
  const delayAccPorHandle = new Map<string, { sumMs: number; n: number }>()
  for (const h of handleTo.keys()) {
    comentariosPorHandle.set(h, 0)
    delayAccPorHandle.set(h, { sumMs: 0, n: 0 })
  }

  const mediaIds = new Set<string>()
  const comentariosContados = new Set<string>()
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('instagram_comments')
      .select('instagram_comment_id, instagram_media_id, commenter_username, media_posted_at, commented_at')
      .eq('user_id', userId)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) {
      throw new Error(error.message)
    }
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const mid = String((row as { instagram_media_id?: string }).instagram_media_id ?? '').trim()
      if (mid) mediaIds.add(mid)

      const cid = String((row as { instagram_comment_id?: string }).instagram_comment_id ?? '').trim()
      if (!cid || comentariosContados.has(cid)) continue
      comentariosContados.add(cid)

      const u = normalizeInstagramHandle((row as { commenter_username: string | null }).commenter_username)
      if (!u || !handleTo.has(u)) continue

      comentariosPorHandle.set(u, (comentariosPorHandle.get(u) ?? 0) + 1)

      const mediaPosted = (row as { media_posted_at?: string | null }).media_posted_at
      const commentedAt = (row as { commented_at?: string | null }).commented_at
      if (mediaPosted && commentedAt) {
        const t0 = new Date(mediaPosted).getTime()
        const t1 = new Date(commentedAt).getTime()
        if (Number.isFinite(t0) && Number.isFinite(t1)) {
          const delta = t1 - t0
          if (delta >= 0) {
            const acc = delayAccPorHandle.get(u)
            if (acc) {
              acc.sumMs += delta
              acc.n += 1
            }
          }
        }
      }
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  return { postagensProcessadas: mediaIds.size, comentariosPorHandle, delayAccPorHandle }
}

async function buildRelatorioTd(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  td: TerritorioDesenvolvimentoPI
): Promise<RelatorioMapaDigitalIgTdPayload> {
  const oficialMunicipios = [...getMunicipiosPorTerritorioDesenvolvimentoPI(td)]
  const porMun = new Map<string, Acc>()
  for (const nome of oficialMunicipios) {
    porMun.set(nome, mkAcc())
  }

  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leads_militancia')
      .select(
        `
        cidade,
        status,
        leaders!inner (
          cidade,
          municipio,
          coordinators!inner ( regiao )
        )
      `
      )
      .eq('status', 'ativo')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    const rows = (data ?? []) as LeadRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const tdRow = extrairRegiaoTdLead(row)
      if (tdRow !== td) continue
      const official = resolveOfficialMunicipio(cidadeLeadPreferida(row), oficialMunicipios)
      if (!official) continue
      const acc = porMun.get(official)
      if (acc) acc.liderados += 1
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  const lideresNoTd: LeaderRow[] = []
  from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leaders')
      .select(
        `
        id,
        nome,
        telefone,
        cidade,
        municipio,
        coordinators!inner ( regiao )
      `
      )
      .order('nome', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    const rows = (data ?? []) as LeaderRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const tdRow = extrairRegiaoTdLeader(row)
      if (tdRow !== td) continue
      const official = resolveOfficialMunicipio(cidadeLeaderPreferida(row), oficialMunicipios)
      if (!official) continue
      const acc = porMun.get(official)
      if (acc) acc.lideres += 1
      lideresNoTd.push(row)
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  lideresNoTd.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

  const handleTo = new Map<string, { td: TerritorioDesenvolvimentoPI; municipioOficial: string }>()
  from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leads_militancia')
      .select(
        `
        instagram,
        cidade,
        status,
        leaders!inner (
          cidade,
          municipio,
          coordinators!inner ( regiao )
        )
      `
      )
      .eq('status', 'ativo')
      .not('instagram', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    const rows = (data ?? []) as LeadRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const igNorm = normalizeInstagramHandle(row.instagram)
      if (!igNorm) continue
      const tdRow = extrairRegiaoTdLead(row)
      if (tdRow !== td) continue
      const official = resolveOfficialMunicipio(cidadeLeadPreferida(row), oficialMunicipios)
      if (!official) continue
      if (!handleTo.has(igNorm)) {
        handleTo.set(igNorm, { td: tdRow, municipioOficial: official })
      }
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  const leaderIds = lideresNoTd.map((l) => l.id)
  const lidByLeader = await carregarLideradosPorLeaders(admin, leaderIds)

  const { postagensProcessadas, comentariosPorHandle, delayAccPorHandle } = await passarComentariosIg(
    admin,
    userId,
    handleTo
  )

  for (const nome of oficialMunicipios) {
    const a = porMun.get(nome)!
    a.comentarios = 0
    a.perfis = new Set()
    a.tempoPostComentarioSomaMs = 0
    a.tempoPostComentarioN = 0
  }

  for (const [h, loc] of handleTo) {
    const acc = porMun.get(loc.municipioOficial)
    if (!acc) continue
    const c = comentariosPorHandle.get(h) ?? 0
    acc.comentarios += c
    if (c > 0) acc.perfis.add(h)
    const d = delayAccPorHandle.get(h)
    if (d && d.n > 0) {
      acc.tempoPostComentarioSomaMs += d.sumMs
      acc.tempoPostComentarioN += d.n
    }
  }

  const detalhes = montarDetalhesLinhas(
    lideresNoTd,
    lidByLeader,
    oficialMunicipios,
    comentariosPorHandle,
    delayAccPorHandle,
    td
  )

  const resumoRows = oficialMunicipios.map((nome) => {
    const a = porMun.get(nome)!
    const nT = a.tempoPostComentarioN
    const tempoMedioPostComentarioMs = nT > 0 ? Math.round(a.tempoPostComentarioSomaMs / nT) : null
    const pctEng = pctComentariosPorPostagensProcessadas(a.comentarios, postagensProcessadas)
    const tipoEng = classificacaoTerritorioTdPorPctEngajamentoIg(pctEng)
    return {
      territorioTd: td,
      municipio: nome,
      rankIg: 0,
      lideres: a.lideres,
      liderados: a.liderados,
      comentarios: a.comentarios,
      perfisUnicos: a.perfis.size,
      tempoMedioPostComentarioMs,
      pctEngajamento: Math.round(pctEng * 10) / 10,
      classificacaoEngLabel: rotuloEngajamentoIgPorTipo(tipoEng),
    }
  })

  resumoRows.sort((a, b) => b.comentarios - a.comentarios || a.municipio.localeCompare(b.municipio, 'pt-BR'))
  resumoRows.forEach((r, i) => {
    r.rankIg = i + 1
  })

  const totais = somarTotaisPorMapaMunicipios(porMun, oficialMunicipios.length)

  return {
    escopo: 'td',
    recorteDescricao: td,
    geradoEm: new Date().toISOString(),
    territorio: td,
    postagensProcessadas,
    resumoPorMunicipio: resumoRows,
    totais,
    detalhes,
  }
}

async function carregarLideradosPorLeaders(
  admin: ReturnType<typeof createAdminClient>,
  leaderIds: string[]
): Promise<Map<string, LideradoAgg[]>> {
  const lidByLeader = new Map<string, LideradoAgg[]>()
  for (const id of leaderIds) {
    lidByLeader.set(id, [])
  }
  if (leaderIds.length === 0) return lidByLeader

  const chunk = 80
  for (let i = 0; i < leaderIds.length; i += chunk) {
    const slice = leaderIds.slice(i, i + chunk)
    const { data, error } = await admin
      .from('leads_militancia')
      .select('id, nome, whatsapp, instagram, cidade, status, leader_id')
      .eq('status', 'ativo')
      .in('leader_id', slice)

    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      const lid = r as {
        id: string
        nome: string
        whatsapp: string
        instagram: string | null
        cidade: string | null
        status: string
        leader_id: string
      }
      const arr = lidByLeader.get(lid.leader_id)
      if (arr) {
        arr.push({
          id: lid.id,
          nome: lid.nome,
          whatsapp: lid.whatsapp,
          instagram: lid.instagram,
          cidade: lid.cidade,
          status: lid.status,
        })
      }
    }
  }

  for (const arr of lidByLeader.values()) {
    arr.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
  }
  return lidByLeader
}

function somarTotaisPorMapaMunicipios(porMun: Map<string, Acc>, nMunicipios: number): RelatorioMapaDigitalIgTdPayload['totais'] {
  let totLideres = 0
  let totLiderados = 0
  let totCom = 0
  let totPerf = 0
  let tempoSoma = 0
  let tempoN = 0
  for (const a of porMun.values()) {
    totLideres += a.lideres
    totLiderados += a.liderados
    totCom += a.comentarios
    totPerf += a.perfis.size
    tempoSoma += a.tempoPostComentarioSomaMs
    tempoN += a.tempoPostComentarioN
  }
  return {
    mun: nMunicipios,
    lideres: totLideres,
    liderados: totLiderados,
    com: totCom,
    perf: totPerf,
    tempoPostComentarioSomaMs: tempoSoma,
    tempoPostComentarioN: tempoN,
  }
}

function montarDetalhesLinhas(
  lideres: LeaderRow[],
  lidByLeader: Map<string, LideradoAgg[]>,
  oficialMunicipios: readonly string[],
  comentariosPorHandle: Map<string, number>,
  delayAccPorHandle: Map<string, { sumMs: number; n: number }>,
  tdContext: TerritorioDesenvolvimentoPI
): RelatorioMapaDigitalIgDetalheLinha[] {
  const munOficialLeader = new Map<string, string>()
  for (const L of lideres) {
    const mun = resolveOfficialMunicipio(cidadeLeaderPreferida(L), oficialMunicipios)
    if (mun) munOficialLeader.set(L.id, mun)
  }

  const detalhes: RelatorioMapaDigitalIgDetalheLinha[] = []
  for (const L of lideres) {
    const mun = munOficialLeader.get(L.id) ?? '—'
    const liderNome = String(L.nome ?? '').trim() || '—'
    const liderTelefone = String(L.telefone ?? '').trim()
    const liderados = lidByLeader.get(L.id) ?? []

    if (liderados.length === 0) {
      detalhes.push({
        territorioTd: tdContext,
        municipio: mun,
        liderNome,
        liderTelefone,
        lideradoNome: '',
        lideradoWhatsapp: '',
        lideradoInstagram: '',
        lideradoStatus: '',
        comentarios: 0,
        perfisUnicos: 0,
        tempoMedioPostComentarioMs: null,
      })
      continue
    }

    for (const row of liderados) {
      const h = normalizeInstagramHandle(row.instagram)
      const c = h ? (comentariosPorHandle.get(h) ?? 0) : 0
      const d = h ? delayAccPorHandle.get(h) : undefined
      const tempoMedioPostComentarioMs = d && d.n > 0 ? Math.round(d.sumMs / d.n) : null
      detalhes.push({
        territorioTd: tdContext,
        municipio: mun,
        liderNome,
        liderTelefone,
        lideradoNome: row.nome,
        lideradoWhatsapp: row.whatsapp,
        lideradoInstagram: row.instagram ?? '',
        lideradoStatus: row.status,
        comentarios: c,
        perfisUnicos: h && c > 0 ? 1 : 0,
        tempoMedioPostComentarioMs,
      })
    }
  }

  detalhes.sort((a, b) => {
    const t1 = (a.territorioTd ?? '').localeCompare(b.territorioTd ?? '', 'pt-BR')
    if (t1 !== 0) return t1
    const c1 = a.municipio.localeCompare(b.municipio, 'pt-BR', { sensitivity: 'base' })
    if (c1 !== 0) return c1
    const c2 = a.liderNome.localeCompare(b.liderNome, 'pt-BR', { sensitivity: 'base' })
    if (c2 !== 0) return c2
    return a.lideradoNome.localeCompare(b.lideradoNome, 'pt-BR', { sensitivity: 'base' })
  })
  return detalhes
}

async function buildRelatorioPi(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<RelatorioMapaDigitalIgTdPayload> {
  const munListasPorTd = new Map<TerritorioDesenvolvimentoPI, readonly string[]>()
  const porChave = new Map<string, Acc>()
  let nMunTotal = 0
  for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
    const muns = [...getMunicipiosPorTerritorioDesenvolvimentoPI(td)]
    munListasPorTd.set(td, muns)
    nMunTotal += muns.length
    for (const mun of muns) {
      porChave.set(`${td}${SEP_TD_MUN}${mun}`, mkAcc())
    }
  }

  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leads_militancia')
      .select(
        `
        cidade,
        status,
        leaders!inner (
          cidade,
          municipio,
          coordinators!inner ( regiao )
        )
      `
      )
      .eq('status', 'ativo')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    const rows = (data ?? []) as LeadRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const tdRow = extrairRegiaoTdLead(row)
      if (!tdRow) continue
      const oficialList = munListasPorTd.get(tdRow)
      if (!oficialList) continue
      const official = resolveOfficialMunicipio(cidadeLeadPreferida(row), oficialList)
      if (!official) continue
      const acc = porChave.get(`${tdRow}${SEP_TD_MUN}${official}`)
      if (acc) acc.liderados += 1
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  const lideresNoPi: LeaderRow[] = []
  from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leaders')
      .select(
        `
        id,
        nome,
        telefone,
        cidade,
        municipio,
        coordinators!inner ( regiao )
      `
      )
      .order('nome', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    const rows = (data ?? []) as LeaderRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const tdRow = extrairRegiaoTdLeader(row)
      if (!tdRow) continue
      const oficialList = munListasPorTd.get(tdRow)
      if (!oficialList) continue
      const official = resolveOfficialMunicipio(cidadeLeaderPreferida(row), oficialList)
      if (!official) continue
      const acc = porChave.get(`${tdRow}${SEP_TD_MUN}${official}`)
      if (acc) acc.lideres += 1
      lideresNoPi.push(row)
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  lideresNoPi.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))

  const handleTo = new Map<string, { td: TerritorioDesenvolvimentoPI; municipioOficial: string }>()
  from = 0
  for (;;) {
    const { data, error } = await admin
      .from('leads_militancia')
      .select(
        `
        instagram,
        cidade,
        status,
        leaders!inner (
          cidade,
          municipio,
          coordinators!inner ( regiao )
        )
      `
      )
      .eq('status', 'ativo')
      .not('instagram', 'is', null)
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)
    const rows = (data ?? []) as LeadRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      const igNorm = normalizeInstagramHandle(row.instagram)
      if (!igNorm) continue
      const tdRow = extrairRegiaoTdLead(row)
      if (!tdRow) continue
      const oficialList = munListasPorTd.get(tdRow)
      if (!oficialList) continue
      const official = resolveOfficialMunicipio(cidadeLeadPreferida(row), oficialList)
      if (!official) continue
      if (!handleTo.has(igNorm)) {
        handleTo.set(igNorm, { td: tdRow, municipioOficial: official })
      }
    }

    if (rows.length < pageSize) break
    from += pageSize
  }

  const leaderIds = lideresNoPi.map((l) => l.id)
  const lidByLeader = await carregarLideradosPorLeaders(admin, leaderIds)

  const { postagensProcessadas, comentariosPorHandle, delayAccPorHandle } = await passarComentariosIg(
    admin,
    userId,
    handleTo
  )

  for (const k of porChave.keys()) {
    const a = porChave.get(k)!
    a.comentarios = 0
    a.perfis = new Set()
    a.tempoPostComentarioSomaMs = 0
    a.tempoPostComentarioN = 0
  }

  for (const [h, loc] of handleTo) {
    const acc = porChave.get(`${loc.td}${SEP_TD_MUN}${loc.municipioOficial}`)
    if (!acc) continue
    const c = comentariosPorHandle.get(h) ?? 0
    acc.comentarios += c
    if (c > 0) acc.perfis.add(h)
    const d = delayAccPorHandle.get(h)
    if (d && d.n > 0) {
      acc.tempoPostComentarioSomaMs += d.sumMs
      acc.tempoPostComentarioN += d.n
    }
  }

  const tdPorLeader = new Map<string, TerritorioDesenvolvimentoPI>()
  const munOficialPorLeader = new Map<string, string>()
  const oficialPorLeader = new Map<string, readonly string[]>()
  for (const L of lideresNoPi) {
    const tdr = extrairRegiaoTdLeader(L)
    if (!tdr) continue
    const oficialList = munListasPorTd.get(tdr)
    if (!oficialList) continue
    const mun = resolveOfficialMunicipio(cidadeLeaderPreferida(L), oficialList)
    if (!mun) continue
    tdPorLeader.set(L.id, tdr)
    munOficialPorLeader.set(L.id, mun)
    oficialPorLeader.set(L.id, oficialList)
  }

  const detalhes: RelatorioMapaDigitalIgDetalheLinha[] = []
  for (const L of lideresNoPi) {
    const tdr = tdPorLeader.get(L.id)
    const mun = munOficialPorLeader.get(L.id)
    const oficialList = oficialPorLeader.get(L.id)
    if (!tdr || !mun || !oficialList) continue

    const liderNome = String(L.nome ?? '').trim() || '—'
    const liderTelefone = String(L.telefone ?? '').trim()
    const liderados = lidByLeader.get(L.id) ?? []

    if (liderados.length === 0) {
      detalhes.push({
        territorioTd: tdr,
        municipio: mun,
        liderNome,
        liderTelefone,
        lideradoNome: '',
        lideradoWhatsapp: '',
        lideradoInstagram: '',
        lideradoStatus: '',
        comentarios: 0,
        perfisUnicos: 0,
        tempoMedioPostComentarioMs: null,
      })
      continue
    }

    for (const row of liderados) {
      const h = normalizeInstagramHandle(row.instagram)
      const c = h ? (comentariosPorHandle.get(h) ?? 0) : 0
      const d = h ? delayAccPorHandle.get(h) : undefined
      const tempoMedioPostComentarioMs = d && d.n > 0 ? Math.round(d.sumMs / d.n) : null
      detalhes.push({
        territorioTd: tdr,
        municipio: mun,
        liderNome,
        liderTelefone,
        lideradoNome: row.nome,
        lideradoWhatsapp: row.whatsapp,
        lideradoInstagram: row.instagram ?? '',
        lideradoStatus: row.status,
        comentarios: c,
        perfisUnicos: h && c > 0 ? 1 : 0,
        tempoMedioPostComentarioMs,
      })
    }
  }

  detalhes.sort((a, b) => {
    const t1 = (a.territorioTd ?? '').localeCompare(b.territorioTd ?? '', 'pt-BR')
    if (t1 !== 0) return t1
    const c1 = a.municipio.localeCompare(b.municipio, 'pt-BR', { sensitivity: 'base' })
    if (c1 !== 0) return c1
    const c2 = a.liderNome.localeCompare(b.liderNome, 'pt-BR', { sensitivity: 'base' })
    if (c2 !== 0) return c2
    return a.lideradoNome.localeCompare(b.lideradoNome, 'pt-BR', { sensitivity: 'base' })
  })

  const resumoRows: RelatorioMapaDigitalIgTdPayload['resumoPorMunicipio'] = []
  for (const [chave, a] of porChave) {
    const [tdPart, munPart] = chave.split(SEP_TD_MUN)
    const tdRow = tdPart as TerritorioDesenvolvimentoPI
    const nT = a.tempoPostComentarioN
    const tempoMedioPostComentarioMs = nT > 0 ? Math.round(a.tempoPostComentarioSomaMs / nT) : null
    const pctEng = pctComentariosPorPostagensProcessadas(a.comentarios, postagensProcessadas)
    const tipoEng = classificacaoTerritorioTdPorPctEngajamentoIg(pctEng)
    resumoRows.push({
      territorioTd: tdRow,
      municipio: munPart,
      rankIg: 0,
      lideres: a.lideres,
      liderados: a.liderados,
      comentarios: a.comentarios,
      perfisUnicos: a.perfis.size,
      tempoMedioPostComentarioMs,
      pctEngajamento: Math.round(pctEng * 10) / 10,
      classificacaoEngLabel: rotuloEngajamentoIgPorTipo(tipoEng),
    })
  }

  resumoRows.sort(
    (a, b) =>
      b.comentarios - a.comentarios ||
      (a.territorioTd ?? '').localeCompare(b.territorioTd ?? '', 'pt-BR') ||
      a.municipio.localeCompare(b.municipio, 'pt-BR')
  )
  resumoRows.forEach((r, i) => {
    r.rankIg = i + 1
  })

  const totais = somarTotaisPorMapaMunicipios(porChave, nMunTotal)

  return {
    escopo: 'pi',
    recorteDescricao: 'Piauí — todos os territórios de desenvolvimento (12 TDs)',
    geradoEm: new Date().toISOString(),
    territorio: null,
    postagensProcessadas,
    resumoPorMunicipio: resumoRows,
    totais,
    detalhes,
  }
}

export async function GET(request: Request) {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response
  const { userId } = ctx

  const { searchParams } = new URL(request.url)
  const escopoPi = searchParams.get('escopo')?.trim().toLowerCase() === 'pi'

  const admin = createAdminClient()

  try {
    if (escopoPi) {
      const body = await buildRelatorioPi(admin, userId)
      return NextResponse.json(body)
    }

    const tdRaw = (searchParams.get('td') ?? '').trim()
    if (!TD_SET.has(tdRaw)) {
      return NextResponse.json({ error: 'Território inválido ou informe escopo=pi para o PI inteiro.' }, { status: 400 })
    }
    const td = tdRaw as TerritorioDesenvolvimentoPI
    const body = await buildRelatorioTd(admin, userId, td)
    return NextResponse.json(body)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao montar relatório'
    console.error('[relatorio-check-mapa-digital-ig]', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
