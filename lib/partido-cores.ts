/**
 * Cores oficiais dos partidos (sigla TSE), alinhadas à predefinição
 * "Cor de partido político/BRA" da Wikipédia — mesma base do Resultado 2026.
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
  PODEMOS: '#00D663',
  PP: '#54B8EA',
  PSB: '#FFCC00',
  PSD: '#0067A5',
  PSDB: '#0F2BC5',
  PSOL: '#68018D',
  PT: '#C0122D',
  PV: '#01652F',
  REDE: '#3CA08C',
  REPUB: '#F3C300',
  REPUBLICANOS: '#F3C300',
  SOLIDARIEDADE: '#F37021',
  UNIÃO: '#00A0DF',
  UP: '#000000',
}

/** Normaliza siglas/aliases usados em Chapas (REPUB, PSD/MDB, etc.). */
export function chavePartidoCor(nome: string): string {
  const raw = nome.trim().toUpperCase()
  if (!raw) return raw
  if (raw === 'REPUB' || raw.startsWith('REPUBLICAN')) return 'REPUBLICANOS'
  if (raw === 'PODEMOS') return 'PODE'
  if (raw.includes('/')) {
    const primeiro = raw.split('/')[0]?.trim() ?? raw
    return chavePartidoCor(primeiro)
  }
  return raw
}

export function corPartidoHex(nome: string, fallback = '#6B7280'): string {
  const chave = chavePartidoCor(nome)
  return CORES_PARTIDOS[chave] ?? fallback
}

/** Texto legível sobre a cor do partido (branco ou grafite). */
export function corTextoSobrePartido(hex: string): '#FFFFFF' | '#1F2937' {
  const h = hex.replace('#', '')
  if (h.length !== 6) return '#FFFFFF'
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  // Luminância relativa aproximada
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luma > 0.62 ? '#1F2937' : '#FFFFFF'
}

export function hexParaRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return `rgba(107, 114, 128, ${alpha})`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Cabeçalho sóbrio: fundo suave + acento na cor oficial. */
export function estiloCabecalhoPartido(nome: string): {
  backgroundColor: string
  color: string
  borderColor: string
  accent: string
  softBg: string
} {
  const accent = corPartidoHex(nome)
  return {
    backgroundColor: hexParaRgba(accent, 0.12),
    softBg: hexParaRgba(accent, 0.08),
    color: '#1F2937',
    borderColor: hexParaRgba(accent, 0.28),
    accent,
  }
}

/** Iniciais curtas para selo/monograma no card. */
export function monogramaPartido(nome: string): string {
  const chave = chavePartidoCor(nome)
  if (chave === 'REPUBLICANOS') return 'REP'
  if (chave.length <= 4) return chave
  return chave.slice(0, 3)
}
