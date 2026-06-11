import { extractCityNameFromQuery } from '@/lib/agent/city-extract'

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/** Cruza fala/texto com nomes exatos da lista de municípios da página Território. */
export function resolveCidadeTerritorioDropdown(
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

export function resolveCidadeAlvoTerritorio(query: string, cidades: string[]): string | null {
  let nomeAlvo = resolveCidadeTerritorioDropdown(query, cidades)
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

const APENAS_ATUALIZAR =
  /^(atualizar|recarregar|refresh|sincronizar)(\s+(dados|agora|planilha|pagina|página))?$/

export function querAtualizarPaginaTerritorio(query: string): boolean {
  const q = normalizeText(query)
  if (APENAS_ATUALIZAR.test(q.trim())) return true
  return (
    /\b(atualizar|recarregar|sincronizar|refresh)\b/.test(q) &&
    /\b(dados|planilha|pagina|página|territorio|território|base|lista|planilha)\b/.test(q)
  )
}

export function querRecolherLiderancasTerritorio(query: string): boolean {
  const q = normalizeText(query)
  return (
    /\b(recolher|fechar|ocultar|esconder|colapsar)\b/.test(q) &&
    (/\b(lideranças|liderancas|liderança|lideranca|cidade|municipio|município)\b/.test(q) ||
      /\b(todas|todas as cidades)\b/.test(q))
  )
}

export function querExpandirLiderancasTerritorio(query: string): boolean {
  const q = normalizeText(query)
  if (querRecolherLiderancasTerritorio(query)) return false
  if (/\bobras?\b/.test(q)) return false
  if (!/\b(expandir|abrir|mostrar|exibir|ver|consultar)\b/.test(q)) return false
  return (
    /\b(lideranças|liderancas|liderança|lideranca|cidade|municipio|município)\b/.test(q) ||
    /\b(expandir|abrir|mostrar)\b/.test(q)
  )
}

export function querObrasTerritorio(query: string): boolean {
  const q = normalizeText(query)
  if (!/\bobras?\b/.test(q)) return false
  return (
    /\b(abrir|mostrar|exibir|ver|consultar|quero|preciso|desejo)\b/.test(q) ||
    /\b(obras?\s+(de|da|do))\b/.test(q)
  )
}

export function querFecharModalTerritorio(query: string): boolean {
  const q = normalizeText(query)
  return (
    /\b(fechar|feche|fecha|sair)\b/.test(q) ||
    /^feche$/i.test(query.trim()) ||
    /^fechar$/i.test(query.trim())
  )
}

function queryLowerIncludesListarCidades(q: string): boolean {
  return (
    q.includes('listar cidades') ||
    q.includes('cidades disponiveis') ||
    q.includes('cidades disponíveis') ||
    q.includes('quais cidades')
  )
}

/** Consultas que devem usar a UI da página Território antes do classificador Groq. */
export function isTerritorioPriorityQuery(query: string, cidades: string[]): boolean {
  const q = normalizeText(query)
  if (!q) return false

  if (
    /\b(ajuda|comandos|exemplos)\b/.test(q) ||
    q === '?' ||
    queryLowerIncludesListarCidades(q)
  ) {
    return true
  }

  if (querAtualizarPaginaTerritorio(query)) return true

  if (querFecharModalTerritorio(query)) return true

  if (querObrasTerritorio(query)) return true

  if (querExpandirLiderancasTerritorio(query) || querRecolherLiderancasTerritorio(query)) {
    return true
  }

  const nomeAlvo = resolveCidadeAlvoTerritorio(query, cidades)
  if (
    nomeAlvo &&
    /\b(expandir|abrir|mostrar|obras?)\b/.test(q) &&
    !/\b(expectativa|votos?|demandas?|pesquisas?|agenda)\b/.test(q)
  ) {
    return true
  }

  return false
}
