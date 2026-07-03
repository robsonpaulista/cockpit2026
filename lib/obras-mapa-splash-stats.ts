import demografiaData from '@/data/demografia-municipios-piaui.json'
import { normalizeMunicipioNome } from '@/lib/fns-municipio-normalize'
import { isObraPavimentacao, type ObraMapaRow } from '@/lib/obras-mapa'

export interface ObrasMandatoSplashStats {
  totalObras: number
  totalMunicipios: number
  valorTotal: number
  metrosQuadradosPavimentados: number
  populacaoImpactada: number
}

function populacaoMunicipioPI(nome: string): number {
  const chave = normalizeMunicipioNome(nome)
  const hit = demografiaData.find((d) => normalizeMunicipioNome(d.municipio) === chave)
  if (!hit) return 0
  return hit.populacao_estimada_ultimo_ano ?? hit.populacao_censo_2022 ?? 0
}

export function calcularPopulacaoImpactada(obras: ObraMapaRow[]): number {
  const municipios = new Set<string>()
  for (const obra of obras) {
    const municipio = obra.municipio?.trim()
    if (municipio) municipios.add(municipio)
  }

  let total = 0
  for (const municipio of municipios) {
    total += populacaoMunicipioPI(municipio)
  }
  return total
}

/** Extrai m² do nome da obra — ex.: "Pavimentação (36.510,00m²)". */
export function extrairMetrosQuadradosObra(obra: string | null | undefined): number {
  if (!obra) return 0
  const match = obra.match(/([\d.]+,\d+|\d+)\s*m[²2]/i)
  if (!match?.[1]) return 0
  const normalizado = match[1].includes(',')
    ? match[1].replace(/\./g, '').replace(',', '.')
    : match[1]
  const valor = Number.parseFloat(normalizado)
  return Number.isFinite(valor) ? valor : 0
}

export function calcularObrasMandatoSplashStats(obras: ObraMapaRow[]): ObrasMandatoSplashStats {
  const municipios = new Set<string>()
  let valorTotal = 0
  let metrosQuadradosPavimentados = 0

  for (const obra of obras) {
    const municipio = obra.municipio?.trim()
    if (!municipio) continue

    municipios.add(municipio)
    valorTotal += obra.valor_total ?? 0
    if (isObraPavimentacao(obra)) {
      metrosQuadradosPavimentados += extrairMetrosQuadradosObra(obra.obra)
    }
  }

  return {
    totalObras: obras.filter((o) => o.municipio?.trim()).length,
    totalMunicipios: municipios.size,
    valorTotal,
    metrosQuadradosPavimentados,
    populacaoImpactada: calcularPopulacaoImpactada(obras),
  }
}

export function formatValorMandatoCompacto(valor: number): string {
  if (valor >= 1_000_000_000) {
    const bi = valor / 1_000_000_000
    return `R$ ${bi >= 10 ? Math.round(bi) : bi.toFixed(1).replace('.0', '')} bilhões`
  }
  if (valor >= 1_000_000) {
    const mi = valor / 1_000_000
    return `R$ ${Math.round(mi)} milhões`
  }
  if (valor >= 1_000) {
    return `R$ ${Math.round(valor / 1_000)} mil`
  }
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(valor)
}

export function formatMetrosQuadradosMandato(m2: number): string {
  if (m2 >= 1_000_000) {
    const mi = m2 / 1_000_000
    return `${mi >= 10 ? Math.round(mi) : mi.toFixed(1).replace('.0', '')} milhões m² pavimentados`
  }
  if (m2 >= 1_000) {
    return `${Math.round(m2 / 1_000)} mil m² pavimentados`
  }
  return `${Math.round(m2).toLocaleString('pt-BR')} m² pavimentados`
}
