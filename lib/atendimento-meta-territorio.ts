/** Metas informadas no atendimento por bairro/local (persistência Supabase). */

export type AtendimentoMetaTerritorioMap = Record<string, number>

export function normalizarMunicipioMeta(municipio: string): string {
  return municipio
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizarNomeVereadorMeta(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function chaveMetaBairro(bairroId: string): string {
  return `bairro:${bairroId}`
}

export function chaveMetaLocal(localId: string): string {
  return `local:${localId}`
}

export function sanitizarValoresMeta(value: unknown): AtendimentoMetaTerritorioMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: AtendimentoMetaTerritorioMap = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!k.trim()) continue
    const n =
      typeof v === 'number'
        ? v
        : typeof v === 'string'
          ? Number(v.replace(/[^\d]/g, ''))
          : NaN
    if (Number.isFinite(n) && n >= 0) out[k] = Math.round(n)
  }
  return out
}

export function aplicarValorMeta(
  valores: AtendimentoMetaTerritorioMap,
  chave: string,
  valor: number | null
): AtendimentoMetaTerritorioMap {
  const next = { ...valores }
  if (valor == null || !Number.isFinite(valor) || valor < 0) {
    delete next[chave]
  } else {
    next[chave] = Math.round(valor)
  }
  return next
}

export function somarMetasTerritorio(valores: AtendimentoMetaTerritorioMap): {
  soma: number
  preenchidos: number
} {
  let soma = 0
  let preenchidos = 0
  for (const v of Object.values(valores)) {
    if (!Number.isFinite(v) || v <= 0) continue
    soma += v
    preenchidos += 1
  }
  return { soma, preenchidos }
}
