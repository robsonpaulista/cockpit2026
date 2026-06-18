import { isPlanoVisitasCampoQuery } from '@/lib/agent/detect-plano-visitas'

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const POUCA_VISITA =
  /\b(poucas?\s+(visitas?|vezes)|pouco\s+visitei|visitei\s+poucas?\s+vezes|visitei\s+pouco|baixa\s+frequencia|sem\s+visita|nenhuma\s+visita|nao\s+visitei|nunca\s+visitei|ainda\s+nao\s+visitei)\b/

const EXPECTATIVA_OU_VOTOS = /\b(expectativa|votos|projec)\b/

/**
 * Perguntas sobre municípios prioritários para visitar
 * (alta expectativa de votos + pouca/nenhuma visita — mesmo critério do Resumo Operacional).
 */
export function isPrioridadeVisitasCampoQuery(query: string): boolean {
  if (isPlanoVisitasCampoQuery(query)) return false

  const q = norm(query)

  if (/\b(instagram|insta|perfil)\b/.test(q) && /\bvisita\b/.test(q)) return false

  if (
    /\b(prioridade(s)?\s+(de\s+)?campo|priorizar\s+campo|mapa\s+de\s+prioridade|territorios?\s+fri[oa]s?)\b/.test(
      q
    )
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
    /\b(quais|que|lista|listar|relacao|relação|mostre|mostra|me\s+diga|me\s+fala|onde)\b/.test(q) &&
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

  if (EXPECTATIVA_OU_VOTOS.test(q) && POUCA_VISITA.test(q)) {
    return true
  }

  if (
    /\b(alta|elevada|grande|maior)\s+expectativa\b/.test(q) &&
    POUCA_VISITA.test(q)
  ) {
    return true
  }

  if (
    /\b(analis[ae]|diagnostico|panorama)\b/.test(q) &&
    EXPECTATIVA_OU_VOTOS.test(q) &&
    /\b(visitei|visita|visitas?|vezes)\b/.test(q) &&
    /\b(poucas?|pouco|baixa|menos|sem\s+visita|nao\s+visitei|nunca)\b/.test(q)
  ) {
    return true
  }

  return false
}
