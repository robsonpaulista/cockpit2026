import { parseNumeroCnj, type CnjParsed } from '@/lib/juridico-cnj'

export const COMUNICA_API_BASE = 'https://comunicaapi.pje.jus.br/api/v1'
export const COMUNICA_CONSULTA_BASE = 'https://comunica.pje.jus.br/consulta'

/** Siglas usadas na API Comunicações Processuais (DJEN). */
export function resolveComunicaSiglaTribunal(
  cnj: CnjParsed | null,
  orgaoJulgador: string | null | undefined
): string | null {
  if (cnj) {
    const { segmento: j, tribunal: tr } = cnj
    if (j === 8) {
      const map: Record<number, string> = { 10: 'TJMA', 18: 'TJPI' }
      if (map[tr]) return map[tr]
    }
    if (j === 4) return `TRF${tr}`
    if (j === 5) return `TRT${tr}`
  }
  const o = String(orgaoJulgador ?? '').toUpperCase()
  if (o.includes('TJ PI') || o.includes('TJPI')) return 'TJPI'
  if (o.includes('TJ MA') || o.includes('TJMA')) return 'TJMA'
  if (o.includes('TRF1') || o.includes('TRF 1')) return 'TRF1'
  if (o.includes('TRT22') || o.includes('TRT 22')) return 'TRT22'
  return null
}

export function formatIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function defaultComunicaDateRange(): { inicio: string; fim: string } {
  const fim = new Date()
  const inicio = new Date()
  inicio.setFullYear(inicio.getFullYear() - 6)
  return { inicio: formatIsoDate(inicio), fim: formatIsoDate(fim) }
}

export function buildComunicaConsultaUrl(params: {
  numeroProcesso: string
  siglaTribunal: string
  dataInicio?: string
  dataFim?: string
}): string {
  const range = defaultComunicaDateRange()
  const q = new URLSearchParams({
    siglaTribunal: params.siglaTribunal,
    dataDisponibilizacaoInicio: params.dataInicio ?? range.inicio,
    dataDisponibilizacaoFim: params.dataFim ?? range.fim,
    numeroProcesso: params.numeroProcesso.replace(/\D/g, ''),
  })
  return `${COMUNICA_CONSULTA_BASE}?${q.toString()}`
}

export function buildComunicaCertidaoUrl(hash: string): string {
  return `${COMUNICA_API_BASE}/comunicacao/${encodeURIComponent(hash)}/certidao`
}

export type ComunicacaoProcessual = {
  id: number
  hash: string
  dataDisponibilizacao: string
  siglaTribunal: string
  tipoComunicacao: string
  nomeOrgao: string
  numeroProcesso: string
  numeroProcessoFormatado: string | null
  meioCompleto: string | null
  tipoDocumento: string | null
  nomeClasse: string | null
  textoResumo: string
  linkPjeDocumento: string | null
  certidaoUrl: string
  destinatarios: string[]
  advogados: string[]
}

export type ComunicacoesProcessoResponse = {
  ok: boolean
  count: number
  consultaComunicaUrl: string | null
  comunicacoes: ComunicacaoProcessual[]
  aviso: string | null
}

export function getComunicaInfoFromProcesso(processo: string, orgaoJulgador: string | null): {
  cnj: CnjParsed | null
  sigla: string | null
  numeroApi: string | null
} {
  const cnj = parseNumeroCnj(processo)
  const sigla = resolveComunicaSiglaTribunal(cnj, orgaoJulgador)
  const digits = cnj?.somenteDigitos ?? processo.replace(/\D/g, '')
  const numeroApi = digits.length >= 15 ? digits : null
  return { cnj, sigla, numeroApi }
}
