import { extractCityNameFromQuery } from '@/lib/agent/city-extract'
import { isResumoAtendimentoQuery } from '@/lib/agent/detect-resumo-atendimento'

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Cruza fala/texto com nomes exatos do dropdown de Resumo Eleições. */
export function resolveCidadeResumoEleicoesDropdown(
  query: string,
  cidades: string[]
): string | null {
  const q = normalizeText(query)
  if (!q || cidades.length === 0) return null

  const pares = cidades.map((c) => ({ original: c, norm: normalizeText(c) }))

  for (const { original, norm } of pares) {
    if (norm && q === norm) return original
  }

  let melhor: string | null = null
  let melhorLen = 0
  for (const { original, norm } of pares) {
    if (!norm) continue
    if (q.includes(norm) && norm.length >= melhorLen) {
      melhor = original
      melhorLen = norm.length
    }
  }
  if (melhor) return melhor

  for (const { original, norm } of pares) {
    if (norm.includes(q) && q.length >= 3) return original
  }

  return null
}

const RESUMO_OUTROS_MODULOS =
  /expectativa\s+em|lideranças?\s+em|liderancas?\s+em|demandas?\s+em|agendas?\s+em|instagram|chapa|federal|republicanos|territorio|território|pesquisas?\s+em/

const PEDE_BUSCA_EXPLICITA =
  /buscar|pesquisar|carregar|atualizar|trazer|mostrar|exibir|dados|resultados|executar|rode|roda|faz|fa[cç]a|selecionar|escolher|definir|mudar|carrega|abrir|abre|abra|painel|resumo|cen[aá]rio|cenario/

const APENAS_COMANDO_CURTO =
  /^(buscar|pesquisar|atualizar|carregar|ok|vai|executa|executar|confirma|confirmar)(\s+agora)?$/

export function resolveCidadeAlvoResumoEleicoes(
  query: string,
  cidades: string[]
): string | null {
  let nomeAlvo = resolveCidadeResumoEleicoesDropdown(query, cidades)
  if (!nomeAlvo) {
    const extracted = extractCityNameFromQuery(query)
    if (extracted) {
      const exNorm = normalizeText(extracted)
      nomeAlvo =
        cidades.find((c) => normalizeText(c) === exNorm) ||
        cidades.find(
          (c) =>
            normalizeText(c).includes(exNorm) ||
            (exNorm.length >= 4 && exNorm.includes(normalizeText(c)))
        ) ||
        null
    }
  }
  return nomeAlvo
}

/** Consultas que devem usar a UI da página antes do classificador Groq. */
export function isResumoEleicoesPriorityQuery(query: string, cidades: string[]): boolean {
  const q = normalizeText(query)
  if (!q) return false

  if (
    /\b(ajuda|comandos|exemplos)\b/.test(q) ||
    q === '?' ||
    queryLowerIncludesListarCidades(q)
  ) {
    return true
  }

  if (
    /\b(fechar|feche|fecha)\b/.test(q) ||
    /\bsair\s+(do|da)\s+(modal|janela)\b/.test(q) ||
    /^feche$/i.test(query.trim()) ||
    /^fechar$/i.test(query.trim())
  ) {
    return true
  }

  if (/\b(demandas|pedidos|lideranças|liderancas|pesquisas?)\b/.test(q)) {
    return true
  }

  if (PEDE_BUSCA_EXPLICITA.test(q) || APENAS_COMANDO_CURTO.test(q.trim())) {
    return true
  }

  if (isResumoAtendimentoQuery(query, cidades)) {
    return true
  }

  const nomeAlvo = resolveCidadeAlvoResumoEleicoes(query, cidades)
  if (nomeAlvo && !RESUMO_OUTROS_MODULOS.test(q)) {
    return true
  }

  return false
}

function queryLowerIncludesListarCidades(q: string): boolean {
  return (
    q.includes('listar cidades') ||
    q.includes('cidades disponiveis') ||
    q.includes('cidades disponíveis') ||
    q.includes('quais cidades')
  )
}

export type ResumoBuscarCidadeIntent =
  | { kind: 'cidade'; cidade: string }
  | { kind: 'refresh_atual'; cidade: string }
  | { kind: 'missing_cidade' }

/** Detecção local de busca no dropdown — usada no cliente e na API. */
export function detectResumoBuscarCidadeIntent(
  query: string,
  cidades: string[],
  cidadeAtual?: string
): ResumoBuscarCidadeIntent | null {
  const q = normalizeText(query)
  if (!q || cidades.length === 0) return null

  const pedeBuscaExplicito = PEDE_BUSCA_EXPLICITA.test(q)
  const apenasComandoCurto = APENAS_COMANDO_CURTO.test(q.trim())
  const indicaOutrosModulos = RESUMO_OUTROS_MODULOS.test(q)

  const nomeAlvo = resolveCidadeAlvoResumoEleicoes(query, cidades)

  if ((pedeBuscaExplicito || apenasComandoCurto) && !nomeAlvo && cidadeAtual?.trim()) {
    return { kind: 'refresh_atual', cidade: cidadeAtual.trim() }
  }

  if (nomeAlvo && (!indicaOutrosModulos || pedeBuscaExplicito)) {
    return { kind: 'cidade', cidade: nomeAlvo }
  }

  if (pedeBuscaExplicito && !nomeAlvo) {
    return { kind: 'missing_cidade' }
  }

  return null
}

export function buildResumoBuscarCidadeSyntheticQuery(
  intent: ResumoBuscarCidadeIntent
): string {
  if (intent.kind === 'missing_cidade') return 'buscar cidade'
  return `Buscar ${intent.cidade}`
}
