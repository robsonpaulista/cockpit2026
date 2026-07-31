import { normalizeIptMunicipio } from '@/lib/ipt'
import { normalizeObraText } from '@/lib/obras-mapa'
import { seiLookupKey } from '@/lib/obras-sei-db'

/** Campos do Recap relevantes para enriquecer o modal War Room · Obras. */
export type ObraRecapMatchSource = {
  id: string
  municipio?: string | null
  obra?: string | null
  sei?: string | null
  orgao?: string | null
  status?: string | null
  valor_total?: number | null
  valor_pago?: number | null
  sei_url?: string | null
  sei_ultimo_andamento?: string | null
  sei_ultimo_andamento_data?: string | null
  sei_ultimo_status?: string | null
  sei_ultimo_status_data?: string | null
  sei_plano_trabalho_url?: string | null
  sei_plano_trabalho_tipo?: string | null
  sei_plano_trabalho_numero?: string | null
  doe_edicao?: string | null
  doe_resumo?: string | null
  doe_pdf_url?: string | null
}

export type ObraMapaMatchTarget = {
  id: string
  municipio?: string | null
  obra?: string | null
  sei?: string | null
}

export type ObraRecapMatchKind = 'sei' | 'descricao' | 'descricao_parcial'

export type ObraRecapMatch = {
  recap: ObraRecapMatchSource
  kind: ObraRecapMatchKind
  score: number
}

/** Normaliza texto da descrição da obra para comparação. */
export function normalizeObraDescricao(value: string | null | undefined): string {
  return normalizeObraText(value ?? '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function obraDescricaoMatchKey(
  municipio: string | null | undefined,
  obra: string | null | undefined,
): string {
  const mun = normalizeIptMunicipio(municipio ?? '')
  const desc = normalizeObraDescricao(obra)
  if (!mun || !desc) return ''
  return `${mun}|${desc}`
}

function tokensDescricao(desc: string): Set<string> {
  return new Set(desc.split(' ').filter((t) => t.length >= 3))
}

/** Similaridade Jaccard entre tokens (≥3 chars). */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter += 1
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

function scoreDescricao(a: string, b: string): { score: number; kind: ObraRecapMatchKind } | null {
  if (!a || !b) return null
  if (a === b) return { score: 90, kind: 'descricao' }
  if (a.length >= 24 && b.length >= 24 && (a.includes(b) || b.includes(a))) {
    return { score: 75, kind: 'descricao_parcial' }
  }
  const j = jaccard(tokensDescricao(a), tokensDescricao(b))
  if (j >= 0.72) return { score: Math.round(55 + j * 20), kind: 'descricao_parcial' }
  return null
}

/**
 * Cruza obra do mapa/War Room com itens do Recap.
 * Prioridade: SEI normalizado → município + descrição exata → descrição parcial.
 */
export function matchObraComRecap(
  target: ObraMapaMatchTarget,
  recapItems: readonly ObraRecapMatchSource[],
): ObraRecapMatch | null {
  const seiKey = seiLookupKey(target.sei)
  if (seiKey) {
    const bySei = recapItems.find((r) => seiLookupKey(r.sei) === seiKey)
    if (bySei) return { recap: bySei, kind: 'sei', score: 100 }
  }

  const munKey = normalizeIptMunicipio(target.municipio ?? '')
  const descTarget = normalizeObraDescricao(target.obra)
  if (!munKey || !descTarget) return null

  let best: ObraRecapMatch | null = null
  for (const item of recapItems) {
    if (normalizeIptMunicipio(item.municipio ?? '') !== munKey) continue
    const scored = scoreDescricao(descTarget, normalizeObraDescricao(item.obra))
    if (!scored) continue
    if (!best || scored.score > best.score) {
      best = { recap: item, kind: scored.kind, score: scored.score }
    }
  }
  return best
}

export function indexRecapMatchesByObraId(
  obras: readonly ObraMapaMatchTarget[],
  recapItems: readonly ObraRecapMatchSource[],
): Map<string, ObraRecapMatch> {
  const out = new Map<string, ObraRecapMatch>()
  const usedRecap = new Set<string>()

  // 1ª passada: SEI (exclusivo)
  for (const obra of obras) {
    const seiKey = seiLookupKey(obra.sei)
    if (!seiKey) continue
    const hit = recapItems.find((r) => seiLookupKey(r.sei) === seiKey)
    if (!hit || usedRecap.has(hit.id)) continue
    out.set(obra.id, { recap: hit, kind: 'sei', score: 100 })
    usedRecap.add(hit.id)
  }

  // 2ª passada: descrição (não reutiliza Recap já ligado por SEI)
  const restantes = obras.filter((o) => !out.has(o.id))
  for (const obra of restantes) {
    const munKey = normalizeIptMunicipio(obra.municipio ?? '')
    const descTarget = normalizeObraDescricao(obra.obra)
    if (!munKey || !descTarget) continue

    let best: ObraRecapMatch | null = null
    for (const item of recapItems) {
      if (usedRecap.has(item.id)) continue
      if (normalizeIptMunicipio(item.municipio ?? '') !== munKey) continue
      const scored = scoreDescricao(descTarget, normalizeObraDescricao(item.obra))
      if (!scored) continue
      if (!best || scored.score > best.score) {
        best = { recap: item, kind: scored.kind, score: scored.score }
      }
    }
    if (best) {
      out.set(obra.id, best)
      usedRecap.add(best.recap.id)
    }
  }

  return out
}
