import { isSegundoGrau, parseNumeroCnj, type CnjParsed } from '@/lib/juridico-cnj'

function norm(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Vara estadual no TJPI (nome completo na planilha).
 * Diferente da abreviação "Vara da Fazenda" usada na Justiça Federal (TRF1).
 */
export function isVaraFazendaEstadualTjpi(varaOrigem: string | null | undefined): boolean {
  const v = norm(varaOrigem)
  return v.includes('feitos da fazenda publica')
}

/** Indícios de vara/órgão na Justiça Federal — TRF1 (Seção Judiciária do PI). */
export function isVaraOuOrgaoTrf1(
  orgaoJulgador: string | null | undefined,
  varaOrigem: string | null | undefined
): boolean {
  const o = norm(orgaoJulgador)
  if (o.includes('trf1') || o.includes('trf 1') || o.includes('justica federal')) {
    return true
  }

  const v = norm(varaOrigem)
  if (!v) return false
  if (isVaraFazendaEstadualTjpi(varaOrigem)) return false

  if (/\bvara\s+da\s+fazenda\b/.test(v)) return true
  if (/vara\s+federal|secao\s+judiciaria|\bsjpi\b|\bsj\s+pi\b/.test(v)) return true
  if (/execucao\s+fiscal/.test(v) && /federal|secao|sj/.test(v)) return true
  if (/\b\d+a?\s*vf\b/.test(v) || /\b\d+ª\s*vf\b/.test(v)) return true

  return false
}

export function isProcessoTrf1(
  processo: string,
  orgaoJulgador: string | null | undefined,
  varaOrigem: string | null | undefined
): boolean {
  const cnj = parseNumeroCnj(processo)
  if (cnj?.segmento === 4 && cnj.tribunal === 1) return true
  return isVaraOuOrgaoTrf1(orgaoJulgador, varaOrigem)
}

/** Órgão julgador efetivo para grau (1º/2º) e link de consulta pública. */
export function resolveOrgaoJulgadorParaConsulta(
  orgaoJulgador: string | null | undefined,
  varaOrigem: string | null | undefined,
  processo: string
): string | null {
  const o = String(orgaoJulgador ?? '').trim()
  if (isProcessoTrf1(processo, orgaoJulgador, varaOrigem)) {
    if (/trf\s*1|trf1/i.test(o)) return o
    const grau2 = isSegundoGrau(o) || isSegundoGrau(varaOrigem)
    return grau2 ? '2º - TRF1' : '1º - TRF1'
  }
  return o || null
}

export function tribunalConsultaFromCnj(cnj: CnjParsed): 'TJPI' | 'TJMA' | 'TRF1' | 'TRT22' | null {
  if (cnj.segmento === 8 && cnj.tribunal === 18) return 'TJPI'
  if (cnj.segmento === 8 && cnj.tribunal === 10) return 'TJMA'
  if (cnj.segmento === 4 && cnj.tribunal === 1) return 'TRF1'
  if (cnj.segmento === 5 && cnj.tribunal === 22) return 'TRT22'
  return null
}

export function resolveTribunalConsulta(
  processo: string,
  orgaoJulgador: string | null | undefined,
  varaOrigem: string | null | undefined
): 'TJPI' | 'TJMA' | 'TRF1' | 'TRT22' | null {
  if (isProcessoTrf1(processo, orgaoJulgador, varaOrigem)) return 'TRF1'
  const cnj = parseNumeroCnj(processo)
  if (!cnj) return null
  return tribunalConsultaFromCnj(cnj)
}
