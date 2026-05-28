import type { SupabaseClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import {
  formatarNomeMunicipioLista,
  mapearNomeMunicipio,
  normalizeMunicipioNome,
} from '@/lib/fns-municipio-normalize'
import type {
  LimiteMunicipioValor,
  LimitesMacPapPorModalidade,
  LimitesMunicipioResponse,
  SuasFaixaPorte,
} from '@/lib/limites-tetos-types'
import { SUAS_FAIXAS_PADRAO } from '@/lib/limites-tetos-types'
import { classificaPorteSuasFromFaixas } from '@/lib/suas-porte'
import { getValorLimitePap } from '@/lib/limites-pap'
import { getValorLimiteMac } from '@/lib/limites-mac'
import {
  isModalidadeLimite,
  type ModalidadeLimite,
} from '@/lib/emenda-modalidade'

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

function limitesPapJsonPath(exercicio: number): string {
  const preferred = path.join(process.cwd(), 'data', `limites-pap-${exercicio}.json`)
  if (fs.existsSync(preferred)) return preferred
  return path.join(process.cwd(), 'data', 'limites-pap-2025.json')
}

function getMunicipiosFromLocalJson(exercicio?: number): MunicipioListaItem[] {
  const ex = exercicio ?? 2025
  const filePath = limitesPapJsonPath(ex)
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
  const ex = exercicio ?? (await getExercicioAtivo(supabase))
  /** Lista canônica: todos os municípios do PI (JSON). O banco só complementa IBGE/nome. */
  const local = getMunicipiosFromLocalJson(ex)

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

function limiteVazio(): LimiteMunicipioValor {
  return { valor: null, ibge: null, municipio_nome: null }
}

function buildLimitesPorModalidade(
  rows: Array<{
    modalidade?: string | null
    valor: unknown
    ibge?: unknown
    municipio_nome?: unknown
  }>,
): LimitesMacPapPorModalidade {
  const par: LimitesMacPapPorModalidade = {
    individual: limiteVazio(),
    coletiva: limiteVazio(),
  }
  for (const row of rows) {
    const modRaw = String(row.modalidade ?? 'individual')
    const mod: ModalidadeLimite = isModalidadeLimite(modRaw) ? modRaw : 'individual'
    par[mod] = {
      valor: parseValorDb(row.valor),
      ibge: row.ibge != null ? String(row.ibge) : null,
      municipio_nome: row.municipio_nome != null ? String(row.municipio_nome) : null,
    }
  }
  return par
}

function aplicarFallbackJson(
  par: LimitesMacPapPorModalidade,
  nomeMunicipio: string,
  exercicio: number,
  tipo: 'pap' | 'mac',
): LimitesMacPapPorModalidade {
  const getValor = tipo === 'pap' ? getValorLimitePap : getValorLimiteMac
  const out = { ...par }
  for (const mod of ['individual', 'coletiva'] as const) {
    if (out[mod].valor == null) {
      const v = getValor(nomeMunicipio, exercicio, mod)
      if (v != null) out[mod] = { ...out[mod], valor: v }
    }
  }
  return out
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

  const [{ data: papRows }, { data: macRows }, suasFaixas] = await Promise.all([
    supabase
      .from('limites_pap')
      .select('modalidade, valor, ibge, municipio_nome')
      .eq('exercicio', ex)
      .eq('municipio_chave', chave),
    supabase
      .from('limites_mac_municipio')
      .select('modalidade, valor, ibge, municipio_nome')
      .eq('exercicio', ex)
      .eq('municipio_chave', chave),
    getSuasFaixas(supabase, ex),
  ])

  const classificacao = classificaPorteSuasFromFaixas(populacao, suasFaixas)

  let pap = buildLimitesPorModalidade(papRows ?? [])
  let mac = buildLimitesPorModalidade(macRows ?? [])
  pap = aplicarFallbackJson(pap, nomeMunicipio, ex, 'pap')
  mac = aplicarFallbackJson(mac, nomeMunicipio, ex, 'mac')

  return {
    exercicio: ex,
    pap,
    mac,
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
    modalidade?: ModalidadeLimite
    ibge?: string
    municipio_nome?: string
  },
): Promise<void> {
  const chave = municipioChave(params.municipio)
  const nome = params.municipio_nome ?? formatarNomeMunicipioLista(params.municipio)
  const modalidade = params.modalidade ?? 'individual'
  await supabase.from('limites_pap').upsert(
    {
      exercicio: params.exercicio,
      municipio_chave: chave,
      municipio_nome: nome,
      modalidade,
      ibge: params.ibge ?? null,
      valor: params.valor,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'exercicio,municipio_chave,modalidade' },
  )
}

export async function upsertLimiteMac(
  supabase: SupabaseClient,
  params: {
    exercicio: number
    municipio: string
    valor: number
    modalidade?: ModalidadeLimite
    ibge?: string
    municipio_nome?: string
  },
): Promise<void> {
  const chave = municipioChave(params.municipio)
  const nome = params.municipio_nome ?? formatarNomeMunicipioLista(params.municipio)
  const modalidade = params.modalidade ?? 'individual'
  await supabase.from('limites_mac_municipio').upsert(
    {
      exercicio: params.exercicio,
      municipio_chave: chave,
      municipio_nome: nome,
      modalidade,
      ibge: params.ibge ?? null,
      valor: params.valor,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'exercicio,municipio_chave,modalidade' },
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

function limitesMacJsonPath(exercicio: number): string {
  const preferred = path.join(process.cwd(), 'data', `limites-mac-${exercicio}.json`)
  if (fs.existsSync(preferred)) return preferred
  return path.join(process.cwd(), 'data', 'limites-mac-2025.json')
}

function carregarListaJson<T>(paths: string[]): T[] {
  const out: T[] = []
  for (const p of paths) {
    if (fs.existsSync(p)) {
      out.push(...(JSON.parse(fs.readFileSync(p, 'utf8')) as T[]))
    }
  }
  return out
}

function pathsPapImport(exercicio: number): string[] {
  return [
    limitesPapJsonPath(exercicio),
    path.join(process.cwd(), 'data', `limites-pap-${exercicio}-coletivas.json`),
  ]
}

function pathsMacImport(exercicio: number): string[] {
  return [
    limitesMacJsonPath(exercicio),
    path.join(process.cwd(), 'data', `limites-mac-${exercicio}-coletivas.json`),
  ]
}

export async function importLimitesFromJson(
  supabase: SupabaseClient,
  exercicio: number,
): Promise<{ pap: number; mac: number; suas_faixas: number }> {
  const papPaths = pathsPapImport(exercicio)
  const macPaths = pathsMacImport(exercicio)

  if (!papPaths.some((p) => fs.existsSync(p)) || !macPaths.some((p) => fs.existsSync(p))) {
    throw new Error(
      `Arquivos não encontrados para exercício ${exercicio}. Execute: node scripts/xlsx-to-json-limites-${exercicio}.mjs`,
    )
  }

  const papLista = carregarListaJson<{
    municipio: string
    ibge: string | number
    valor: number
    modalidade?: string
  }>(papPaths)

  const macLista = carregarListaJson<{
    municipio: string
    ibge: string | number
    valor: number
    modalidade?: string
  }>(macPaths)

  const papKey = (chave: string, mod: ModalidadeLimite) => `${chave}|${mod}`
  const papByMun = new Map<string, { ibge: string; nome: string; valor: number; modalidade: ModalidadeLimite }>()
  for (const item of papLista) {
    const chave = normalizeMunicipioNome(item.municipio)
    const modRaw = String(item.modalidade ?? 'individual')
    const modalidade: ModalidadeLimite = isModalidadeLimite(modRaw) ? modRaw : 'individual'
    papByMun.set(papKey(chave, modalidade), {
      ibge: String(item.ibge),
      nome: item.municipio,
      valor: item.valor,
      modalidade,
    })
  }

  const macKey = (chave: string, mod: ModalidadeLimite) => `${chave}|${mod}`
  const macByMun = new Map<string, { ibge: string; nome: string; valor: number; modalidade: ModalidadeLimite }>()
  for (const item of macLista) {
    const chave = normalizeMunicipioNome(item.municipio)
    const modRaw = String(item.modalidade ?? 'individual')
    const modalidade: ModalidadeLimite = isModalidadeLimite(modRaw) ? modRaw : 'individual'
    const key = macKey(chave, modalidade)
    const prev = macByMun.get(key)
    const add = item.valor || 0
    if (prev) {
      prev.valor += add
    } else {
      macByMun.set(key, {
        ibge: String(item.ibge),
        nome: item.municipio,
        valor: add,
        modalidade,
      })
    }
  }

  const papRows = Array.from(papByMun.entries()).map(([, v]) => {
    const chave = normalizeMunicipioNome(v.nome)
    return {
      exercicio,
      municipio_chave: chave,
      municipio_nome: formatarNomeMunicipioLista(v.nome),
      modalidade: v.modalidade,
      ibge: v.ibge,
      valor: v.valor,
    }
  })

  const macRows = Array.from(macByMun.entries()).map(([, v]) => {
    const chave = normalizeMunicipioNome(v.nome)
    return {
      exercicio,
      municipio_chave: chave,
      municipio_nome: formatarNomeMunicipioLista(v.nome),
      modalidade: v.modalidade,
      ibge: v.ibge,
      valor: v.valor,
    }
  })

  const batchSize = 200
  for (let i = 0; i < papRows.length; i += batchSize) {
    const { error } = await supabase
      .from('limites_pap')
      .upsert(papRows.slice(i, i + batchSize), {
        onConflict: 'exercicio,municipio_chave,modalidade',
      })
    if (error) throw error
  }

  for (let i = 0; i < macRows.length; i += batchSize) {
    const { error } = await supabase
      .from('limites_mac_municipio')
      .upsert(macRows.slice(i, i + batchSize), {
        onConflict: 'exercicio,municipio_chave,modalidade',
      })
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
