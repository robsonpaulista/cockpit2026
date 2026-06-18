function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Pedido de planejamento / cronograma de visitas (ex.: «plano de 30 dias»),
 * distinto de «quais cidades preciso visitar» (lista de prioridade).
 */
export function isPlanoVisitasCampoQuery(query: string): boolean {
  const q = norm(query)

  if (/\b(instagram|insta|perfil)\b/.test(q)) return false

  const hasVisit =
    /\b(visita?s?|visitar|viagem|viagens|campo|municipio?s?|cidades?)\b/.test(q)
  if (!hasVisit) return false

  const hasPlan =
    /\b(plano|planejamento|planejar|cronograma|roteiro|calendario|programacao|programar|distribui|distribuir|organize|organizar|monte|montar)\b/.test(
      q
    )

  const hasHorizon =
    /\b(\d+\s*dias?|30\s*dias|quinzena|semanas?|proxim[oa]s\s+\d+|próxim[oa]s\s+\d+)\b/.test(q)

  if (hasPlan) return true

  if (
    hasHorizon &&
    /\b(preciso|quero|devo|monte|montar|fazer|criar|suger[ae]|proponh[ae])\b/.test(q) &&
    hasVisit
  ) {
    return true
  }

  if (/\bplano\b/.test(q) && /\bvisitas?\b/.test(q)) return true

  return false
}

/** Extrai horizonte em dias quando citado (padrão 30). */
export function parsePlanoVisitasDias(query: string): number {
  const q = norm(query)
  const m = q.match(/\b(\d{1,3})\s*dias?\b/)
  if (m) {
    const n = Number(m[1])
    if (n >= 7 && n <= 90) return n
  }
  if (/\bquinzena\b/.test(q)) return 15
  if (/\b(mes|mês|30\s*dias)\b/.test(q)) return 30
  return 30
}
