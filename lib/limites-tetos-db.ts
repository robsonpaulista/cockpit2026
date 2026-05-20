import type { SupabaseClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import {
  formatarNomeMunicipioLista,
  mapearNomeMunicipio,
  normalizeMunicipioNome,
} from '@/lib/fns-municipio-normalize'
import type { LimitesMunicipioResponse, SuasFaixaPorte } from '@/lib/limites-tetos-types'
import { SUAS_FAIXAS_PADRAO } from '@/lib/limites-tetos-types'
import { classificaPorteSuasFromFaixas } from '@/lib/suas-porte'
import { getValorLimitePap } from '@/lib/limites-pap'
import { getValorLimiteMac } from '@/lib/limites-mac'

export function municipioChave(nomeMunicipio: string): string {
  return normalizeMunicipioNome(mapearNomeMunicipio(nomeMunicipio))
}

export async function getExercicioAtivo(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('tetos_config')
    .select('valor')
    .eq('chave', 'exercicio_ativo')
    .maybeSingle()

  const n = parseInt(String(data?.valor ?? '2025'), 10)
  return Number.isFinite(n) ? n : 2025
}

export async function setExercicioAtivo(
  supabase: SupabaseClient,
  exercicio: number,
): Promise<void> {
  await supabase.from('tetos_config').upsert({
    chave: 'exercicio_ativo',
    valor: String(exercicio),
    updated_at: new Date().toISOString(),
  })
}

export interface MunicipioListaItem {
  coMunicipioIbge: string
  noMunicipio: string
  municipio_chave: string
}

function getMunicipiosFromLocalJson(): MunicipioListaItem[] {
  const filePath = path.join(process.cwd(), 'data', 'limites-pap-2025.json')
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const limitesData = JSON.parse(fileContent) as { municipio: string; ibge: string | number }[]
  const map = new Map<string, MunicipioListaItem>()

  limitesData.forEach((item) => {
    const chave = normalizeMunicipioNome(item.municipio)
    if (!map.has(chave)) {
      map.set(chave, {
        coMunicipioIbge: String(item.ibge),
        noMunicipio: formatarNomeMunicipioLista(item.municipio),
        municipio_chave: chave,
      })
    }
  })

  return Array.from(map.values()).sort((a, b) =>
    a.noMunicipio.localeCompare(b.noMunicipio, 'pt-BR'),
  )
}

export async function getMunicipiosLista(
  supabase: SupabaseClient,
  exercicio?: number,
): Promise<MunicipioListaItem[]> {
  /** Lista canônica: todos os municípios do PI (JSON). O banco só complementa IBGE/nome. */
  const local = getMunicipiosFromLocalJson()
  const ex = exercicio ?? (await getExercicioAtivo(supabase))

  const { data: papRows, error } = await supabase
    .from('limites_pap')
    .select('municipio_chave, municipio_nome, ibge')
    .eq('exercicio', ex)

  if (error || !papRows?.length) {
    return local
  }

  const dbPorChave = new Map<string, { ibge: string; nome: string }>()
  for (const row of papRows) {
    const chave = row.municipio_chave as string
    dbPorChave.set(chave, {
      ibge: String(row.ibge ?? ''),
      nome: formatarNomeMunicipioLista(String(row.municipio_nome)),
    })
  }

  const merged = local.map((m) => {
    const db = dbPorChave.get(m.municipio_chave)
    if (!db) return m
    return {
      ...m,
      coMunicipioIbge: db.ibge || m.coMunicipioIbge,
      noMunicipio: db.nome || m.noMunicipio,
    }
  })

  return merged.sort((a, b) => a.noMunicipio.localeCompare(b.noMunicipio, 'pt-BR'))
}

function parseValorDb(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export async function getSuasFaixas(
  supabase: SupabaseClient,
  exercicio: number,
): Promise<SuasFaixaPorte[]> {
  const { data, error } = await supabase
    .from('suas_faixas_porte')
    .select('ordem, populacao_max, porte, valor')
    .eq('exercicio', exercicio)
    .order('ordem', { ascending: true })

  if (error || !data?.length) {
    return SUAS_FAIXAS_PADRAO
  }

  return data.map((r) => ({
    ordem: Number(r.ordem),
    populacao_max: r.populacao_max == null ? null : Number(r.populacao_max),
    porte: String(r.porte),
    valor: parseValorDb(r.valor) ?? 0,
  }))
}

export async function getLimitesMunicipio(
  supabase: SupabaseClient,
  nomeMunicipio: string,
  populacao: number | null,
  exercicio?: number,
): Promise<LimitesMunicipioResponse> {
  const ex = exercicio ?? (await getExercicioAtivo(supabase))
  const chave = municipioChave(nomeMunicipio)

  const [{ data: pap }, { data: mac }, suasFaixas] = await Promise.all([
    supabase
      .from('limites_pap')
      .select('valor, ibge, municipio_nome')
      .eq('exercicio', ex)
      .eq('municipio_chave', chave)
      .maybeSingle(),
    supabase
      .from('limites_mac_municipio')
      .select('valor, ibge, municipio_nome')
      .eq('exercicio', ex)
      .eq('municipio_chave', chave)
      .maybeSingle(),
    getSuasFaixas(supabase, ex),
  ])

  const classificacao = classificaPorteSuasFromFaixas(populacao, suasFaixas)

  let papValor = parseValorDb(pap?.valor)
  let macValor = parseValorDb(mac?.valor)
  if (papValor == null) papValor = getValorLimitePap(nomeMunicipio)
  if (macValor == null) macValor = getValorLimiteMac(nomeMunicipio)

  return {
    exercicio: ex,
    pap: {
      valor: papValor,
      ibge: pap?.ibge != null ? String(pap.ibge) : null,
      municipio_nome: pap?.municipio_nome != null ? String(pap.municipio_nome) : null,
    },
    mac: {
      valor: macValor,
      ibge: mac?.ibge != null ? String(mac.ibge) : null,
      municipio_nome: mac?.municipio_nome != null ? String(mac.municipio_nome) : null,
    },
    suas_faixas: suasFaixas,
    classificacao_suas: {
      porte: classificacao.porte,
      valor_formatado: classificacao.valorFormatado,
      valor_numerico: classificacao.valorNumerico,
    },
  }
}

export async function upsertLimitePap(
  supabase: SupabaseClient,
  params: {
    exercicio: number
    municipio: string
    valor: number
    ibge?: string
    municipio_nome?: string
  },
): Promise<void> {
  const chave = municipioChave(params.municipio)
  const nome = params.municipio_nome ?? formatarNomeMunicipioLista(params.municipio)
  await supabase.from('limites_pap').upsert(
    {
      exercicio: params.exercicio,
      municipio_chave: chave,
      municipio_nome: nome,
      ibge: params.ibge ?? null,
      valor: params.valor,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'exercicio,municipio_chave' },
  )
}

export async function upsertLimiteMac(
  supabase: SupabaseClient,
  params: {
    exercicio: number
    municipio: string
    valor: number
    ibge?: string
    municipio_nome?: string
  },
): Promise<void> {
  const chave = municipioChave(params.municipio)
  const nome = params.municipio_nome ?? formatarNomeMunicipioLista(params.municipio)
  await supabase.from('limites_mac_municipio').upsert(
    {
      exercicio: params.exercicio,
      municipio_chave: chave,
      municipio_nome: nome,
      ibge: params.ibge ?? null,
      valor: params.valor,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'exercicio,municipio_chave' },
  )
}

export async function saveSuasFaixas(
  supabase: SupabaseClient,
  exercicio: number,
  faixas: SuasFaixaPorte[],
): Promise<void> {
  await supabase.from('suas_faixas_porte').delete().eq('exercicio', exercicio)

  const rows = faixas.map((f) => ({
    exercicio,
    ordem: f.ordem,
    populacao_max: f.populacao_max,
    porte: f.porte,
    valor: f.valor,
    updated_at: new Date().toISOString(),
  }))

  if (rows.length > 0) {
    const { error } = await supabase.from('suas_faixas_porte').insert(rows)
    if (error) throw error
  }
}

export async function importLimitesFromJson(
  supabase: SupabaseClient,
  exercicio: number,
): Promise<{ pap: number; mac: number; suas_faixas: number }> {
  const papPath = path.join(process.cwd(), 'data', 'limites-pap-2025.json')
  const macPath = path.join(process.cwd(), 'data', 'limites-mac-2025.json')

  const papLista = JSON.parse(fs.readFileSync(papPath, 'utf8')) as {
    municipio: string
    ibge: string | number
    valor: number
  }[]

  const macLista = JSON.parse(fs.readFileSync(macPath, 'utf8')) as {
    municipio: string
    ibge: string | number
    valor: number
  }[]

  const papByMun = new Map<string, { ibge: string; nome: string; valor: number }>()
  for (const item of papLista) {
    const chave = normalizeMunicipioNome(item.municipio)
    papByMun.set(chave, {
      ibge: String(item.ibge),
      nome: item.municipio,
      valor: item.valor,
    })
  }

  const macByMun = new Map<string, { ibge: string; nome: string; valor: number }>()
  for (const item of macLista) {
    const chave = normalizeMunicipioNome(item.municipio)
    const prev = macByMun.get(chave)
    const add = item.valor || 0
    if (prev) {
      prev.valor += add
    } else {
      macByMun.set(chave, {
        ibge: String(item.ibge),
        nome: item.municipio,
        valor: add,
      })
    }
  }

  const papRows = Array.from(papByMun.entries()).map(([chave, v]) => ({
    exercicio,
    municipio_chave: chave,
    municipio_nome: formatarNomeMunicipioLista(v.nome),
    ibge: v.ibge,
    valor: v.valor,
  }))

  const macRows = Array.from(macByMun.entries()).map(([chave, v]) => ({
    exercicio,
    municipio_chave: chave,
    municipio_nome: formatarNomeMunicipioLista(v.nome),
    ibge: v.ibge,
    valor: v.valor,
  }))

  const batchSize = 200
  for (let i = 0; i < papRows.length; i += batchSize) {
    const { error } = await supabase
      .from('limites_pap')
      .upsert(papRows.slice(i, i + batchSize), { onConflict: 'exercicio,municipio_chave' })
    if (error) throw error
  }

  for (let i = 0; i < macRows.length; i += batchSize) {
    const { error } = await supabase
      .from('limites_mac_municipio')
      .upsert(macRows.slice(i, i + batchSize), { onConflict: 'exercicio,municipio_chave' })
    if (error) throw error
  }

  await saveSuasFaixas(supabase, exercicio, SUAS_FAIXAS_PADRAO)
  await setExercicioAtivo(supabase, exercicio)

  return {
    pap: papRows.length,
    mac: macRows.length,
    suas_faixas: SUAS_FAIXAS_PADRAO.length,
  }
}
