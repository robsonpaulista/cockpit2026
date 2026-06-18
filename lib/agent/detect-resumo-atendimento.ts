import { extractCityNameFromQuery } from '@/lib/agent/city-extract'
import {
  resolveCidadeAlvoResumoEleicoes,
  resolveCidadeResumoEleicoesDropdown,
} from '@/lib/agent/resumo-eleicoes-city'

function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export interface ResumoAtendimentoContext {
  cidade: string
  liderancaCargo?: string
  liderancaNome?: string
}

const CARGO_LIDERANCA =
  /\b(prefeito|prefeita|vereador|vereadora|secret[aá]rio|secret[aá]ria|lideran[cç]a|presidente)\b/

function isAtendimentoContext(q: string): boolean {
  return (
    /\b(estou\s+(aqui\s+)?(com|em|na|no)|estamos\s+(com|em|na|no)|atendimento|reuniao|reunião|encontro)\b/.test(
      q
    ) || CARGO_LIDERANCA.test(q)
  )
}

function isPedidoPainelResumo(q: string): boolean {
  return (
    (/\b(abr(a|ir|e)|mostr(a|e|ar)|preciso|quero|carreg(a|ue)|exib(a|ir)|ver|consultar)\b/.test(q) &&
      /\b(painel|resumo|cen[aá]rio|cenario|dados|eleicoes|elei[cç][aã]o|municipio|município|cidade)\b/.test(
        q
      )) ||
    /\b(painel|resumo)\s+(da\s+)?cidade\b/.test(q) ||
    /\bresumo\s+(da|de)\s+cidade\b/.test(q)
  )
}

function resolveCidadeFragmento(fragmento: string, cidades: string[]): string | null {
  const frag = fragmento.trim()
  if (!frag) return null

  if (cidades.length > 0) {
    const fromDropdown = resolveCidadeResumoEleicoesDropdown(frag, cidades)
    if (fromDropdown) return fromDropdown
  }

  const extracted = extractCityNameFromQuery(frag)
  if (extracted) {
    if (cidades.length === 0) return extracted
    return resolveCidadeResumoEleicoesDropdown(extracted, cidades) ?? extracted
  }

  return null
}

function parseCidadeAtendimento(query: string, cidades: string[]): string | null {
  const q = normalizeText(query)

  const patterns = [
    /\b(?:prefeito|prefeita|vereador|vereadora|secret[aá]rio|secret[aá]ria|lideran[cç]a|presidente)\s+(?:\w+\s+){0,5}de\s+([a-z0-9\s-]+?)(?:\s+(?:para|preciso|quero|abre|abra|mostre|mostra)|$|\?|,|\.)/,
    /\b(?:painel|resumo|cen[aá]rio)\s+(?:da\s+)?(?:cidade\s+)?(?:de\s+)?([a-z0-9\s-]+?)(?:\s+(?:para|com)|$|\?|,|\.)/,
    /\batendimento\s+(?:em|na|no)\s+([a-z0-9\s-]+?)(?:\s+(?:com|para)|$|\?|,|\.)/,
    /\bestou\s+(?:aqui\s+)?(?:em|na|no)\s+([a-z0-9\s-]+?)(?:\s+(?:com|para)|$|\?|,|\.)/,
    /\bestamos\s+(?:em|na|no)\s+([a-z0-9\s-]+?)(?:\s+(?:com|para)|$|\?|,|\.)/,
    /\b(?:municipio|município|cidade)\s+de\s+([a-z0-9\s-]+?)(?:\s+(?:para|com)|$|\?|,|\.)/,
  ]

  for (const pattern of patterns) {
    const match = q.match(pattern)
    if (!match?.[1]) continue
    const resolved = resolveCidadeFragmento(match[1], cidades)
    if (resolved) return resolved
  }

  if (cidades.length > 0) {
    const alvo = resolveCidadeAlvoResumoEleicoes(query, cidades)
    if (alvo) return alvo
  }

  return extractCityNameFromQuery(query)
}

function parseLideranca(query: string): { cargo?: string; nome?: string } {
  const q = normalizeText(query)
  const match = q.match(
    /\b(prefeito|prefeita|vereador|vereadora|secret[aá]rio|secret[aá]ria|lideran[cç]a|presidente)(?:\s+([a-z0-9à-ú][a-z0-9à-ú\s.-]{0,40}?))?\s+de\s+/i
  )
  if (!match) return {}

  const cargo = match[1]?.trim()
  let nome: string | undefined = match[2]?.trim()
  if (nome) {
    nome = nome.replace(/\s+de\s*$/i, '').trim()
    if (nome.length < 2 || /^(o|a|do|da|de)$/i.test(nome)) nome = undefined
  }

  return { cargo, nome: nome || undefined }
}

/**
 * Atendimento presencial: «estou com o prefeito de Picos», «abra o painel da cidade», etc.
 * Funciona em qualquer tela — navega para Eleições e busca o município.
 */
export function detectResumoAtendimentoIntent(
  query: string,
  cidades: string[] = []
): ResumoAtendimentoContext | null {
  const q = normalizeText(query)
  if (!q || q.length < 8) return null

  const contexto = isAtendimentoContext(q)
  const pedePainel = isPedidoPainelResumo(q)

  if (!contexto && !pedePainel) return null

  const cidade = parseCidadeAtendimento(query, cidades)
  if (!cidade) {
    if (pedePainel || contexto) {
      return null
    }
    return null
  }

  const lideranca = parseLideranca(query)

  const cidadeCanonica =
    cidades.length > 0 ? resolveCidadeAlvoResumoEleicoes(query, cidades) ?? cidade : cidade

  return {
    cidade: cidadeCanonica,
    liderancaCargo: lideranca.cargo,
    liderancaNome: lideranca.nome,
  }
}

export function isResumoAtendimentoQuery(query: string, cidades: string[] = []): boolean {
  return detectResumoAtendimentoIntent(query, cidades) !== null
}
