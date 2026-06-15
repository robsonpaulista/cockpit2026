function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Perguntas sobre municípios prioritários para visitar
 * (alta expectativa de votos + pouca/nenhuma visita — mesmo critério do Resumo Operacional).
 */
export function isPrioridadeVisitasCampoQuery(query: string): boolean {
  const q = norm(query)

  if (/\b(instagram|insta|perfil)\b/.test(q) && /\bvisita\b/.test(q)) return false

  if (
    /\b(prioridade(s)?\s+(de\s+)?campo|priorizar\s+campo|mapa\s+de\s+prioridade)\b/.test(q)
  ) {
    return true
  }

  if (
    /\b(preciso|devo|tenho que|falta|faltam|priorizar|prioridade)\b/.test(q) &&
    /\b(visitar|visita|campo|municipios?|cidades?)\b/.test(q)
  ) {
    return true
  }

  if (
    /\b(quais|que|lista|listar|relacao|relação|mostre|mostra|me\s+diga|me\s+fala)\b/.test(q) &&
    /\b(cidades?|municipios?)\b/.test(q) &&
    /\b(visitar|visita|campo|importantes?|prioritarias?|prioridade)\b/.test(q)
  ) {
    return true
  }

  if (
    /\b(cidades?|municipios?)\b/.test(q) &&
    /\b(importantes?|prioritarias?|criticas?|urgentes?)\b/.test(q) &&
    /\b(visitar|visita|campo|visitei|visite)\b/.test(q)
  ) {
    return true
  }

  if (
    /\b(nao\s+visitei|nunca\s+visitei|ainda\s+nao\s+visitei|sem\s+visita|nao\s+visitad[ao]s?)\b/.test(
      q
    ) &&
    /\b(cidades?|municipios?|onde|qual)\b/.test(q)
  ) {
    return true
  }

  if (
    /\b(expectativa|votos)\b/.test(q) &&
    /\b(poucas?\s+visitas?|sem\s+visita|nenhuma\s+visita|nao\s+visitei)\b/.test(q)
  ) {
    return true
  }

  return false
}
