/** Rótulos TSE genéricos que não identificam povoado/comunidade. */
const BAIRROS_GENERICOS = new Set([
  '',
  'zona rural',
  'zona rural / sem bairro',
  'sem bairro',
  'sem bairro informado',
  'nao informado',
  'não informado',
  's/n',
])

const PREFIXOS_ENDERECO: ReadonlyArray<{ re: RegExp; rotulo: string }> = [
  { re: /\bPOVOADO\s+(.+?)(?:,|\s+S\/N|\s+SN\b|\s+\d|\s*$)/i, rotulo: 'Povoado' },
  { re: /\bPOV\.\s+(.+?)(?:,|\s+S\/N|\s+SN\b|\s+\d|\s*$)/i, rotulo: 'Pov.' },
  { re: /\bLOCALIDADE\s+(.+?)(?:,|\s+S\/N|\s+SN\b|\s+\d|\s*$)/i, rotulo: 'Localidade' },
  { re: /\bASSENTAMENTO\s+(.+?)(?:,|\s+S\/N|\s+SN\b|\s+\d|\s*$)/i, rotulo: 'Assentamento' },
  { re: /\bCOMUNIDADE\s+(.+?)(?:,|\s+S\/N|\s+SN\b|\s+\d|\s*$)/i, rotulo: 'Comunidade' },
  { re: /\bDISTRITO\s+(.+?)(?:,|\s+S\/N|\s+SN\b|\s+\d|\s*$)/i, rotulo: 'Distrito' },
  { re: /\bLUGAR\s+(.+?)(?:,|\s+S\/N|\s+SN\b|\s+\d|\s*$)/i, rotulo: 'Lugar' },
  { re: /\bVILA\s+(.+?)(?:,|\s+S\/N|\s+SN\b|\s+\d|\s*$)/i, rotulo: 'Vila' },
  { re: /\bS[ÍI]TIO\s+(.+?)(?:,|\s+S\/N|\s+SN\b|\s+\d|\s*$)/i, rotulo: 'Sítio' },
  { re: /\bFAZENDA\s+(.+?)(?:,|\s+S\/N|\s+SN\b|\s+\d|\s*$)/i, rotulo: 'Fazenda' },
]

function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCaseRecorte(s: string): string {
  const lower = new Set(['de', 'do', 'da', 'dos', 'das', 'e'])
  return s
    .split(/\s+/)
    .map((part, i) => {
      const p = part.toLowerCase()
      if (i > 0 && lower.has(p)) return p
      return p.charAt(0).toUpperCase() + p.slice(1)
    })
    .join(' ')
}

function limparNomeExtraido(raw: string): string {
  return raw
    .replace(/^["']|["']$/g, '')
    .replace(/\s*[-–—]\s*S\/N\s*$/i, '')
    .replace(/\s+S\/N\s*$/i, '')
    .replace(/\s+SN\s*$/i, '')
    .replace(/,\s*$/, '')
    .trim()
}

export function isBairroGenerico(bairro: string | null | undefined): boolean {
  if (!bairro?.trim()) return true
  return BAIRROS_GENERICOS.has(normalizarTexto(bairro).toLowerCase())
}

/** Extrai povoado/comunidade/distrito a partir de endereço TSE. */
export function extrairRecorteDeEndereco(endereco: string | null | undefined): string | null {
  if (!endereco?.trim()) return null
  const texto = endereco.trim()

  for (const { re, rotulo } of PREFIXOS_ENDERECO) {
    const match = texto.match(re)
    if (match?.[1]) {
      const nome = titleCaseRecorte(limparNomeExtraido(match[1]))
      if (nome.length >= 2) return `${rotulo} ${nome}`
    }
  }

  return null
}

/** Extrai recorte rural de nome do local (ex.: "GRUPO ESCOLAR DE APARECIDA (POV. APARECIDA)"). */
export function extrairRecorteDeNomeLocal(nome: string | null | undefined): string | null {
  if (!nome?.trim()) return null
  const povMatch = nome.match(/\(\s*POV\.\s*([^)]+)\)/i)
  if (povMatch?.[1]) {
    return `Pov. ${titleCaseRecorte(limparNomeExtraido(povMatch[1]))}`
  }

  const localMatch = nome.match(/\b(?:DO|DA|DE)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{2,})/i)
  if (localMatch?.[1]) {
    const candidato = titleCaseRecorte(limparNomeExtraido(localMatch[1]))
    const ignorar = new Set(['Escolar', 'Unidade', 'Grupo', 'Escola', 'Centro', 'Municipio', 'Município'])
    if (candidato.length >= 3 && !ignorar.has(candidato.split(' ')[0])) {
      return candidato
    }
  }

  return null
}

export type FonteRecorteRural = 'bairro' | 'endereco' | 'nome_local' | null

export function extrairRecorteRural(input: {
  nmBairro?: string | null
  dsEndereco?: string | null
  nmLocalVotacao?: string | null
  zonaRural?: boolean
}): { recorte: string | null; fonte: FonteRecorteRural } {
  if (!input.zonaRural) {
    const bairro = input.nmBairro?.trim()
    return bairro ? { recorte: bairro, fonte: 'bairro' } : { recorte: null, fonte: null }
  }

  if (!isBairroGenerico(input.nmBairro)) {
    return { recorte: input.nmBairro!.trim(), fonte: 'bairro' }
  }

  const deEndereco = extrairRecorteDeEndereco(input.dsEndereco)
  if (deEndereco) return { recorte: deEndereco, fonte: 'endereco' }

  const deNome = extrairRecorteDeNomeLocal(input.nmLocalVotacao)
  if (deNome) return { recorte: deNome, fonte: 'nome_local' }

  return { recorte: null, fonte: null }
}

/** Rótulo para agrupamento territorial (bairro urbano ou povoado rural). */
export function rotuloRecorteLocal(input: {
  nmBairro?: string | null
  dsEndereco?: string | null
  nmLocalVotacao?: string | null
  zonaRural?: boolean
}): string {
  const { recorte } = extrairRecorteRural(input)
  if (recorte) return recorte
  if (!isBairroGenerico(input.nmBairro)) return input.nmBairro!.trim()
  return input.zonaRural ? 'Zona rural / sem recorte' : 'Sem bairro informado'
}

/** Chave estável para agrupar seções do mesmo povoado/comunidade. */
export function chaveRecorteRural(input: {
  nmBairro?: string | null
  dsEndereco?: string | null
  nmLocalVotacao?: string | null
  zonaRural?: boolean
}): string {
  const { recorte } = extrairRecorteRural(input)
  if (recorte) return normalizarTexto(recorte).toLowerCase()
  if (!isBairroGenerico(input.nmBairro)) {
    return normalizarTexto(input.nmBairro!).toLowerCase()
  }
  return 'zona rural / sem recorte'
}
