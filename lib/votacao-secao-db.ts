import type { SupabaseClient } from '@supabase/supabase-js'
import {
  normalizeMunicipioChaveVotacao,
  normalizeMunicipioComparacao,
  VOTACAO_SECAO_ANO_PADRAO,
  VOTACAO_SECAO_TURNO,
  type MunicipioVotacaoSecaoRef,
  type VotacaoSecaoItem,
  type VotacaoSecaoResumo,
  type VotacaoSecaoResultado,
  type VotacaoSecaoAno,
} from '@/lib/votacao-secao'

const PAGE_SIZE = 1000
const LOCAL_IDS_CHUNK = 120

type LocalRow = {
  id: string
  nr_zona: number
  nr_secao: number
  nr_local_votacao: number | null
  nm_local_votacao: string | null
  ds_endereco: string | null
  nm_bairro: string | null
  nm_municipio: string
}

type VotoRow = {
  local_id: string
  cd_cargo: number
  ds_cargo: string
  nr_votavel: number
  nm_votavel: string
  sq_candidato: number | null
  qt_votos: number
}

function parseNum(v: unknown): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

async function fetchPaginated<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = []
  let from = 0

  while (true) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data?.length) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return all
}

async function listMunicipiosRefs(
  supabase: SupabaseClient,
  ano: VotacaoSecaoAno = VOTACAO_SECAO_ANO_PADRAO,
): Promise<MunicipioVotacaoSecaoRef[]> {
  const rows = await fetchPaginated<{ municipio_chave: string; nm_municipio: string }>(
    async (from, to) =>
      supabase
        .from('votacao_secao_local')
        .select('municipio_chave, nm_municipio')
        .eq('ano_eleicao', ano)
        .order('nm_municipio')
        .range(from, to),
  )

  const map = new Map<string, string>()
  for (const row of rows) {
    const chave = String(row.municipio_chave ?? '').trim()
    const nome = String(row.nm_municipio ?? '').trim()
    if (chave && nome && !map.has(chave)) {
      map.set(chave, nome)
    }
  }

  return [...map.entries()]
    .map(([chave, nome]) => ({ chave, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function resolveMunicipioVotacaoSecao(
  supabase: SupabaseClient,
  municipioInput: string,
  ano: VotacaoSecaoAno = VOTACAO_SECAO_ANO_PADRAO,
): Promise<MunicipioVotacaoSecaoRef | null> {
  const trimmed = municipioInput.trim()
  if (!trimmed) return null

  const chaveDireta = normalizeMunicipioChaveVotacao(trimmed)

  const { data: hit, error } = await supabase
    .from('votacao_secao_local')
    .select('municipio_chave, nm_municipio')
    .eq('ano_eleicao', ano)
    .eq('municipio_chave', chaveDireta)
    .limit(1)

  if (error) {
    console.error('resolveMunicipioVotacaoSecao:', error)
    return null
  }

  if (hit?.[0]) {
    return {
      chave: hit[0].municipio_chave,
      nome: hit[0].nm_municipio,
    }
  }

  const alvo = normalizeMunicipioComparacao(trimmed)
  const refs = await listMunicipiosRefs(supabase, ano)
  return refs.find((m) => normalizeMunicipioComparacao(m.nome) === alvo) ?? null
}

export async function listMunicipiosVotacaoSecao(
  supabase: SupabaseClient,
  ano: VotacaoSecaoAno = VOTACAO_SECAO_ANO_PADRAO,
): Promise<string[]> {
  const refs = await listMunicipiosRefs(supabase, ano)
  return refs.map((m) => m.nome)
}

async function fetchLocaisMunicipio(
  supabase: SupabaseClient,
  chave: string,
  ano: number,
  turno: number,
): Promise<LocalRow[]> {
  return fetchPaginated<LocalRow>(async (from, to) =>
    supabase
      .from('votacao_secao_local')
      .select('id, nr_zona, nr_secao, nr_local_votacao, nm_local_votacao, ds_endereco, nm_bairro, nm_municipio')
      .eq('ano_eleicao', ano)
      .eq('nr_turno', turno)
      .eq('municipio_chave', chave)
      .order('nr_zona')
      .order('nr_secao')
      .range(from, to),
  )
}

async function fetchVotosPorLocais(
  supabase: SupabaseClient,
  localIds: string[],
  cargoFiltro: string | null,
): Promise<VotoRow[]> {
  if (localIds.length === 0) return []

  const all: VotoRow[] = []

  for (const chunk of chunkArray(localIds, LOCAL_IDS_CHUNK)) {
    const chunkRows = await fetchPaginated<VotoRow>(async (from, to) => {
      let q = supabase
        .from('votacao_secao_voto')
        .select('local_id, cd_cargo, ds_cargo, nr_votavel, nm_votavel, sq_candidato, qt_votos')
        .in('local_id', chunk)

      if (cargoFiltro) {
        q = q.ilike('ds_cargo', cargoFiltro)
      }

      return q.range(from, to)
    })

    all.push(...chunkRows)
  }

  return all
}

export async function getVotacaoSecaoPorMunicipio(
  supabase: SupabaseClient,
  municipio: string,
  params?: { cargo?: string | null; ano?: VotacaoSecaoAno; turno?: number },
): Promise<{ resumo: VotacaoSecaoResumo; secoes: VotacaoSecaoItem[] } | null> {
  const ano = params?.ano ?? VOTACAO_SECAO_ANO_PADRAO
  const turno = params?.turno ?? VOTACAO_SECAO_TURNO
  const cargoFiltro = params?.cargo?.trim() || null

  const ref = await resolveMunicipioVotacaoSecao(supabase, municipio, ano)
  if (!ref) return null

  let locais: LocalRow[] = []
  try {
    locais = await fetchLocaisMunicipio(supabase, ref.chave, ano, turno)
  } catch (error) {
    console.error('getVotacaoSecaoPorMunicipio locais:', error)
    return null
  }

  if (!locais.length) return null

  let votos: VotoRow[] = []
  try {
    votos = await fetchVotosPorLocais(
      supabase,
      locais.map((l) => l.id),
      cargoFiltro,
    )
  } catch (error) {
    console.error('getVotacaoSecaoPorMunicipio votos:', error)
    return null
  }

  const votosPorLocal = new Map<string, VotacaoSecaoResultado[]>()
  const cargosSet = new Set<string>()

  for (const v of votos) {
    cargosSet.add(v.ds_cargo)
    const lista = votosPorLocal.get(v.local_id) ?? []
    lista.push({
      cdCargo: v.cd_cargo,
      dsCargo: v.ds_cargo,
      nrVotavel: v.nr_votavel,
      nmVotavel: v.nm_votavel,
      sqCandidato: v.sq_candidato != null ? Number(v.sq_candidato) : null,
      qtVotos: parseNum(v.qt_votos),
    })
    votosPorLocal.set(v.local_id, lista)
  }

  const secoes: VotacaoSecaoItem[] = locais.map((local) => {
    const resultados = (votosPorLocal.get(local.id) ?? []).sort(
      (a, b) => b.qtVotos - a.qtVotos || a.nmVotavel.localeCompare(b.nmVotavel, 'pt-BR'),
    )
    const totalVotos = resultados.reduce((acc, r) => acc + r.qtVotos, 0)
    return {
      localId: local.id,
      nrZona: local.nr_zona,
      nrSecao: local.nr_secao,
      nrLocalVotacao: local.nr_local_votacao,
      nmLocalVotacao: local.nm_local_votacao,
      dsEndereco: local.ds_endereco,
      nmBairro: local.nm_bairro,
      totalVotos,
      resultados,
    }
  })

  secoes.sort(
    (a, b) =>
      a.nrZona - b.nrZona ||
      a.nrSecao - b.nrSecao ||
      (a.nrLocalVotacao ?? 0) - (b.nrLocalVotacao ?? 0),
  )

  const totalVotos = secoes.reduce((acc, s) => acc + s.totalVotos, 0)

  return {
    resumo: {
      municipio: ref.nome,
      anoEleicao: ano,
      nrTurno: turno,
      totalSecoes: secoes.length,
      totalVotos,
      cargos: [...cargosSet].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    },
    secoes,
  }
}
