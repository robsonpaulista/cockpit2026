/**
 * Filtro de relevância municipal para notícias do Radar 224.
 * O Google News RSS é amplo: exige menção explícita do município no título/resumo.
 * Nomes ambíguos (ex.: Brasileira) exigem âncora municipal/Piauí e rejeitam usos adjetivais.
 */

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Municípios cujo nome também é palavra comum / adjetivo / topônimo genérico.
 * Sem âncora de cidade (Piauí / prefeitura / município) viram ruído nacional.
 */
const MUNICIPIOS_AMBIGUOS = new Set([
  'brasileira',
  'uniao',
  'porto',
  'altos',
  'paz',
  'bom jesus',
  'esperantina', // menos crítico, mas curto/comum em outras UFs
  'colina',
  'jardim',
  'mirante',
])

/** Uso adjetival / nacional de "brasileira" — não é o município. */
const FALSOS_POSITIVOS_BRASILEIRA = [
  /\bselecao brasileira\b/,
  /\bmulher brasileira\b/,
  /\bcasa da mulher brasileira\b/,
  /\bmodelo brasileira\b/,
  /\bsoberania brasileira\b/,
  /\beconomia brasileira\b/,
  /\bpolitica brasileira\b/,
  /\bcultura brasileira\b/,
  /\bindustria brasileira\b/,
  /\bcopa( do mundo)? brasileira\b/,
  /\bcidade brasileira\b/, // genérico, não o município
  /\bempresa brasileira\b/,
  /\bcidada brasileira\b/,
  /\bcomunidade brasileira\b/,
]

/** Variantes normalizadas do nome do município. */
export function variantesNomeMunicipio(municipio: string): string[] {
  const base = normalizeText(municipio)
  if (!base) return []
  const set = new Set<string>([base])
  set.add(base.replace(/\s+do\s+piaui$/, '').trim())
  set.add(base.replace(/\s+da\s+piaui$/, '').trim())
  set.add(base.replace(/\s+de\s+piaui$/, '').trim())
  return [...set].filter((v) => v.length >= 3)
}

export function municipioAmbiguo(municipio: string): boolean {
  return variantesNomeMunicipio(municipio).some((v) => MUNICIPIOS_AMBIGUOS.has(v))
}

function temContextoPiaui(blob: string): boolean {
  return (
    /\bpiaui\b/.test(blob) ||
    /\bmunicipio\b/.test(blob) ||
    /\bprefeitura\b/.test(blob) ||
    /\bcamara\b/.test(blob) ||
    /\bvereador/.test(blob) ||
    /\bprefeito\b/.test(blob) ||
    /\bsecretar/.test(blob) ||
    /\b\w+-pi\b/.test(blob) ||
    /\(\s*pi\s*\)/.test(blob) ||
    /\bpi\b/.test(blob)
  )
}

function eFalsoPositivoBrasileira(blob: string): boolean {
  return FALSOS_POSITIVOS_BRASILEIRA.some((re) => re.test(blob))
}

/** Âncoras que indicam a cidade Brasileira (PI), não o adjetivo. */
function temAncoraMunicipal(blob: string, variante: string): boolean {
  const v = escapeRegExp(variante)
  if (
    new RegExp(`municipio (de |da |do )?${v}\\b`).test(blob) ||
    new RegExp(`prefeitura (de |da |do )?${v}\\b`).test(blob) ||
    new RegExp(`camara (de |da |do |municipal de )?${v}\\b`).test(blob) ||
    new RegExp(`\\bem ${v}\\b`).test(blob) ||
    new RegExp(`${v}\\s*[-–—]?\\s*pi\\b`).test(blob) ||
    new RegExp(`${v}\\s*\\(\\s*pi\\s*\\)`).test(blob) ||
    new RegExp(`${v}\\s*,\\s*piaui\\b`).test(blob) ||
    new RegExp(`${v}\\s+no\\s+piaui\\b`).test(blob) ||
    new RegExp(`${v}\\s+piaui\\b`).test(blob)
  ) {
    return true
  }
  // Menção + contexto institucional do Piauí (sem falso positivo adjetival)
  return blob.includes(variante) && temContextoPiaui(blob)
}

/**
 * Verifica se o texto menciona o município de forma utilizável.
 * Nomes curtos ou ambíguos (ex.: Brasileira, União) exigem âncora municipal/Piauí.
 */
export function textoMencionaMunicipio(texto: string, municipio: string): boolean {
  const blob = normalizeText(texto)
  if (!blob) return false

  const variantes = variantesNomeMunicipio(municipio)
  const ambiguo = municipioAmbiguo(municipio)

  for (const variante of variantes) {
    const palavras = variante.split(' ').filter(Boolean)
    const isNomeCurto = palavras.length === 1 && variante.length <= 6
    const precisaAncora = ambiguo || isNomeCurto
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(variante)}(?:[^a-z0-9]|$)`, 'i')

    if (!pattern.test(blob)) continue

    if (variante === 'brasileira' && eFalsoPositivoBrasileira(blob)) {
      continue
    }

    if (precisaAncora) {
      if (temAncoraMunicipal(blob, variante)) return true
      continue
    }

    // Nome composto inequívoco (ex.: Miguel Alves)
    return true
  }

  return false
}

export type RelevanciaMunicipio = {
  ok: boolean
  noTitulo: boolean
  noResumo: boolean
}

export function avaliarRelevanciaMunicipio(opts: {
  municipio: string
  title: string
  summary?: string | null
}): RelevanciaMunicipio {
  // Para ambíguos, avalia título+resumo juntos (âncora pode estar em um e o nome no outro)
  if (municipioAmbiguo(opts.municipio)) {
    const conjunto = `${opts.title || ''} ${opts.summary || ''}`
    const ok = textoMencionaMunicipio(conjunto, opts.municipio)
    const noTitulo = textoMencionaMunicipio(opts.title, opts.municipio)
    return {
      ok,
      noTitulo,
      noResumo: ok && !noTitulo,
    }
  }

  const noTitulo = textoMencionaMunicipio(opts.title, opts.municipio)
  const noResumo = textoMencionaMunicipio(opts.summary || '', opts.municipio)
  return {
    ok: noTitulo || noResumo,
    noTitulo,
    noResumo,
  }
}
