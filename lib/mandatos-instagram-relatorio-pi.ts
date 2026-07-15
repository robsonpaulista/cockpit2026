import type { createAdminClient } from '@/lib/supabase/admin'
import {
  getMandatosInstagramEnriquecidos,
  labelCargoMandato,
  type MandatoInstagramEnriquecido,
} from '@/lib/mandatos-instagram-piaui'
import {
  classificacaoTerritorioTdPorPctEngajamentoIg,
  pctMidiasComComentarioPorPostagensProcessadas,
  rotuloEngajamentoIgPorTipo,
} from '@/lib/instagram-engajamento-ig-classificacao'
import {
  getMunicipiosPorTerritorioDesenvolvimentoPI,
  TERRITORIOS_DESENVOLVIMENTO_PI,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import type {
  RelatorioMapaDigitalIgDetalheLinha,
  RelatorioMapaDigitalIgTdPayload,
} from '@/lib/relatorio-mapa-digital-ig-td-types'

const SEP_TD_MUN = '\u0000'

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

type HandleLoc = { td: TerritorioDesenvolvimentoPI; municipioOficial: string }

type PassarComentariosFn = (
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  handleTo: Map<string, HandleLoc>
) => Promise<{
  postagensProcessadas: number
  comentariosPorHandle: Map<string, number>
  delayAccPorHandle: Map<string, { sumMs: number; n: number }>
  mediasPorHandle: Map<string, Set<string>>
}>

function midiasDistintasNoRecorte(
  handleTo: Map<string, HandleLoc>,
  mediasPorHandle: Map<string, Set<string>>,
  pred: (loc: HandleLoc) => boolean
): number {
  const seen = new Set<string>()
  for (const [h, loc] of handleTo) {
    if (!pred(loc)) continue
    const s = mediasPorHandle.get(h)
    if (!s) continue
    for (const m of s) seen.add(m)
  }
  return seen.size
}

function somarTotaisPorMapaMunicipios(
  porChave: Map<string, Acc>,
  nMunicipios: number
): RelatorioMapaDigitalIgTdPayload['totais'] {
  let totLideres = 0
  let totLiderados = 0
  let totCom = 0
  let totPerf = 0
  let tempoSoma = 0
  let tempoN = 0
  for (const a of porChave.values()) {
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

function montarDetalhesMandatos(
  mandatos: MandatoInstagramEnriquecido[],
  comentariosPorHandle: Map<string, number>,
  delayAccPorHandle: Map<string, { sumMs: number; n: number }>
): RelatorioMapaDigitalIgDetalheLinha[] {
  const detalhes: RelatorioMapaDigitalIgDetalheLinha[] = []
  const sorted = [...mandatos].sort(
    (a, b) =>
      a.municipioOficial.localeCompare(b.municipioOficial, 'pt-BR') ||
      (a.cargo === 'prefeito' ? 0 : 1) - (b.cargo === 'prefeito' ? 0 : 1) ||
      a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
  )

  for (const m of sorted) {
    const comentarios = comentariosPorHandle.get(m.handle) ?? 0
    const delay = delayAccPorHandle.get(m.handle)
    const tempoMedioPostComentarioMs =
      delay && delay.n > 0 ? Math.round(delay.sumMs / delay.n) : null
    detalhes.push({
      territorioTd: m.territorioTd,
      municipio: m.municipioOficial,
      liderNome: m.nome,
      liderInstagram: m.handle ? `@${m.handle}` : m.instagram ?? '',
      cargo: labelCargoMandato(m.cargo),
      liderTelefone: m.partido ?? '',
      lideradoNome: '',
      lideradoWhatsapp: '',
      lideradoInstagram: '',
      lideradoStatus: comentarios > 0 ? 'ativo' : 'inativo',
      comentarios,
      perfisUnicos: comentarios > 0 ? 1 : 0,
      tempoMedioPostComentarioMs,
    })
  }
  return detalhes
}

export async function buildRelatorioPiMandatos(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  passarComentariosIg: PassarComentariosFn
): Promise<RelatorioMapaDigitalIgTdPayload> {
  const mandatos = getMandatosInstagramEnriquecidos()
  const porChave = new Map<string, Acc>()
  let nMunTotal = 0

  for (const td of TERRITORIOS_DESENVOLVIMENTO_PI) {
    const muns = [...getMunicipiosPorTerritorioDesenvolvimentoPI(td)]
    nMunTotal += muns.length
    for (const mun of muns) {
      porChave.set(`${td}${SEP_TD_MUN}${mun}`, mkAcc())
    }
  }

  const handleTo = new Map<string, HandleLoc>()
  for (const m of mandatos) {
    const acc = porChave.get(`${m.territorioTd}${SEP_TD_MUN}${m.municipioOficial}`)
    if (!acc) continue
    acc.liderados += 1
    if (m.cargo === 'prefeito') acc.lideres += 1
    if (!handleTo.has(m.handle)) {
      handleTo.set(m.handle, { td: m.territorioTd, municipioOficial: m.municipioOficial })
    }
  }

  const { postagensProcessadas, comentariosPorHandle, delayAccPorHandle, mediasPorHandle } =
    await passarComentariosIg(admin, userId, handleTo)

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

  const resumoRows: RelatorioMapaDigitalIgTdPayload['resumoPorMunicipio'] = []
  for (const [chave, a] of porChave) {
    const sep = chave.indexOf(SEP_TD_MUN)
    const tdRow = chave.slice(0, sep) as TerritorioDesenvolvimentoPI
    const munPart = chave.slice(sep + 1)
    const nT = a.tempoPostComentarioN
    const tempoMedioPostComentarioMs = nT > 0 ? Math.round(a.tempoPostComentarioSomaMs / nT) : null
    const midiasMun = midiasDistintasNoRecorte(
      handleTo,
      mediasPorHandle,
      (loc) => loc.td === tdRow && loc.municipioOficial === munPart
    )
    const pctEng = pctMidiasComComentarioPorPostagensProcessadas(midiasMun, postagensProcessadas)
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
  const detalhes = montarDetalhesMandatos(mandatos, comentariosPorHandle, delayAccPorHandle)

  return {
    escopo: 'pi',
    recorteDescricao: 'Piauí — prefeitos e vereadores com Instagram (planilha mandatos 2024)',
    geradoEm: new Date().toISOString(),
    territorio: null,
    postagensProcessadas,
    resumoPorMunicipio: resumoRows,
    totais,
    detalhes,
  }
}
