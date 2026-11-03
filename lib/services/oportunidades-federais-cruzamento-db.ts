import { createClient } from '@/lib/supabase/server'
import { buildCitySummariesFromDb } from '@/lib/territorio-liderancas-db'
import { normalizeTerritorioExpectativaCityKey } from '@/lib/territorio-expectativa-sheet'
import { resolverNomeMunicipioPIOficial } from '@/lib/piaui-territorio-desenvolvimento'
import type { BaseCruzamento, MunicipioBaseCruzamento } from '@/lib/services/oportunidades-federais-cruzamento'

function formatarNomeChave(chave: string): string {
  const oficial = resolverNomeMunicipioPIOficial(chave)
  if (oficial) return oficial
  return chave
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      const lower = ['de', 'da', 'do', 'das', 'dos', 'e']
      if (lower.includes(w)) return w
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

async function chavesMunicipiosComEmenda(): Promise<Set<string>> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('emendas')
      .select('municipio_beneficiario')
      .not('municipio_beneficiario', 'is', null)
    if (error || !data) return new Set()
    const set = new Set<string>()
    for (const row of data) {
      const nome = String(row.municipio_beneficiario || '').trim()
      if (!nome) continue
      set.add(normalizeTerritorioExpectativaCityKey(nome))
    }
    return set
  } catch {
    return new Set()
  }
}

/** Municípios da base territorial do gabinete + flag de emenda. */
export async function carregarBaseCruzamento(): Promise<BaseCruzamento> {
  const [{ summaries }, emendas] = await Promise.all([
    buildCitySummariesFromDb(),
    chavesMunicipiosComEmenda(),
  ])

  const municipios: MunicipioBaseCruzamento[] = [...summaries.entries()]
    .map(([chave, s]) => {
      const liderancas = Math.round(Number(s.liderancas) || 0)
      const expectativaLegado = Math.round(Number(s.expectativaLegadoVotos) || 0)
      const chaveNorm = normalizeTerritorioExpectativaCityKey(chave)
      return {
        chave,
        nome: formatarNomeChave(chave),
        liderancas,
        expectativaLegado,
        temLideranca: liderancas > 0,
        temEmenda: emendas.has(chaveNorm),
      }
    })
    .sort(
      (a, b) =>
        Number(b.temLideranca) - Number(a.temLideranca) ||
        b.expectativaLegado - a.expectativaLegado ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    )

  return {
    municipios,
    total: municipios.length,
    comLideranca: municipios.filter((m) => m.temLideranca).length,
    comEmenda: municipios.filter((m) => m.temEmenda).length,
    expectativaTotal: municipios.reduce((s, m) => s + m.expectativaLegado, 0),
  }
}
