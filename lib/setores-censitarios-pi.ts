import fs from 'fs'
import path from 'path'
import { normalizeMunicipioComparacao } from '@/lib/votacao-secao'

export type SetorCensitarioPi = {
  cdSetor: string
  cdMunicipio: string
  nmMunicipio: string
  rotulo: string
  situacao: string
  cdSit: string
  urbano: boolean
  populacao: number
  domicilios: number
  areaKm2: number | null
  centroide: { lat: number; lng: number } | null
  geometry: GeoJSON.Geometry
}

export type MunicipioSetoresCache = {
  chave: string
  cdMunicipio: string
  nmMunicipio: string
  totalSetores: number
  setores: SetorCensitarioPi[]
}

type SetoresIndex = {
  ano: number
  fonte: string
  geradoEm: string
  totalSetores: number
  totalMunicipios: number
  municipios: Array<{
    chave: string
    nmMunicipio: string
    cdMunicipio: string
    totalSetores: number
    arquivo: string
  }>
}

let indexCache: SetoresIndex | null = null
const municipioCache = new Map<string, MunicipioSetoresCache>()

function dataDir(): string {
  return path.join(process.cwd(), 'data', 'setores-censitarios-pi-2022')
}

function normalizeChave(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function loadIndex(): SetoresIndex | null {
  if (indexCache) return indexCache
  const p = path.join(dataDir(), 'index.json')
  if (!fs.existsSync(p)) return null
  try {
    indexCache = JSON.parse(fs.readFileSync(p, 'utf8')) as SetoresIndex
    return indexCache
  } catch {
    return null
  }
}

export function getMetaSetoresCensitariosPi(): {
  ano: number | null
  fonte: string | null
  geradoEm: string | null
  totalSetores: number | null
} {
  const idx = loadIndex()
  if (!idx) return { ano: null, fonte: null, geradoEm: null, totalSetores: null }
  return {
    ano: idx.ano,
    fonte: idx.fonte,
    geradoEm: idx.geradoEm,
    totalSetores: idx.totalSetores,
  }
}

export function getSetoresCensitariosPorMunicipio(municipio: string): SetorCensitarioPi[] {
  const chave = normalizeChave(municipio)
  if (municipioCache.has(chave)) {
    return municipioCache.get(chave)?.setores ?? []
  }

  const idx = loadIndex()
  if (!idx) return []

  let ref = idx.municipios.find((m) => m.chave === chave)
  if (!ref) {
    const alvo = normalizeMunicipioComparacao(municipio)
    ref = idx.municipios.find((m) => normalizeMunicipioComparacao(m.nmMunicipio) === alvo)
  }
  if (!ref) return []

  const filePath = path.join(dataDir(), 'municipios', ref.arquivo)
  if (!fs.existsSync(filePath)) return []

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as MunicipioSetoresCache
    municipioCache.set(chave, data)
    return data.setores
  } catch {
    return []
  }
}

export type SetorReferenciaPlano = {
  cdSetor: string
  nome: string
  populacao: number
  urbano: boolean
}

export function setoresParaPlano(setores: SetorCensitarioPi[]): SetorReferenciaPlano[] {
  return setores.map((s) => ({
    cdSetor: s.cdSetor,
    nome: s.rotulo,
    populacao: s.populacao,
    urbano: s.urbano,
  }))
}

export type SetorMapaPlano = {
  cdSetor: string
  rotulo: string
  populacao: number
  urbano: boolean
  blocoId: string | null
  blocoNome: string | null
  geometry: GeoJSON.Geometry
  centroide: { lat: number; lng: number } | null
}

export function setoresParaMapaPlano(setores: SetorCensitarioPi[]): SetorMapaPlano[] {
  return setores.map((s) => ({
    cdSetor: s.cdSetor,
    rotulo: s.rotulo,
    populacao: s.populacao,
    urbano: s.urbano,
    blocoId: null,
    blocoNome: null,
    geometry: s.geometry,
    centroide: s.centroide,
  }))
}
