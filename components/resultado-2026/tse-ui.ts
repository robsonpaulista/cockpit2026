import type { NivelArvore2026 } from '@/lib/resultado-secao-2026'

export { TSE_TOKENS } from '@/components/tse/tse-tokens'

/** Cor de cada candidato na comparação (ordem da seleção). */
export const CANDIDATO_CORES = ['#9EB737', '#5D8AA7', '#EBB402', '#FF4860'] as const

export function corCandidato(posicao: number): string {
  return CANDIDATO_CORES[posicao % CANDIDATO_CORES.length]
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
