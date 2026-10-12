import type { NivelArvore2026 } from '@/lib/resultado-secao-2026'

export { TSE_TOKENS } from '@/components/tse/tse-tokens'

/** Cor de cada candidato na comparação (ordem da seleção). */
export const CANDIDATO_CORES = ['#9EB737', '#5D8AA7', '#EBB402', '#FF4860'] as const

export function corCandidato(posicao: number): string {
  return CANDIDATO_CORES[posicao % CANDIDATO_CORES.length]
}

/**
 * Cores do mapa de domínio territorial, na ordem da legenda (votos no estado).
 * Base: cores de máximo contraste de Kelly; matizes vizinhos ficam afastados na ordem.
 */
export const TERRITORIO_CORES = [
  '#0067A5',
  '#BE0032',
  '#F3C300',
  '#008856',
  '#875692',
  '#F38400',
  '#A1CAF1',
  '#E68FAC',
  '#8DB600',
  '#654522',
  '#00A3A3',
  '#C2B280',
  '#1B1F3B',
  '#848482',
  '#B3446C',
  '#F99379',
  '#882D17',
  '#D4B9DA',
  '#DCD300',
  '#2B3D26',
] as const

/**
 * Cores oficiais dos partidos (sigla como vem do TSE), conforme a predefinição
 * "Cor de partido político/BRA" da Wikipédia. Democrata (ex-PMB) não tem cor lá; usa o azul da marca.
 */
export const CORES_PARTIDOS: Record<string, string> = {
  AVANTE: '#2EABB1',
  CIDADANIA: '#EC008C',
  DC: '#C89721',
  DEMOCRATA: '#3B82F6',
  MDB: '#009959',
  MISSÃO: '#FCBE26',
  MOBILIZA: '#DD3333',
  NOVO: '#EC671C',
  PCDOB: '#800314',
  PCO: '#9F030A',
  PDT: '#FE8E6D',
  PL: '#30306C',
  PODE: '#00D663',
  PP: '#54B8EA',
  PSB: '#FFCC00',
  PSD: '#FFA400',
  PSDB: '#0F2BC5',
  PSOL: '#68018D',
  PT: '#C0122D',
  PV: '#01652F',
  REDE: '#3CA08C',
  REPUBLICANOS: '#005CA9',
  SOLIDARIEDADE: '#F37021',
  UNIÃO: '#00A0DF',
  UP: '#000000',
}

/** Cor do i-ésimo vencedor; além da paleta fixa, matizes espaçados pelo ângulo áureo. */
export function corTerritorio(i: number): string {
  const fixa = TERRITORIO_CORES[i]
  if (fixa) return fixa
  const k = i - TERRITORIO_CORES.length
  return hslParaHex((k * 137.5 + 20) % 360, k % 2 ? 45 : 60, k % 3 === 0 ? 38 : 52)
}

function hslParaHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const canal = (n: number) => {
    const k = (n + h / 30) % 12
    const v = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255).toString(16).padStart(2, '0')
  }
  return `#${canal(0)}${canal(8)}${canal(4)}`
}

export const NIVEL_ARVORE_ROTULO: Record<NivelArvore2026, string> = {
  municipio: 'Município',
  bairro: 'Bairro',
  local: 'Local',
  zona: 'Zona',
  secao: 'Seção',
}

export function rotuloCorrelacao(r: number): string {
  const a = Math.abs(r)
  const forca = a >= 0.7 ? 'forte' : a >= 0.4 ? 'moderada' : a >= 0.2 ? 'fraca' : 'quase nula'
  return `${forca}${a >= 0.2 ? (r > 0 ? ' e positiva' : ' e negativa') : ''}`
}

export function normalizarTexto(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function nomeProprio(t: string): string {
  return t.toLowerCase().replace(/(^|\s|-)(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}

export function abreviarCargo(cargo: string): string {
  return cargo.replace(/^Deputad[oa]\s+/i, 'Dep. ')
}

export function baixarCsv(nome: string, conteudo: string) {
  const blob = new Blob([`\ufeff${conteudo}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}
