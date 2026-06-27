import dados from '@/data/mandatos-instagram-piaui.json'
import { normalizeInstagramHandle } from '@/lib/mobilizacao-lead-capture'
import {
  getTerritorioDesenvolvimentoPI,
  resolverNomeMunicipioPIOficial,
  type TerritorioDesenvolvimentoPI,
} from '@/lib/piaui-territorio-desenvolvimento'
import type { LiderInstagramCoberturaDto } from '@/lib/mobilizacao-lideres-instagram-cobertura-client'

export type MandatoCargo = 'prefeito' | 'vereador'

export type MandatoInstagramPI = {
  id: string
  cargo: MandatoCargo
  municipio: string
  municipioNorm: string
  nome: string
  partido: string | null
  instagram: string | null
  handle: string | null
  url: string | null
}

export type MandatoInstagramPIPayload = {
  geradoEm: string
  fonte: string
  totalPrefeitosComIg: number
  totalVereadoresComIg: number
  mandatos: MandatoInstagramPI[]
}

export type MandatoInstagramEnriquecido = MandatoInstagramPI & {
  handle: string
  municipioOficial: string
  territorioTd: TerritorioDesenvolvimentoPI
}

export type ExercitoDigitalAudience = 'liderados' | 'mandatos' | 'unificado'

const payload = dados as MandatoInstagramPIPayload

let cacheEnriquecidos: MandatoInstagramEnriquecido[] | null = null

export function getMandatosInstagramPIPayload(): MandatoInstagramPIPayload {
  return payload
}

/** Mandatários com Instagram válido, município e TD resolvidos na base oficial. */
export function getMandatosInstagramEnriquecidos(): MandatoInstagramEnriquecido[] {
  if (cacheEnriquecidos) return cacheEnriquecidos

  const out: MandatoInstagramEnriquecido[] = []
  for (const m of payload.mandatos) {
    const handle = normalizeInstagramHandle(m.handle ?? m.instagram)
    if (!handle) continue
    const municipioOficial = resolverNomeMunicipioPIOficial(m.municipio)
    if (!municipioOficial) continue
    const territorioTd = getTerritorioDesenvolvimentoPI(municipioOficial)
    if (!territorioTd) continue
    out.push({
      ...m,
      handle,
      municipioOficial,
      territorioTd,
    })
  }

  cacheEnriquecidos = out
  return out
}

export function buildMandatosHandleSet(mandatos: MandatoInstagramEnriquecido[]): Set<string> {
  const handles = new Set<string>()
  for (const m of mandatos) {
    if (m.handle) handles.add(m.handle)
  }
  return handles
}

export function mandatosToCoberturaDto(mandatos: MandatoInstagramEnriquecido[]): LiderInstagramCoberturaDto[] {
  return mandatos.map((m) => ({
    id: m.id,
    nome: `${m.nome} · ${m.municipioOficial}${m.cargo === 'prefeito' ? ' (Pref.)' : ' (Ver.)'}`,
    territorio: m.territorioTd,
    handles: [m.handle],
  }))
}

export function labelCargoMandato(cargo: MandatoCargo): string {
  return cargo === 'prefeito' ? 'Prefeito' : 'Vereador'
}

export function labelAudience(audience: ExercitoDigitalAudience): string {
  if (audience === 'mandatos') return 'Prefeitos/Vereadores'
  if (audience === 'unificado') return 'Base eleitoral'
  return 'Liderados'
}
