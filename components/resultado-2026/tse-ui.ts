import type { NivelArvore2026 } from '@/lib/resultado-secao-2026'

export { TSE_TOKENS } from '@/components/tse/tse-tokens'

/** Cor de cada candidato na comparação (ordem da seleção). */
export const CANDIDATO_CORES = ['#9EB737', '#5D8AA7', '#EBB402', '#FF4860'] as const

export function corCandidato(posicao: number): string {
  return CANDIDATO_CORES[posicao % CANDIDATO_CORES.length]
}

/** Cores do mapa de domínio territorial, na ordem de quem venceu em mais municípios. */
export const TERRITORIO_CORES = [
  '#005B8F',
  '#9EB737',
  '#EBB402',
  '#FF4860',
  '#7B5EA7',
  '#2BA59B',
  '#5D8AA7',
  '#D46A9F',
  '#4E6E2E',
  '#8A6D3B',
  '#1F3A93',
  '#A93226',
  '#17A589',
  '#6C3483',
  '#48C9B0',
  '#E6B0AA',
  '#2E4053',
  '#7DCEA0',
  '#AF7AC5',
  '#85C1E9',
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
  return `hsl(${Math.round((k * 137.5 + 20) % 360)} ${k % 2 ? 45 : 60}% ${k % 3 === 0 ? 38 : 52}%)`
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
