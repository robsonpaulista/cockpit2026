import type { PlanoAmostragemBloco } from '@/lib/plano-amostragem-publico-types'
import type { LocalMapaPlano } from '@/lib/eleitorado-locais-pi'
import type { SetorMapaPlano } from '@/lib/setores-censitarios-pi'

const CORES_BLOCO = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#be185d',
  '#4f46e5',
  '#0d9488',
]

export function corBlocoPlano(blocoId: string, blocos: PlanoAmostragemBloco[]): string {
  const idx = blocos.findIndex((b) => b.id === blocoId)
  if (idx < 0) return '#64748b'
  return CORES_BLOCO[idx % CORES_BLOCO.length]
}

/** Associa cada local de votação ao bloco territorial do plano (por nome de bairro). */
export function atribuirLocaisAosBlocos(
  locais: LocalMapaPlano[],
  blocos: PlanoAmostragemBloco[],
): LocalMapaPlano[] {
  const urbanos = blocos.filter((b) => b.tipo === 'urbano')
  const rurais = blocos.filter((b) => b.tipo === 'rural')

  const mapaBairroBloco = new Map<string, PlanoAmostragemBloco>()
  for (const bloco of urbanos) {
    if (
      (bloco.id.startsWith('bairro-') || bloco.id.startsWith('setor-')) &&
      !bloco.id.includes('outros')
    ) {
      mapaBairroBloco.set(bloco.nome.toLowerCase(), bloco)
    }
  }
  const blocoOutros = urbanos.find(
    (b) => b.id === 'bairro-outros' || b.id === 'setor-outros',
  )
  const blocoRuralOutros = rurais.find((b) => b.id === 'rur-bairro-outros' || b.id === 'rur-setor-outros')
  const blocoRuralDefault = rurais[0] ?? null

  const mapaRuralBloco = new Map<string, PlanoAmostragemBloco>()
  for (const bloco of rurais) {
    if (
      (bloco.id.startsWith('rur-bairro-') || bloco.id.startsWith('rur-setor-')) &&
      !bloco.id.includes('outros')
    ) {
      mapaRuralBloco.set(bloco.nome.toLowerCase(), bloco)
    }
  }

  return locais.map((local) => {
    if (local.zonaRural) {
      const chaveRecorte = (local.recorteRural ?? local.bairro).toLowerCase()
      const bloco =
        mapaRuralBloco.get(chaveRecorte) ??
        (blocoRuralOutros && !mapaRuralBloco.has(chaveRecorte) ? blocoRuralOutros : null) ??
        blocoRuralDefault

      if (!bloco) return local

      return {
        ...local,
        blocoId: bloco.id,
        blocoNome: bloco.nome,
      }
    }

    const chave = local.bairro.toLowerCase()
    const bloco =
      mapaBairroBloco.get(chave) ??
      (blocoOutros && !mapaBairroBloco.has(chave) ? blocoOutros : urbanos[0] ?? null)

    if (!bloco) {
      return local
    }

    return {
      ...local,
      blocoId: bloco.id,
      blocoNome: bloco.nome,
    }
  })
}

/** Associa setores IBGE aos blocos do plano (por rótulo/nome do bloco). */
export function atribuirSetoresAosBlocos(
  setores: SetorMapaPlano[],
  blocos: PlanoAmostragemBloco[],
): SetorMapaPlano[] {
  const urbanos = blocos.filter((b) => b.tipo === 'urbano')
  const rurais = blocos.filter((b) => b.tipo === 'rural')

  const mapaNomeBloco = new Map<string, PlanoAmostragemBloco>()
  for (const bloco of [...urbanos, ...rurais]) {
    mapaNomeBloco.set(bloco.nome.toLowerCase(), bloco)
  }

  const blocoOutrosUrbano = urbanos.find((b) => b.id === 'setor-outros')
  const blocoOutrosRural = rurais.find((b) => b.id === 'rur-setor-outros')

  return setores.map((setor) => {
    const chave = setor.rotulo.toLowerCase()
    let bloco = mapaNomeBloco.get(chave)

    if (!bloco) {
      if (setor.urbano) {
        bloco =
          urbanos.find((b) => chave.includes(b.nome.toLowerCase()) || b.nome.toLowerCase().includes(chave)) ??
          blocoOutrosUrbano ??
          urbanos[0]
      } else {
        bloco =
          rurais.find((b) => chave.includes(b.nome.toLowerCase()) || b.nome.toLowerCase().includes(chave)) ??
          blocoOutrosRural ??
          rurais[0]
      }
    }

    if (!bloco) return setor

    return {
      ...setor,
      blocoId: bloco.id,
      blocoNome: bloco.nome,
    }
  })
}

export function calcularCentroMapaFromSetores(
  setores: SetorMapaPlano[],
): { lat: number; lng: number; zoom: number } {
  const pts = setores
    .map((s) => s.centroide)
    .filter((c): c is { lat: number; lng: number } => c != null)
  if (pts.length === 0) return { lat: -7.7183, lng: -42.7289, zoom: 7 }
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
  const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length
  const zoom = pts.length > 80 ? 12 : pts.length > 30 ? 13 : 14
  return { lat, lng, zoom }
}

export function calcularCentroMapa(locais: LocalMapaPlano[]): { lat: number; lng: number; zoom: number } {
  if (locais.length === 0) {
    return { lat: -7.7183, lng: -42.7289, zoom: 7 }
  }
  const lat = locais.reduce((s, l) => s + l.lat, 0) / locais.length
  const lng = locais.reduce((s, l) => s + l.lng, 0) / locais.length
  const zoom = locais.length > 80 ? 12 : locais.length > 30 ? 13 : 14
  return { lat, lng, zoom }
}
