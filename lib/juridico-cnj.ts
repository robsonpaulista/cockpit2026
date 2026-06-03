/** Número único CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO */

export type CnjParsed = {
  raw: string
  sequencial: string
  digito: string
  ano: string
  segmento: number
  tribunal: number
  origem: string
  /** 20 dígitos, formato usado na API Datajud */
  somenteDigitos: string
}

const CNJ_REGEX = /^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/

export function parseNumeroCnj(numero: string | null | undefined): CnjParsed | null {
  const raw = String(numero ?? '').trim()
  const m = CNJ_REGEX.exec(raw)
  if (!m) return null
  const segmento = Number(m[4])
  const tribunal = Number(m[5])
  if (!Number.isFinite(segmento) || !Number.isFinite(tribunal)) return null
  return {
    raw,
    sequencial: m[1],
    digito: m[2],
    ano: m[3],
    segmento,
    tribunal,
    origem: m[6],
    somenteDigitos: `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}`,
  }
}

/** Alias do endpoint Datajud (`api_publica_{alias}`). */
export function resolveDatajudAlias(cnj: CnjParsed): string | null {
  const { segmento: j, tribunal: tr } = cnj
  if (j === 8) {
    const tj: Record<number, string> = {
      10: 'tjma',
      18: 'tjpi',
    }
    return tj[tr] ?? null
  }
  if (j === 4) return `trf${tr}`
  if (j === 5) return `trt${tr}`
  return null
}

export function isSegundoGrau(orgaoJulgador: string | null | undefined): boolean {
  const o = String(orgaoJulgador ?? '').toLowerCase()
  return /\b2º\b/.test(o) || /\b2ª\b/.test(o) || o.includes('2o -') || o.includes('2ª inst')
}
