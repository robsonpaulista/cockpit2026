import municipiosPiaui from '@/lib/municipios-piaui.json'
import {
  municipioAmbiguo,
  textoMencionaMunicipio,
  variantesNomeMunicipio,
} from '@/lib/radar-224/relevancia-municipio'

export type InstagramCaptionMunicipioMatch = {
  municipio: string
  /** Trecho usado no match (header ou legenda). */
  source: 'header' | 'caption'
}

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[📍📌✨❤️🧡💙🟢●•]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Municípios do PI ordenados do nome mais longo ao mais curto (evita match parcial). */
const MUNICIPIOS_PI_POR_TAMANHO = (municipiosPiaui as Array<{ nome: string }>)
  .map((m) => m.nome.trim())
  .filter(Boolean)
  .sort((a, b) => b.length - a.length)

/** Primeira linha da legenda — o “header” operacional das postagens. */
export function instagramCaptionHeader(caption: string | null | undefined): string {
  if (!caption) return ''
  const line = caption.split(/\r?\n/)[0] ?? ''
  return line.replace(/^\s*[^\p{L}\p{N}]+/u, '').trim()
}

/**
 * Procura o município citado no texto (match por palavra, nome mais longo primeiro).
 * Em nomes ambíguos (ex.: Brasileira), exige âncora municipal via textoMencionaMunicipio.
 */
export function matchMunicipioInText(
  texto: string,
  opts?: { preferLooseHeader?: boolean },
): string | null {
  const raw = String(texto || '').trim()
  if (!raw) return null

  const blob = normalizeText(raw)
  if (!blob) return null

  const preferLooseHeader = opts?.preferLooseHeader === true
  const headerCurto = preferLooseHeader && blob.length <= 48

  for (const municipio of MUNICIPIOS_PI_POR_TAMANHO) {
    const variantes = variantesNomeMunicipio(municipio)
    const ambiguo = municipioAmbiguo(municipio)

    for (const variante of variantes) {
      if (variante.length < 3) continue
      const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(variante)}(?:[^\\p{L}\\p{N}]|$)`, 'u')
      if (!re.test(blob)) continue

      if (ambiguo && !headerCurto) {
        if (!textoMencionaMunicipio(raw, municipio)) continue
      } else if (ambiguo && headerCurto) {
        // Header curto tipicamente é só o nome da cidade — aceita match direto.
        if (!textoMencionaMunicipio(raw, municipio) && !blob.includes(variante)) continue
      }

      return municipio
    }
  }

  return null
}

/**
 * Detecta o município do Piauí citado na legenda do Instagram.
 * Prioriza a primeira linha (header); se não achar, busca no corpo.
 */
export function detectMunicipioFromInstagramCaption(
  caption: string | null | undefined,
): InstagramCaptionMunicipioMatch | null {
  if (!caption?.trim()) return null

  const header = instagramCaptionHeader(caption)
  if (header) {
    const fromHeader = matchMunicipioInText(header, { preferLooseHeader: true })
    if (fromHeader) {
      return { municipio: fromHeader, source: 'header' }
    }
  }

  const fromCaption = matchMunicipioInText(caption)
  if (fromCaption) {
    return { municipio: fromCaption, source: 'caption' }
  }

  return null
}
