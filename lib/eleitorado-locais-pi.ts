import fs from 'fs'
import path from 'path'
import {
  extrairRecorteRural,
  isBairroGenerico,
  rotuloRecorteLocal,
} from '@/lib/recorte-rural-tse'
import { normalizeMunicipioComparacao } from '@/lib/votacao-secao'

export type LocalVotacaoTsePi = {
  nrZona: number
  nrSecao: number
  nrLocalVotacao: number | null
  nmLocalVotacao: string | null
  dsEndereco: string | null
  nmBairro: string | null
  nrCep: string | null
  nrLatitude: number | null
  nrLongitude: number | null
  qtEleitoresSecao: number
  dsTipoLocal: string | null
  zonaRural: boolean
}

type MunicipioLocaisEntry = {
  nmMunicipio: string
  locais: LocalVotacaoTsePi[]
}

type EleitoradoLocaisPiCache = {
  ano: number
  fonte: string
  geradoEm: string
  municipios: Record<string, MunicipioLocaisEntry>
}

let cache: EleitoradoLocaisPiCache | null = null

function normalizeChave(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function loadCache(): EleitoradoLocaisPiCache | null {
  if (cache) return cache
  const filePath = path.join(process.cwd(), 'data', 'eleitorado-locais-pi-2024.json')
  if (!fs.existsSync(filePath)) return null
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    cache = JSON.parse(raw) as EleitoradoLocaisPiCache
    return cache
  } catch {
    return null
  }
}

export function getLocaisVotacaoTsePorMunicipio(municipio: string): LocalVotacaoTsePi[] {
  const data = loadCache()
  if (!data) return []

  const chave = normalizeChave(municipio)
  const direto = data.municipios[chave]?.locais
  if (direto?.length) return direto

  const alvo = normalizeMunicipioComparacao(municipio)
  for (const entry of Object.values(data.municipios)) {
    if (normalizeMunicipioComparacao(entry.nmMunicipio) === alvo) {
      return entry.locais
    }
  }
  return []
}

export type BairroAgregadoTse = {
  nome: string
  secoes: number
  eleitores: number
  zonaRural: boolean
}

export function agregarBairrosTse(locais: LocalVotacaoTsePi[]): BairroAgregadoTse[] {
  const mapa = new Map<string, BairroAgregadoTse>()

  for (const local of locais) {
    const nome = rotuloRecorteLocal(local)
    const prev = mapa.get(nome) ?? {
      nome,
      secoes: 0,
      eleitores: 0,
      zonaRural: local.zonaRural,
    }
    prev.secoes += 1
    prev.eleitores += local.qtEleitoresSecao
    if (!local.zonaRural) prev.zonaRural = false
    mapa.set(nome, prev)
  }

  return [...mapa.values()].sort((a, b) => b.eleitores - a.eleitores)
}

export type LocalMapaPlano = {
  id: string
  lat: number
  lng: number
  bairro: string
  nmLocal: string | null
  endereco: string | null
  /** Povoado/comunidade extraído do endereço TSE quando bairro é genérico. */
  recorteRural: string | null
  eleitores: number
  zonaRural: boolean
  blocoId: string | null
  blocoNome: string | null
}

export function locaisParaMapaPlano(locais: LocalVotacaoTsePi[]): LocalMapaPlano[] {
  return locais
    .filter((l) => l.nrLatitude != null && l.nrLongitude != null)
    .map((l, i) => {
      const { recorte } = extrairRecorteRural({
        nmBairro: l.nmBairro,
        dsEndereco: l.dsEndereco,
        nmLocalVotacao: l.nmLocalVotacao,
        zonaRural: l.zonaRural,
      })
      const bairroTse = l.nmBairro?.trim() || (l.zonaRural ? 'Zona rural' : 'Sem bairro')
      return {
        id: `${l.nrZona}-${l.nrSecao}-${l.nrLocalVotacao ?? i}`,
        lat: l.nrLatitude as number,
        lng: l.nrLongitude as number,
        bairro: bairroTse,
        nmLocal: l.nmLocalVotacao,
        endereco: l.dsEndereco?.trim() || null,
        recorteRural: recorte,
        eleitores: l.qtEleitoresSecao,
        zonaRural: l.zonaRural,
        blocoId: null,
        blocoNome: null,
      }
    })
}

export { isBairroGenerico, rotuloRecorteLocal }

export function getMetaCacheEleitoradoLocais(): {
  ano: number | null
  fonte: string | null
  geradoEm: string | null
} {
  const data = loadCache()
  if (!data) return { ano: null, fonte: null, geradoEm: null }
  return { ano: data.ano, fonte: data.fonte, geradoEm: data.geradoEm }
}
